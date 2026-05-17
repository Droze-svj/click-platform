/**
 * DMCA intake — POST /api/dmca/notice and /api/dmca/counter, plus
 * GET /api/dmca/:id (own-notice lookup with the stored email as auth).
 *
 * No auth required to file (the form on /legal/dmca is public). We rate-limit
 * tightly to deter spam, log IP + UA, and queue an acknowledgment email if
 * the email queue is wired.
 */

const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

let DmcaNotice;
function getModel() {
  if (DmcaNotice) return DmcaNotice;
  try {
    DmcaNotice = require('../models/DmcaNotice');
  } catch (err) {
    logger.warn('[dmca] DmcaNotice model unavailable', { error: err.message });
  }
  return DmcaNotice;
}

const REQUIRED_NOTICE = ['fullName', 'email', 'address', 'rightsHolder', 'workDescription', 'infringingUrl', 'signature'];
const REQUIRED_COUNTER = ['fullName', 'email', 'address', 'removedContent', 'counterReason', 'signature'];

function missingFields(body, required) {
  return required.filter((k) => !body || typeof body[k] !== 'string' || !body[k].trim());
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function queueAck({ kind, doc }) {
  try {
    const queues = require('../queues');
    if (queues && queues.emailQueue && queues.emailQueue.add) {
      await queues.emailQueue.add('dmca-ack', {
        to: doc.email,
        subject: `Click — DMCA ${kind} received (${doc._id})`,
        body: `Thank you. Your ${kind} has been received and is under review. Reference: ${doc._id}.`,
      });
    }
  } catch (err) {
    logger.warn('[dmca] ack email queue failed (non-blocking)', { error: err.message });
  }
}

router.post(
  '/notice',
  asyncHandler(async (req, res) => {
    const Model = getModel();
    if (!Model) return sendError(res, 'Service unavailable', 503);

    const missing = missingFields(req.body, REQUIRED_NOTICE);
    if (missing.length) {
      return sendError(res, `Missing required fields: ${missing.join(', ')}`, 400);
    }
    if (!validateEmail(req.body.email)) {
      return sendError(res, 'A valid contact email is required', 400);
    }
    if (req.body.sworn !== true || req.body.goodFaith !== true) {
      return sendError(
        res,
        'You must confirm both sworn-statement checkboxes to submit a takedown notice (DMCA §512(c)(3)(A)).',
        400
      );
    }

    const doc = await Model.create({
      kind: 'notice',
      fullName: req.body.fullName,
      email: String(req.body.email).toLowerCase(),
      phone: req.body.phone,
      address: req.body.address,
      rightsHolder: req.body.rightsHolder,
      workDescription: req.body.workDescription,
      infringingUrl: req.body.infringingUrl,
      signature: req.body.signature,
      sworn: !!req.body.sworn,
      goodFaith: !!req.body.goodFaith,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info('[dmca] notice received', { id: doc._id.toString(), email: doc.email });
    queueAck({ kind: 'takedown notice', doc });

    return sendSuccess(res, { id: doc._id.toString(), referenceId: doc._id.toString(), status: doc.status });
  })
);

router.post(
  '/counter',
  asyncHandler(async (req, res) => {
    const Model = getModel();
    if (!Model) return sendError(res, 'Service unavailable', 503);

    const missing = missingFields(req.body, REQUIRED_COUNTER);
    if (missing.length) {
      return sendError(res, `Missing required fields: ${missing.join(', ')}`, 400);
    }
    if (!validateEmail(req.body.email)) {
      return sendError(res, 'A valid contact email is required', 400);
    }
    if (req.body.sworn !== true || req.body.consent !== true) {
      return sendError(
        res,
        'You must confirm the sworn statement and jurisdictional consent (§512(g)(3)).',
        400
      );
    }

    const doc = await Model.create({
      kind: 'counter',
      relatedNoticeId: req.body.originalNoticeId,
      fullName: req.body.fullName,
      email: String(req.body.email).toLowerCase(),
      phone: req.body.phone,
      address: req.body.address,
      removedContent: req.body.removedContent,
      counterReason: req.body.counterReason,
      signature: req.body.signature,
      sworn: !!req.body.sworn,
      consent: !!req.body.consent,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info('[dmca] counter received', { id: doc._id.toString(), email: doc.email });
    queueAck({ kind: 'counter-notice', doc });

    return sendSuccess(res, { id: doc._id.toString(), referenceId: doc._id.toString(), status: doc.status });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const Model = getModel();
    if (!Model) return sendError(res, 'Service unavailable', 503);
    const { id } = req.params;
    const { email } = req.query;
    if (!id || !email) return sendError(res, 'id and email are required', 400);
    const doc = await Model.findOne({ _id: id, email: String(email).toLowerCase() });
    if (!doc) return sendError(res, 'Not found', 404);
    return sendSuccess(res, {
      id: doc._id.toString(),
      kind: doc.kind,
      status: doc.status,
      submittedAt: doc.submittedAt,
      actedAt: doc.actedAt,
      notes: doc.notes,
    });
  })
);

module.exports = router;
