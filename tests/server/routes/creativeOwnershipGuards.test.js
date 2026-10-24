// Every /api/video/creative tool that takes a videoId must check the caller
// owns it. auto-reframe, speed-ramp and eye-contact were missing the guard the
// other creative routes have (eye-contact re-encodes the source by id).

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/video/creative.js'), 'utf8');

function handlerBody(route) {
  const start = src.indexOf(`router.post('${route}'`);
  if (start < 0) return null;
  const next = src.indexOf('router.post(', start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}

describe('creative routes ownership guards', () => {
  for (const route of ['/auto-reframe', '/speed-ramp', '/eye-contact', '/background-swap', '/localize', '/outpaint', '/object-removal']) {
    it(`${route} guards ownership before calling the service`, () => {
      const body = handlerBody(route);
      expect(body).toBeTruthy();
      const guard = body.indexOf('guardOwnership(req, res, videoId)');
      expect(guard).toBeGreaterThan(-1);
      const serviceCall = body.search(/await (creativeTools|aiLocalizationService|aiOutpaintingService)\./);
      expect(serviceCall).toBeGreaterThan(guard);
    });
  }
});
