// Calendar Integration Service
// Integrates with external calendars (Google Calendar, Outlook, etc.)

const logger = require('../utils/logger');
const ScheduledPost = require('../models/ScheduledPost');

/**
 * Export schedule to calendar format (ICS)
 */
async function exportToCalendar(userId, options = {}) {
  try {
    const {
      startDate,
      endDate,
      platforms = null,
      format = 'ics'
    } = options;

    const query = {
      userId,
      status: { $in: ['scheduled', 'pending'] }
    };

    if (startDate) {
      query.scheduledTime = { $gte: new Date(startDate) };
    }
    if (endDate) {
      query.scheduledTime = { ...query.scheduledTime, $lte: new Date(endDate) };
    }
    if (platforms && platforms.length > 0) {
      query.platform = { $in: platforms };
    }

    const posts = await ScheduledPost.find(query)
      .populate('contentId', 'title description')
      .sort({ scheduledTime: 1 })
      .lean();

    if (format === 'ics') {
      return generateICSFile(posts);
    } else if (format === 'json') {
      return generateJSONCalendar(posts);
    }

    throw new Error('Unsupported calendar format');
  } catch (error) {
    logger.error('Error exporting to calendar', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate ICS file content
 */
function generateICSFile(posts) {
  let ics = 'BEGIN:VCALENDAR\n';
  ics += 'VERSION:2.0\n';
  ics += 'PRODID:-//Click//Content Scheduler//EN\n';
  ics += 'CALSCALE:GREGORIAN\n';
  ics += 'METHOD:PUBLISH\n';

  posts.forEach(post => {
    const start = formatICSDate(post.scheduledTime);
    const end = new Date(post.scheduledTime);
    end.setHours(end.getHours() + 1);
    const endStr = formatICSDate(end);

    const title = post.contentId?.title || post.content?.text || 'Scheduled Post';
    const description = `Platform: ${post.platform}\n${post.contentId?.description || ''}`;

    ics += 'BEGIN:VEVENT\n';
    ics += `UID:${post._id}@click.app\n`;
    ics += `DTSTART:${start}\n`;
    ics += `DTEND:${endStr}\n`;
    ics += `SUMMARY:${escapeICS(title)}\n`;
    ics += `DESCRIPTION:${escapeICS(description)}\n`;
    ics += `LOCATION:${post.platform}\n`;
    ics += 'STATUS:CONFIRMED\n';
    ics += 'SEQUENCE:0\n';
    ics += 'END:VEVENT\n';
  });

  ics += 'END:VCALENDAR\n';
  return ics;
}

/**
 * Format date for ICS
 */
function formatICSDate(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text for ICS
 */
function escapeICS(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .substring(0, 200);
}

/**
 * Generate JSON calendar format
 */
function generateJSONCalendar(posts) {
  return {
    version: '1.0',
    events: posts.map(post => ({
      id: post._id.toString(),
      title: post.contentId?.title || post.content?.text || 'Scheduled Post',
      description: post.contentId?.description || '',
      start: post.scheduledTime.toISOString(),
      end: new Date(post.scheduledTime.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
      platform: post.platform,
      status: post.status,
      contentId: post.contentId?._id?.toString(),
      timezone: post.timezone || 'UTC'
    }))
  };
}

const ICS_PLATFORMS = new Set([
  'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin',
  'facebook', 'pinterest', 'threads', 'snapchat', 'reddit',
]);

/** Undo RFC 5545 line folding: a CRLF followed by a space/tab continues the line. */
function unfoldICS(text) {
  return String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/** Reverse of escapeICS. */
function unescapeICS(value) {
  return String(value)
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Parse an ICS date (basic UTC/local form or a DATE value) to a Date, or null. */
function parseICSDate(value) {
  if (!value) return null;
  const v = String(value).trim();
  // 20260830T140000Z  |  20260830T140000  |  20260830
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) {
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Extract VEVENTs from an ICS document.
 * Property names may carry parameters (DTSTART;TZID=...), so the key is taken
 * up to the first ';' or ':'.
 */
function parseICS(text) {
  const lines = unfoldICS(text).split(/\r?\n/);
  const events = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') { current = {}; continue; }
    if (trimmed === 'END:VEVENT') { if (current) events.push(current); current = null; continue; }
    if (!current) continue;

    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const rawKey = trimmed.slice(0, colon);
    const value = trimmed.slice(colon + 1);
    const key = rawKey.split(';')[0].toUpperCase();
    current[key] = value;
  }

  return events;
}

/**
 * Import scheduled posts from calendar data.
 *
 * Accepts the same ICS this service exports (round-trip), plus the JSON shape
 * from generateJSONCalendar. Each VEVENT becomes a draft ScheduledPost at the
 * event's start time.
 *
 * Events are imported as 'pending_approval', never 'scheduled': importing a
 * calendar file must not silently queue posts to a user's real social accounts.
 * The publish cron only picks up 'scheduled', so an imported post cannot fire
 * until a human approves it.
 *
 * @param {string} userId
 * @param {string|object} calendarData raw ICS text, or parsed JSON
 * @param {string} format 'ics' | 'json'
 * @returns {Promise<{imported:number, skipped:Array, posts:Array}>}
 */
async function importFromCalendar(userId, calendarData, format = 'ics') {
  try {
    if (!userId) throw new Error('userId is required');
    if (!calendarData) throw new Error('calendarData is required');

    const ScheduledPost = require('../models/ScheduledPost');

    let entries;
    if (format === 'json') {
      const parsed = typeof calendarData === 'string' ? JSON.parse(calendarData) : calendarData;
      entries = (parsed.events || []).map((e) => ({
        title: e.title,
        start: e.start,
        platform: e.platform,
        description: e.description,
      }));
    } else if (format === 'ics') {
      entries = parseICS(calendarData).map((e) => ({
        title: unescapeICS(e.SUMMARY || ''),
        start: parseICSDate(e.DTSTART),
        // exportToCalendar writes the platform into LOCATION; fall back to the
        // DESCRIPTION's "Platform: x" line for files from elsewhere.
        platform: (e.LOCATION || (unescapeICS(e.DESCRIPTION || '').match(/Platform:\s*(\w+)/i) || [])[1] || '').toLowerCase(),
        description: unescapeICS(e.DESCRIPTION || ''),
      }));
    } else {
      throw new Error(`Unsupported calendar format: ${format}`);
    }

    const skipped = [];
    const toCreate = [];

    for (const entry of entries) {
      const when = entry.start instanceof Date ? entry.start : parseICSDate(entry.start);
      if (!when) {
        skipped.push({ title: entry.title || '(untitled)', reason: 'missing or unparseable start time' });
        continue;
      }
      const platform = String(entry.platform || '').toLowerCase();
      if (!ICS_PLATFORMS.has(platform)) {
        // platform is a required enum on ScheduledPost — importing without one
        // would throw a ValidationError mid-loop and abort the whole import.
        skipped.push({ title: entry.title || '(untitled)', reason: `unsupported or missing platform "${entry.platform || ''}"` });
        continue;
      }

      toCreate.push({
        userId: String(userId),
        platform,
        scheduledTime: when,
        status: 'pending_approval',
        content: { text: entry.title || 'Imported from calendar' },
      });
    }

    const posts = toCreate.length ? await ScheduledPost.insertMany(toCreate, { ordered: false }) : [];

    logger.info('Calendar imported', { userId, format, imported: posts.length, skipped: skipped.length });
    return { imported: posts.length, skipped, posts };
  } catch (error) {
    logger.error('Error importing from calendar', { error: error.message, userId });
    throw error;
  }
}

/**
 * Sync with Google Calendar (future feature)
 */
async function syncWithGoogleCalendar(userId, calendarId) {
  try {
    // This would sync scheduled posts with Google Calendar
    // Requires Google Calendar API integration
    logger.info('Google Calendar sync requested', { userId, calendarId });
    return { synced: false, message: 'Google Calendar sync not yet implemented' };
  } catch (error) {
    logger.error('Error syncing with Google Calendar', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  exportToCalendar,
  importFromCalendar,
  syncWithGoogleCalendar
};


