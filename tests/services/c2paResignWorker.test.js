jest.mock('../../server/services/c2paService', () => ({
  signRender: jest.fn(),
  persistAuthenticity: jest.fn().mockResolvedValue(null),
}));
const fs = require('fs');
const c2paService = require('../../server/services/c2paService');
const { processC2paResignJob } = require('../../server/workers/c2paResignWorker');

describe('c2paResignWorker.processC2paResignJob', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => { c2paService.signRender.mockReset(); c2paService.persistAuthenticity.mockClear(); });

  it('gives up (no throw) when the source file is gone — retrying cannot help', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const r = await processC2paResignJob({ inputPath: '/gone.mp4', jobId: 'j1' });
    expect(r).toEqual({ resigned: false, reason: 'file-unavailable' });
    expect(c2paService.signRender).not.toHaveBeenCalled();
  });

  it('throws (so BullMQ retries) when the signer is STILL unavailable', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    c2paService.signRender.mockResolvedValue({ signed: false, reason: 'no signer available' });
    await expect(processC2paResignJob({ inputPath: '/x.mp4', jobId: 'j2' })).rejects.toThrow(/signer still unavailable/);
  });

  it('re-signs + persists when the signer recovered', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    c2paService.signRender.mockResolvedValue({ signed: true, signer: 'c2patool', sha256: 'abc', manifest: {} });
    const r = await processC2paResignJob({ inputPath: '/x.mp4', jobId: 'j3', userId: 'u1', contentId: 'c1' });
    expect(r).toEqual({ resigned: true, signer: 'c2patool' });
    expect(c2paService.persistAuthenticity).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'j3', signed: true, signer: 'c2patool' }));
  });
});
