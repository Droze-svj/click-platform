// A reply with no platform comment id has nothing to reply TO. Drafts made
// from pasted comments (Comment triage) carry none; sending one used to call
// the platform with `undefined` and record an opaque 'failed'.
const connectTestDb = require('../helpers/connectTestDb');
const SocialReply = require('../../server/models/SocialReply');
const responder = require('../../server/services/socialResponderService');

beforeAll(async () => { await connectTestDb(); });
afterEach(async () => { await SocialReply.deleteMany({}); });

describe('sendApprovedReply without a platform comment id', () => {
  const prev = process.env.SOCIAL_REPLY_SEND;
  beforeAll(() => { process.env.SOCIAL_REPLY_SEND = 'true'; });
  afterAll(() => { if (prev === undefined) delete process.env.SOCIAL_REPLY_SEND; else process.env.SOCIAL_REPLY_SEND = prev; });

  it('refuses with 422 before calling the platform and keeps the reply approved', async () => {
    const doc = await SocialReply.create({
      userId: 'u1', platform: 'instagram', inboundText: 'love it', draftReply: 'Thank you!', status: 'approved',
    });
    const sender = jest.fn();
    await expect(responder.sendApprovedReply('u1', doc._id, sender)).rejects.toMatchObject({ statusCode: 422 });
    expect(sender).not.toHaveBeenCalled();
    expect((await SocialReply.findById(doc._id).lean()).status).toBe('approved');
  });

  it('sends when the comment id is there', async () => {
    const doc = await SocialReply.create({
      userId: 'u1', platform: 'instagram', inboundText: 'love it', draftReply: 'Thank you!', status: 'approved', externalCommentId: 'c1',
    });
    const sender = jest.fn().mockResolvedValue({ ok: true });
    const sent = await responder.sendApprovedReply('u1', doc._id, sender);
    expect(sender).toHaveBeenCalledWith('u1', 'instagram', 'c1', 'Thank you!');
    expect(sent.status).toBe('sent');
  });
});
