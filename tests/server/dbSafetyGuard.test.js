// Dev DB-safety guard: a non-production boot must never connect to the remote
// Atlas PRODUCTION database (this is how the June-19 incident wiped users/contents).
// initMongoDB() refuses a remote URI when NODE_ENV !== 'production' and falls back
// to an isolated in-memory DB. Here we lock in the pure detector it relies on.

const { isRemoteProdUri } = require('../../server/config/database');

describe('isRemoteProdUri — remote/Atlas (production) DB detection', () => {
  it('flags Atlas mongodb+srv URIs as remote/prod', () => {
    expect(isRemoteProdUri('mongodb+srv://user:pass@cluster0.ab12c.mongodb.net/click_v3')).toBe(true);
  });

  it('flags any *.mongodb.net host as remote/prod', () => {
    expect(isRemoteProdUri('mongodb://user:pass@cluster0-shard-00-00.ab12c.mongodb.net:27017/click_v3')).toBe(true);
  });

  it('treats localhost / 127.0.0.1 as safe (local) DBs', () => {
    expect(isRemoteProdUri('mongodb://localhost:27017/click_local')).toBe(false);
    expect(isRemoteProdUri('mongodb://127.0.0.1:27017/click_test')).toBe(false);
    expect(isRemoteProdUri('mongodb://user:pass@127.0.0.1:27017/click')).toBe(false);
  });

  it('treats an in-memory MongoMemoryServer URI as safe', () => {
    expect(isRemoteProdUri('mongodb://127.0.0.1:51237/')).toBe(false);
  });

  it('is null/undefined-safe', () => {
    expect(isRemoteProdUri(undefined)).toBe(false);
    expect(isRemoteProdUri('')).toBe(false);
    expect(isRemoteProdUri(null)).toBe(false);
  });
});
