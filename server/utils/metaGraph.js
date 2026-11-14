/**
 * One place for the Meta Graph API version used by Facebook + Instagram code.
 *
 * The services used to hard-code v18.0 in several files; Meta retires each
 * version about two years after release, and calls to a retired version are
 * silently upgraded, which can change behaviour without warning. Pin one
 * supported version here and override with META_GRAPH_VERSION when Meta
 * deprecates it.
 */
const GRAPH_VERSION = (process.env.META_GRAPH_VERSION || 'v23.0').trim();
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DIALOG_BASE = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

module.exports = { GRAPH_VERSION, GRAPH_BASE, DIALOG_BASE };
