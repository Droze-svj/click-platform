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

/**
 * Import from calendar (future feature)
 */
async function importFromCalendar(userId, calendarData, format = 'ics') {
  try {
    // This would parse calendar data and create scheduled posts
    // Implementation depends on calendar format
    logger.info('Calendar import requested', { userId, format });
    return { imported: 0, message: 'Calendar import not yet implemented' };
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


