/**
 * server/config/connectDB.js — startup database logging.
 *
 * initDatabases() gives MongoDB 12s. A slower connection used to be logged as
 * "No database connection available … Database features will not work" even
 * though it attached a second later. A slow start is now reported as waiting,
 * the late connection is logged, and only a database still missing after the
 * grace period is an error.
 */

const { EventEmitter } = require('events');
const { createConnectDB } = require('../../server/config/connectDB');

function setup({ status, throws, readyState = 0, stillDownAfterMs = 60000 } = {}) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const connection = Object.assign(new EventEmitter(), { readyState });
  const initDatabases = throws
    ? jest.fn().mockRejectedValue(new Error('boom'))
    : jest.fn().mockResolvedValue(status);
  const getDatabaseHealth = jest.fn(() => ({ status: 'connected' }));
  const connectDB = createConnectDB({ initDatabases, getDatabaseHealth, logger, connection, stillDownAfterMs });
  return { connectDB, logger, connection };
}

const messages = (fn) => fn.mock.calls.map((c) => c[0]);
const NONE = { supabase: false, prisma: false, mongodb: false };

describe('connectDB', () => {
  afterEach(() => jest.useRealTimers());

  it('logs a normal connection and nothing alarming', async () => {
    const { connectDB, logger } = setup({ status: { ...NONE, mongodb: true } });
    await connectDB();
    expect(messages(logger.info)).toContain('✅ Database connected successfully');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('reports a slow start as waiting — not as an outage — then logs the late connection', async () => {
    const { connectDB, logger, connection } = setup({ status: NONE });
    await connectDB();

    expect(messages(logger.warn)).toEqual([expect.stringMatching(/degraded mode until one connects/)]);
    expect(logger.error).not.toHaveBeenCalled();

    connection.readyState = 1;
    connection.emit('connected');
    expect(messages(logger.info)).toContain('✅ Database connected (after the startup wait)');
  });

  it('does not raise the error once the database has connected', async () => {
    jest.useFakeTimers();
    const { connectDB, logger, connection } = setup({ status: NONE });
    await connectDB();
    connection.readyState = 1;
    connection.emit('connected');
    jest.advanceTimersByTime(60000);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('escalates to an error when the database is still missing after the grace period', async () => {
    jest.useFakeTimers();
    const { connectDB, logger } = setup({ status: NONE });
    await connectDB();

    jest.advanceTimersByTime(59999);
    expect(logger.error).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(messages(logger.error)).toEqual([expect.stringMatching(/Still no database connection 60s after startup/)]);
  });

  it('logs straight away when the connection landed just before the check', async () => {
    const { connectDB, logger } = setup({ status: NONE, readyState: 1 });
    await connectDB();
    expect(messages(logger.info)).toContain('✅ Database connected (after the startup wait)');
  });

  it('never throws when initialisation itself fails, and still watches for a connection', async () => {
    const { connectDB, logger, connection } = setup({ throws: true });
    await expect(connectDB()).resolves.toBeNull();
    expect(messages(logger.error)[0]).toMatch(/Database connection error/);

    connection.readyState = 1;
    connection.emit('connected');
    expect(messages(logger.info)).toContain('✅ Database connected (after the startup wait)');
  });
});
