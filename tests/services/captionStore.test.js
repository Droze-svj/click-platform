const mongoose = require('mongoose');
const Content = require('../../server/models/Content');
const Caption = require('../../server/models/Caption');
const captionStore = require('../../server/services/captionStore');

async function makeContent(captions) {
  return Content.create({
    userId: new mongoose.Types.ObjectId(),
    type: 'video',
    title: 'cap-test',
    ...(captions ? { captions } : {}),
  });
}

describe('captionStore', () => {
  afterEach(async () => {
    await Promise.all([Caption.deleteMany({}), Content.deleteMany({})]);
  });

  it('saveSource writes a Caption doc and keeps Content slim (no heavy arrays embedded)', async () => {
    const content = await makeContent();
    await captionStore.saveSource(content._id, {
      language: 'EN',
      format: 'srt',
      text: 'hello world',
      segments: [{ start: 0, end: 1, text: 'hello world' }],
      words: [{ word: 'hello', start: 0, end: 0.5 }, { word: 'world', start: 0.5, end: 1 }],
      formatted: '1\n00:00:00,000 --> 00:00:01,000\nhello world\n',
    });

    const doc = await Caption.findOne({ contentId: content._id, isSource: true }).lean();
    expect(doc).toBeTruthy();
    expect(doc.language).toBe('en'); // lowercased
    expect(doc.words).toHaveLength(2);

    const fresh = await Content.findById(content._id).lean();
    expect(fresh.captions.text).toBe('hello world'); // slim marker kept
    expect(fresh.captions.language).toBe('en');
    expect(fresh.captions.words || []).toHaveLength(0); // heavy arrays NOT embedded
    expect(fresh.captions.segments || []).toHaveLength(0);
  });

  it('getSource / getWords / getSegments / getText read from the collection', async () => {
    const content = await makeContent();
    await captionStore.saveSource(content._id, {
      language: 'en', text: 'a b', segments: [{ start: 0, end: 1, text: 'a b' }],
      words: [{ word: 'a', start: 0, end: 0.5 }, { word: 'b', start: 0.5, end: 1 }],
    });
    const src = await captionStore.getSource(content._id);
    expect(src.language).toBe('en');
    expect(await captionStore.getWords(content._id)).toHaveLength(2);
    expect(await captionStore.getSegments(content._id)).toHaveLength(1);
    expect(await captionStore.getText(content._id)).toBe('a b');
    expect(await captionStore.hasCaptions(content._id)).toBe(true);
  });

  it('FALLS BACK to embedded Content.captions when no Caption doc exists (un-migrated)', async () => {
    const content = await makeContent({
      text: 'legacy text',
      language: 'es',
      format: 'srt',
      segments: [{ start: 0, end: 2, text: 'legacy text' }],
      words: [{ word: 'legacy', start: 0, end: 1 }, { word: 'text', start: 1, end: 2 }],
      formatted: 'legacy.srt',
    });
    // No Caption document — must read through to the embedded data.
    const src = await captionStore.getSource(content._id);
    expect(src).toBeTruthy();
    expect(src.text).toBe('legacy text');
    expect(src.language).toBe('es');
    expect(await captionStore.getWords(content._id)).toHaveLength(2);
    expect(await captionStore.hasCaptions(content._id)).toBe(true);
  });

  it('saveTranslation + getInLanguage returns the translated caption', async () => {
    const content = await makeContent();
    await captionStore.saveSource(content._id, { language: 'en', text: 'hi', segments: [{ start: 0, end: 1, text: 'hi' }] });
    await captionStore.saveTranslation(content._id, 'ES', {
      text: 'hola', segments: [{ start: 0, end: 1, text: 'hola' }], formatted: 'hola.srt',
    });
    const es = await captionStore.getInLanguage(content._id, 'es');
    expect(es.text).toBe('hola');
    expect(es.isSource).toBe(false);
    // source still resolves
    const en = await captionStore.getInLanguage(content._id, 'en');
    expect(en.text).toBe('hi');
    expect(await captionStore.hasTranslation(content._id, 'es')).toBe(true);
    expect(await captionStore.hasTranslation(content._id, 'fr')).toBe(false);
  });

  it('getInLanguage falls back to embedded translations for un-migrated content', async () => {
    const content = await makeContent({
      text: 'source', language: 'en', format: 'srt',
      segments: [{ start: 0, end: 1, text: 'source' }],
      translations: { fr: { text: 'la source', segments: [{ start: 0, end: 1, text: 'la source' }], formatted: 'fr.srt' } },
    });
    const fr = await captionStore.getInLanguage(content._id, 'fr');
    expect(fr).toBeTruthy();
    expect(fr.text).toBe('la source');
    expect(fr.isSource).toBe(false);
    const en = await captionStore.getInLanguage(content._id, 'en');
    expect(en.text).toBe('source');
  });

  it('returns null/empty for content with no captions anywhere', async () => {
    const content = await makeContent();
    expect(await captionStore.getSource(content._id)).toBeNull();
    expect(await captionStore.getWords(content._id)).toEqual([]);
    expect(await captionStore.hasCaptions(content._id)).toBe(false);
  });
});
