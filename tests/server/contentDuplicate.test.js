// POST /api/content/:contentId/duplicate returned 400 for EVERY item.
//
// It built the copy with `status: 'draft'`, which is not in the Content status
// enum (uploading|processing|completed|failed), so Mongoose rejected the save
// before anything else could happen. It also copied `text` and `folder` —
// neither is a Content path (the field is `folderId`) — and Mongoose drops
// undeclared paths silently, so those were lost regardless.
//
// The endpoint sweeps could not catch it: the write sweep addresses routes with
// throwaway ids, which 404 at the ownership lookup before reaching the create.
// It takes a real, owned document to reach the bug.

const request = require('supertest');
const app = require('../../server/index');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');
const jwt = require('jsonwebtoken');

describe('content duplication', () => {
  let user; let token;

  beforeEach(async () => {
    user = await User.findOneAndUpdate(
      { email: 'content-duplicate@example.com' },
      { $setOnInsert: { password: 'password123', name: 'Dup', emailVerified: true } },
      { new: true, upsert: true }
    );
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  });

  afterEach(async () => {
    await Content.deleteMany({ userId: user._id });
    await User.deleteMany({ email: 'content-duplicate@example.com' });
  });

  it('duplicates a real item and carries its fields across', async () => {
    const original = await Content.create({
      userId: user._id,
      title: 'Original',
      description: 'A description',
      type: 'video',
      status: 'completed',
      tags: ['alpha', 'beta'],
      category: 'tutorial',
      transcript: 'spoken words',
    });

    const res = await request(app)
      .post(`/api/content/${original._id}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);

    const copies = await Content.find({ userId: user._id, _id: { $ne: original._id } });
    expect(copies).toHaveLength(1);
    const copy = copies[0];

    expect(copy.title).toBe('Original (Copy)');
    expect(copy.description).toBe('A description');
    expect(copy.tags).toEqual(['alpha', 'beta']);
    expect(copy.category).toBe('tutorial');
    // Carried, not dropped by strict mode.
    expect(copy.transcript).toBe('spoken words');
    // A copy starts in the same state as its source.
    expect(copy.status).toBe('completed');
  });
});
