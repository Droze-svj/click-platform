// User text must be stored exactly as typed. The global input sanitizer used
// to HTML-escape every body string, so a scheduled post "Tom's tips & tricks"
// was saved — and would have been published — as `Tom&#x27;s tips &amp; tricks`.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { escape: htmlEscape } = require('validator');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { sanitizeRequestValue } = require('../../../server/utils/inputSanitizer');
const { escapeHtml } = require('../../../server/utils/escapeHtml');

describe('request text is stored as typed', () => {
  it('keeps punctuation and URLs, drops Mongo operators', () => {
    const out = sanitizeRequestValue({
      text: "  Tom's tips & tricks <3 \"quoted\"  ",
      url: 'https://x.com/a?b=1&c=2',
      $where: 'sleep(1)',
      nested: { $gt: '', ok: 1, list: [{ $ne: null, v: 'a/b' }] },
    });
    expect(out).toEqual({
      text: 'Tom\'s tips & tricks <3 "quoted"',
      url: 'https://x.com/a?b=1&c=2',
      nested: { ok: 1, list: [{ v: 'a/b' }] },
    });
  });

  it('a saved draft keeps its text through the full middleware stack', async () => {
    const user = await new User({ email: `typed-${Date.now()}@example.com`, password: 'password123', name: 'T', emailVerified: true }).save();
    const token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
    const text = "Tom's tips & tricks — see https://x.com/a?b=1&c=2";
    const put = await request(app).put('/api/drafts/post/typed-1').set('Authorization', `Bearer ${token}`)
      .send({ state: { caption: text }, revision: 0 });
    expect(put.status).toBeLessThan(300);
    const got = await request(app).get('/api/drafts/post/typed-1').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(got.body)).toContain(JSON.stringify(text).slice(1, -1));
  });

  it('escapeHtml escapes for output and does not double-escape legacy rows', () => {
    expect(escapeHtml('<b>Tom\'s</b>')).toBe('&lt;b&gt;Tom&#39;s&lt;/b&gt;');
    expect(escapeHtml('Tom&#x27;s &amp; co')).toBe('Tom&#39;s &amp; co');
  });
});

describe('passwords hashed from the old escaped input still sign in', () => {
  it('accepts the legacy hash once, then re-hashes the typed password', async () => {
    const typed = "S3cret&pass/word'!";
    const email = `legacy-${Date.now()}@example.com`;
    const user = await new User({ email, password: 'placeholder1', name: 'L', emailVerified: true }).save();
    // What the June–October sanitizer produced before hashing.
    await User.updateOne({ _id: user._id }, { $set: { password: await bcrypt.hash(htmlEscape(typed), 10) } });

    const doc = await User.findById(user._id);
    expect(await doc.comparePassword(typed)).toBe(true);
    const after = await User.findById(user._id).lean();
    expect(await bcrypt.compare(typed, after.password)).toBe(true);
    expect(await doc.comparePassword('wrong-password')).toBe(false);
  });
});
