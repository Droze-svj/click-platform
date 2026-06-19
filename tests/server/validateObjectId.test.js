// validateObjectId 400s on malformed path ids (instead of a Mongoose CastError 500),
// allows real ObjectIds + dev ids through; getPagination clamps ?limit/?page.

const mongoose = require('mongoose');
const { validateObjectId, getPagination } = require('../../server/middleware/validateObjectId');

function run(mw, params) {
  const req = { params };
  let status = 200; let body = null; let nextCalled = false;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  mw(req, res, () => { nextCalled = true; });
  return { status, body, nextCalled };
}

describe('validateObjectId', () => {
  test('passes a valid ObjectId', () => {
    const r = run(validateObjectId('id'), { id: new mongoose.Types.ObjectId().toString() });
    expect(r.nextCalled).toBe(true);
  });
  test('400s a malformed id (no Mongoose CastError 500)', () => {
    const r = run(validateObjectId('contentId'), { contentId: 'not-an-id' });
    expect(r.nextCalled).toBe(false);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/contentId/);
  });
  test('lets dev- ids through (dev flow)', () => {
    expect(run(validateObjectId('id'), { id: 'dev-content-123' }).nextCalled).toBe(true);
  });
});

describe('getPagination', () => {
  test('clamps over-large limit and floors page', () => {
    expect(getPagination({ limit: '999999', page: '3' })).toEqual({ page: 3, limit: 100, skip: 200 });
    expect(getPagination({ page: '-5', limit: '0' })).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });
  test('honors custom defaults/max', () => {
    expect(getPagination({ limit: '500' }, { defaultLimit: 50, maxLimit: 100 }).limit).toBe(100);
    expect(getPagination({}, { defaultLimit: 50 }).limit).toBe(50);
  });
});
