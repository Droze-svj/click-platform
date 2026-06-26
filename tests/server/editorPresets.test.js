// Saved editor "looks" (/api/editor/presets). Real in-memory persistence. Locks in:
// save→list round-trip, per-user isolation, the settings KEY-ALLOWLIST (no
// mass-assignment / prototype pollution), empty-rejection, the dev-user block, delete.

jest.mock('../../server/middleware/auth', () => (req, res, next) => { req.user = { _id: req.headers['x-uid'] || 'realuser' }; next(); });

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const UserPreferences = require('../../server/models/UserPreferences');
const router = require('../../server/routes/editor-presets');

function app() { const a = express(); a.use(express.json()); a.use('/api/editor', router); return a; }

describe('/api/editor/presets', () => {
  let uidA, uidB;
  beforeEach(() => { uidA = new mongoose.Types.ObjectId().toString(); uidB = new mongoose.Types.ObjectId().toString(); });
  afterEach(async () => { await UserPreferences.deleteMany({}); });

  it('saves a look and lists it back', async () => {
    const save = await request(app()).post('/api/editor/presets').set('x-uid', uidA)
      .send({ name: 'Cinematic', settings: { filters: { contrast: 120 }, colorGrade: 'cinematic' } });
    expect(save.status).toBe(200);
    expect(save.body.data.preset.name).toBe('Cinematic');
    const list = await request(app()).get('/api/editor/presets').set('x-uid', uidA);
    expect(list.body.data.presets).toHaveLength(1);
    expect(list.body.data.presets[0].settings.colorGrade).toBe('cinematic');
  });

  it('strips non-allowlisted settings keys (no mass-assignment / prototype pollution)', async () => {
    const save = await request(app()).post('/api/editor/presets').set('x-uid', uidA)
      .send({ name: 'X', settings: { filters: { contrast: 110 }, isAdmin: true, evil: 'x' } });
    const s = save.body.data.preset.settings;
    expect(s.filters).toEqual({ contrast: 110 });
    expect(s.isAdmin).toBeUndefined();
    expect(s.evil).toBeUndefined();
    expect(({}).polluted).toBeUndefined();
  });

  it('is per-user isolated — B never sees A’s looks', async () => {
    await request(app()).post('/api/editor/presets').set('x-uid', uidA).send({ name: 'A look', settings: { filters: { contrast: 111 } } });
    const listB = await request(app()).get('/api/editor/presets').set('x-uid', uidB);
    expect(listB.body.data.presets).toEqual([]);
  });

  it('rejects a save with no valid (allowlisted) settings', async () => {
    const r = await request(app()).post('/api/editor/presets').set('x-uid', uidA).send({ name: 'empty', settings: { junk: 1 } });
    expect(r.status).toBe(400);
  });

  it('blocks the demo/dev user from saving and returns an empty list', async () => {
    const save = await request(app()).post('/api/editor/presets').set('x-uid', 'dev-user-123').send({ settings: { filters: { contrast: 120 } } });
    expect(save.status).toBe(403);
    const list = await request(app()).get('/api/editor/presets').set('x-uid', 'dev-user-123');
    expect(list.body.data.presets).toEqual([]);
  });

  it('deletes a saved look', async () => {
    const save = await request(app()).post('/api/editor/presets').set('x-uid', uidA).send({ name: 'D', settings: { filters: { contrast: 120 } } });
    const id = save.body.data.preset.id;
    const del = await request(app()).delete(`/api/editor/presets/${id}`).set('x-uid', uidA);
    expect(del.body.data.removed).toBe(1);
    const list = await request(app()).get('/api/editor/presets').set('x-uid', uidA);
    expect(list.body.data.presets).toHaveLength(0);
  });
});
