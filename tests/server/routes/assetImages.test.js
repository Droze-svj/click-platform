// Editor asset library image uploads. "Upload image" used to post the file to
// /api/video/upload as a `video` field, whose filter accepts only video files —
// every image came back 400. Images now have their own owner-indexed route.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const UserImage = require('../../../server/models/UserImage');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const UPLOADS_ROOT = path.join(__dirname, '../../../uploads');

describe('POST/GET/DELETE /api/assets/images', () => {
  let owner; let other; let ownerToken; let otherToken;
  const written = [];

  beforeEach(async () => {
    await User.deleteMany({ email: { $in: ['img-owner@example.com', 'img-other@example.com'] } });
    await UserImage.deleteMany({});
    owner = await new User({ email: 'img-owner@example.com', password: 'password123', name: 'Owner', emailVerified: true }).save();
    other = await new User({ email: 'img-other@example.com', password: 'password123', name: 'Other', emailVerified: true }).save();
    ownerToken = jwt.sign({ userId: String(owner._id) }, getJwtSecret(), { expiresIn: '1h' });
    otherToken = jwt.sign({ userId: String(other._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  afterAll(() => {
    for (const rel of written) fs.rmSync(path.join(UPLOADS_ROOT, rel), { force: true });
  });

  const as = (token, r) => r.set('Authorization', `Bearer ${token}`);

  it('stores an uploaded image, lists it signed for the owner only, and deletes it', async () => {
    const up = await as(ownerToken, request(app).post('/api/assets/images'))
      .field('title', 'Logo')
      .attach('image', PNG, { filename: 'logo.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    const img = up.body.data.image;
    expect(img.title).toBe('Logo');
    expect(img.file.url).toMatch(/^\/uploads\/user-images\/[a-f0-9]{32}\.png\?exp=\d+&sig=[a-f0-9]+$/);
    const rel = img.file.url.split('?')[0].replace(/^\/uploads\//, '');
    written.push(rel);
    expect(fs.existsSync(path.join(UPLOADS_ROOT, rel))).toBe(true);

    const mine = await as(ownerToken, request(app).get('/api/assets/images'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.images.map((i) => i._id)).toEqual([img._id]);

    const theirs = await as(otherToken, request(app).get('/api/assets/images'));
    expect(theirs.body.data.images).toEqual([]);
    expect((await as(otherToken, request(app).delete(`/api/assets/images/${img._id}`))).status).toBe(404);

    const del = await as(ownerToken, request(app).delete(`/api/assets/images/${img._id}`));
    expect(del.status).toBe(200);
    expect(await UserImage.countDocuments({})).toBe(0);
  });

  it('rejects non-raster files (SVG, a script renamed .png) with 400, not 500', async () => {
    const svg = await as(ownerToken, request(app).post('/api/assets/images'))
      .attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(svg.status).toBe(400);
    const renamed = await as(ownerToken, request(app).post('/api/assets/images'))
      .attach('image', PNG, { filename: 'x.html', contentType: 'image/png' });
    expect(renamed.status).toBe(400);
    const none = await as(ownerToken, request(app).post('/api/assets/images'));
    expect(none.status).toBe(400);
    expect(await UserImage.countDocuments({})).toBe(0);
  });
});
