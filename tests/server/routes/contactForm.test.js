// The contact page offered mailto links on clickapp.io, a domain that doesn't
// exist: every message bounced. Messages are now stored and listed for admins.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const app = require('../../../server/index');
const ContactMessage = require('../../../server/models/ContactMessage');

describe('POST /api/contact', () => {
  afterEach(() => ContactMessage.deleteMany({}));

  it('stores a message without an account', async () => {
    const res = await request(app).post('/api/contact')
      .send({ name: 'Ana', email: 'ana@example.com', topic: 'privacy', message: 'Please delete my data, I cannot sign in.' });
    expect(res.status).toBe(201);
    const saved = await ContactMessage.findOne({ email: 'ana@example.com' }).lean();
    expect(saved).toMatchObject({ topic: 'privacy', status: 'new', name: 'Ana' });
  });

  it('refuses a message we could not reply to', async () => {
    const res = await request(app).post('/api/contact').send({ email: 'not-an-email', message: 'Hello there, a question' });
    expect(res.status).toBe(400);
    expect(await ContactMessage.countDocuments({})).toBe(0);
  });

  it('quietly drops honeypot (bot) submissions', async () => {
    const res = await request(app).post('/api/contact')
      .send({ email: 'bot@example.com', message: 'Buy cheap followers now!!!', website: 'http://spam.example' });
    expect(res.status).toBe(201);
    expect(await ContactMessage.countDocuments({})).toBe(0);
  });
});
