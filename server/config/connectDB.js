// Startup database connection, and honest logging of how it went.
//
// initDatabases() gives MongoDB 12 seconds. When connecting takes longer — a cold
// start, or a loaded machine — that timeout fires, initDatabases reports no
// database, and the server used to log "No database connection available …
// Database features will not work". But the connection carried on in the
// background and attached a moment later, so the log described an outage that
// was not happening (seen locally at 14:33:53 → connected 14:33:54).
//
// Now a slow start is reported as waiting, the moment a connection lands is
// logged, and only a database that is STILL missing a minute later is logged as
// an error — so a real outage stays loud and a slow start stops raising one.

const DEFAULT_STILL_DOWN_AFTER_MS = 60000;
const CONNECTED = 1; // mongoose readyState

function createConnectDB({
  initDatabases,
  getDatabaseHealth,
  logger,
  connection,
  stillDownAfterMs = DEFAULT_STILL_DOWN_AFTER_MS,
}) {
  const logConnected = (late) => {
    logger.info(late ? '✅ Database connected (after the startup wait)' : '✅ Database connected successfully');
    logger.info('Database status:', getDatabaseHealth());
  };

  const watchForLateConnection = () => {
    if (!connection) return;
    if (connection.readyState === CONNECTED) {
      logConnected(true);
      return;
    }

    let connected = false;
    if (typeof connection.once === 'function') {
      connection.once('connected', () => {
        connected = true;
        logConnected(true);
      });
    }

    const timer = setTimeout(() => {
      if (!connected && connection.readyState !== CONNECTED) {
        logger.error(`❌ Still no database connection ${Math.round(stillDownAfterMs / 1000)}s after startup — database features are unavailable`);
      }
    }, stillDownAfterMs);
    if (typeof timer.unref === 'function') timer.unref();
  };

  return async function connectDB() {
    try {
      const dbStatus = await initDatabases();

      if (dbStatus.supabase || dbStatus.prisma || dbStatus.mongodb) {
        logConnected(false);
        return dbStatus;
      }

      logger.warn('⚠️ No database connected during startup — serving in degraded mode until one connects');
      watchForLateConnection();
      return dbStatus;
    } catch (err) {
      logger.error('❌ Database connection error:', err);
      logger.warn('⚠️ Starting without a database — serving in degraded mode until one connects');
      watchForLateConnection();
      return null;
    }
  };
}

module.exports = { createConnectDB, DEFAULT_STILL_DOWN_AFTER_MS };
