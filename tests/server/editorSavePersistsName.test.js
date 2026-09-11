// useVideoEditorAutosave sends { videoId, name, folderId, editorState } on every
// save. The handler destructured only { videoId, editorState }.
//
// The effect was subtle rather than absent: the project name is ALSO stored
// inside editorState, which is saved — so the editor read the new name back and
// looked correct, while Content.title (what the library, search and every list
// render) kept the old one. folderId was dropped outright, so filing a project
// into a folder from the editor did nothing at all.

const request = require('supertest');
const app = require('../../server/index');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');
const jwt = require('jsonwebtoken');

describe('POST /api/video/editor/save', () => {
  let user; let token; let content;

  beforeEach(async () => {
    user = await User.findOneAndUpdate(
      { email: 'editor-save@example.com' },
      { $setOnInsert: { password: 'password123', name: 'Editor', emailVerified: true } },
      { new: true, upsert: true }
    );
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    content = await Content.create({
      userId: user._id, title: 'Old name', type: 'video', status: 'completed',
    });
  });

  afterEach(async () => {
    await Content.deleteMany({ userId: user._id });
    await User.deleteMany({ email: 'editor-save@example.com' });
  });

  it('persists a renamed project to Content.title', async () => {
    const res = await request(app)
      .post('/api/video/editor/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ videoId: String(content._id), name: 'New name', editorState: { projectName: 'New name' } });

    expect(res.status).toBe(200);
    const after = await Content.findById(content._id).lean();
    expect(after.title).toBe('New name');
    expect(after.editorState).toEqual({ projectName: 'New name' });
  });

  it('persists folderId', async () => {
    const folderId = '6a9500000000000000000001';
    await request(app)
      .post('/api/video/editor/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ videoId: String(content._id), folderId, editorState: {} })
      .expect(200);

    const after = await Content.findById(content._id).lean();
    expect(String(after.folderId)).toBe(folderId);
  });

  it('does not blank an existing title when name is omitted', async () => {
    // Autosave omits `name` for an untitled project; an absent field must not
    // wipe a title the user set earlier.
    await request(app)
      .post('/api/video/editor/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ videoId: String(content._id), editorState: { a: 1 } })
      .expect(200);

    const after = await Content.findById(content._id).lean();
    expect(after.title).toBe('Old name');
  });
});
