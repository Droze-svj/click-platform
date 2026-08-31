// Report Scheduler Service

/**
 * Schedule a recurring report.
 *
 * NOT AVAILABLE — and it now says so instead of pretending.
 *
 * What this function used to do: build a `scheduledJob` object, never register
 * it anywhere (the jobSchedulerService call was commented out), generate the
 * report ONCE, throw the result away, walk the recipient list with the
 * `sendEmail` call also commented out, log "Scheduled report generated and
 * sent", and return `{ success: true, jobId }`. Nothing was scheduled, nothing
 * was delivered, and nothing was stored — but the caller was told a recurring
 * report was set up and that recipients had been emailed.
 *
 * That is the same class of lie as a publish that reports success without
 * posting, which this codebase deliberately does not do. Making it real needs a
 * repeatable BullMQ job plus report-attachment email templates; until that
 * exists, failing honestly is the correct behaviour.
 *
 * On-demand reports DO work: POST /api/reports/generate (report-builder).
 */
async function scheduleReport() {
  const err = new Error(
    'Scheduled reports are not implemented yet — nothing would be delivered. ' +
    'Generate a report on demand with POST /api/reports/generate.'
  );
  err.statusCode = 501;
  throw err;
}

// getCronSchedule() and getRecipientEmail() lived here. They were the only
// remaining pieces of the unimplemented scheduling path — a cron-expression
// builder for a cron nobody registers, and an email lookup for a mail that was
// never sent. Removed with the rest of it; whoever implements scheduling for
// real will want them shaped around the job runner they choose, not these.

/**
 * Cancel scheduled report
 */
async function cancelScheduledReport() {
  // There is nothing to cancel: scheduleReport never registered a job. Returning
  // { success: true } made "cancel" look like it had undone something.
  const err = new Error('Scheduled reports are not implemented yet — there is nothing to cancel.');
  err.statusCode = 501;
  throw err;
}

async function getScheduledReports() {
  // Honest and correct as-is: no report has ever been scheduled, so the list is
  // empty. Kept returning [] rather than 501 so a client that polls this can
  // render an empty state instead of an error.
  return [];
}

module.exports = {
  scheduleReport,
  cancelScheduledReport,
  getScheduledReports,
};

