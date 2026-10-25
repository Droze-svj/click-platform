/**
 * "Save to Library" from the editor's export panel.
 *
 * The client sends the render URL it was given, which is signed
 * ("/uploads/exports/x.mp4?exp=…&sig=…"). The service stripped the query only
 * from absolute http URLs, and the global sanitizer HTML-escaped the "/"s, so
 * the file was never found and every save failed.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const SavedExport = require('../../../server/models/SavedExport');
const { signMediaUrl } = require('../../../server/utils/mediaUrlSigner');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { resolveExportPath } = require('../../../server/services/savedExportService');
const database = require('../../../server/config/database');

describe('POST /api/video/manual-editing/saved-exports', () => {
  let owner, other, content, token, otherToken;
  const name = `render-saved-${Date.now()}.mp4`;
  const rel = `/uploads/exports/${name}`;
  const abs = path.join(__dirname, '../../../uploads/exports', name);

  let healthSpy;

  beforeAll(async () => {
    // guardOwnership → resolveContent only queries Mongo once the app's DB
    // status says it is connected; the in-memory test DB never flips it.
    healthSpy = jest.spyOn(database, 'getDatabaseHealth').mockReturnValue({ status: 'connected', mongodb: true });
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.alloc(32));
    owner = await new User({ email: 'saved-export@example.com', password: 'password123', name: 'O', emailVerified: true }).save();
    other = await new User({ email: 'saved-export-2@example.com', password: 'password123', name: 'X', emailVerified: true }).save();
    token = jwt.sign({ userId: owner._id }, getJwtSecret(), { expiresIn: '1h' });
    otherToken = jwt.sign({ userId: other._id }, getJwtSecret(), { expiresIn: '1h' });
    content = await new Content({ userId: String(owner._id), type: 'video', title: 'Src', status: 'completed' }).save();
  });

  afterAll(async () => {
    healthSpy.mockRestore();
    try { fs.unlinkSync(abs); } catch (_) { /* gone */ }
    const saved = await SavedExport.find({ contentId: content._id }).lean();
    for (const s of saved) {
      try { fs.unlinkSync(path.join(__dirname, '../../../uploads', s.filePath)); } catch (_) { /* gone */ }
    }
    try { fs.rmSync(path.join(__dirname, '../../../uploads/saved-exports', String(owner._id)), { recursive: true, force: true }); } catch (_) { /* gone */ }
    await SavedExport.deleteMany({ contentId: content._id });
    await Content.deleteOne({ _id: content._id });
    await User.deleteMany({ _id: { $in: [owner._id, other._id] } });
  });

  const post = (tok, body) => request(app)
    .post('/api/video/manual-editing/saved-exports')
    .set('Authorization', `Bearer ${tok}`)
    .send(body);

  it('saves a signed render URL', async () => {
    const res = await post(token, { videoId: String(content._id), exportPath: signMediaUrl(rel), quality: '1080p', title: "Creator's cut" });
    expect(res.status).toBe(200);
    const saved = await SavedExport.findOne({ contentId: content._id }).lean();
    expect(saved).toBeTruthy();
    expect(saved.title).toBe("Creator's cut");
    expect(fs.existsSync(path.join(__dirname, '../../../uploads', saved.filePath))).toBe(true);
  });

  it("refuses to file an export under someone else's video", async () => {
    const res = await post(otherToken, { videoId: String(content._id), exportPath: signMediaUrl(rel) });
    expect(res.status).toBe(403);
  });

  it('keeps the path contained in uploads/', () => {
    expect(resolveExportPath('/uploads/../../.env')).toBeNull();
    expect(resolveExportPath('/uploads/exports/a.mp4?exp=1&sig=x')).toBe(path.resolve(__dirname, '../../../uploads/exports/a.mp4'));
    expect(resolveExportPath('exports/a.mp4#t=1')).toBe(path.resolve(__dirname, '../../../uploads/exports/a.mp4'));
  });
});
