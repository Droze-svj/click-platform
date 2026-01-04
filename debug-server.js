#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5555;
const LOG_PATH = path.join(__dirname, '.cursor/debug.log');

console.log(`Starting NDJSON debug ingest server on port ${PORT}`);
console.log(`Logs will be written to: ${LOG_PATH}`);

// Ensure log directory exists
const logDir = path.dirname(LOG_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/ingest/')) {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const logEntry = JSON.parse(body);
        const ndjsonLine = JSON.stringify(logEntry) + '\n';

        // Append to log file
        fs.appendFileSync(LOG_PATH, ndjsonLine);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (error) {
        console.error('Error processing log entry:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NDJSON debug server listening on http://127.0.0.1:${PORT}`);
  console.log('Ready to receive debug logs...');
});

process.on('SIGINT', () => {
  console.log('Shutting down debug server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down debug server...');
  server.close(() => {
    process.exit(0);
  });
});





