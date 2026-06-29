const { isRemoteProdUri, redactUri, assertSafeScriptDbUri } = require('../../server/utils/dbSafety');

describe('dbSafety.isRemoteProdUri', () => {
  it('flags Atlas / mongodb+srv URIs as remote/prod', () => {
    expect(isRemoteProdUri('mongodb+srv://u:p@click.abc.mongodb.net/click_v3')).toBe(true);
    expect(isRemoteProdUri('mongodb://shard-0.abc.mongodb.net:27017/click')).toBe(true);
  });
  it('treats localhost / in-memory URIs as safe (not remote)', () => {
    expect(isRemoteProdUri('mongodb://localhost:27017/click')).toBe(false);
    expect(isRemoteProdUri('mongodb://127.0.0.1:27017/click-test')).toBe(false);
    expect(isRemoteProdUri('')).toBe(false);
    expect(isRemoteProdUri(undefined)).toBe(false);
  });
});

describe('dbSafety.redactUri', () => {
  it('strips credentials', () => {
    expect(redactUri('mongodb+srv://user:secret@x.mongodb.net/db')).toBe('mongodb+srv://***@x.mongodb.net/db');
  });
});

describe('dbSafety.assertSafeScriptDbUri', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = ORIGINAL_ENV; });

  it('throws on a remote URI when NODE_ENV is not production and not allowProd', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertSafeScriptDbUri('mongodb+srv://u:p@x.mongodb.net/db', { scriptName: 't' }))
      .toThrow(/refusing to connect to a REMOTE/);
  });
  it('returns a local URI unchanged', () => {
    process.env.NODE_ENV = 'development';
    const uri = 'mongodb://localhost:27017/click';
    expect(assertSafeScriptDbUri(uri, { scriptName: 't' })).toBe(uri);
  });
  it('allows a remote URI under NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    const uri = 'mongodb+srv://u:p@x.mongodb.net/db';
    expect(assertSafeScriptDbUri(uri, { scriptName: 't' })).toBe(uri);
  });
  it('allows a remote URI when the caller opts in with allowProd', () => {
    process.env.NODE_ENV = 'development';
    const uri = 'mongodb+srv://u:p@x.mongodb.net/db';
    expect(assertSafeScriptDbUri(uri, { allowProd: true, scriptName: 't' })).toBe(uri);
  });
});
