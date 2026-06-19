const mongoose = require('mongoose');
const {
  buildComment, buildRevision, addComment, resolveComment, addRevision,
} = require('../../../server/services/approvalCollaborationService');
const ContentApproval = require('../../../server/models/ContentApproval');

describe('approval collaboration (pure builders)', () => {
  it('buildComment trims + shapes + assigns an id', () => {
    const c = buildComment({ authorName: 'Reviewer', text: '  fix the hook  ', targetField: 'caption' });
    expect(c.text).toBe('fix the hook');
    expect(c.targetField).toBe('caption');
    expect(c.resolved).toBe(false);
    expect(c.id).toMatch(/^cm_/);
  });

  it('buildComment rejects empty text (400)', () => {
    expect(() => buildComment({ text: '   ' })).toThrow(/required/i);
  });

  it('buildRevision increments the version', () => {
    expect(buildRevision(0, { note: 'v1' }).version).toBe(1);
    expect(buildRevision(2, {}).version).toBe(3);
  });
});

describe('approval collaboration (E2E)', () => {
  let approval;
  beforeEach(async () => {
    approval = await ContentApproval.create({
      contentId: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });
  });
  afterEach(async () => { await ContentApproval.deleteMany({}); });

  it('adds + resolves a comment and records a revision', async () => {
    const c = await addComment(approval._id, { authorName: 'R', text: 'tighten intro', targetField: 'title' });
    expect(c.id).toBeTruthy();
    let reloaded = await ContentApproval.findById(approval._id);
    expect(reloaded.comments).toHaveLength(1);

    await resolveComment(approval._id, c.id);
    reloaded = await ContentApproval.findById(approval._id);
    expect(reloaded.comments[0].resolved).toBe(true);

    const rev = await addRevision(approval._id, { note: 'addressed', changes: { title: 'new' } });
    expect(rev.version).toBe(1);
    reloaded = await ContentApproval.findById(approval._id);
    expect(reloaded.revisions).toHaveLength(1);
  });

  it('404 on a missing approval', async () => {
    await expect(addComment(new mongoose.Types.ObjectId().toString(), { text: 'x' }))
      .rejects.toThrow(/not found/i);
  });
});
