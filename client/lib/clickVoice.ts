/**
 * ClickVoice — the centralized character voice for Click.
 *
 * Every loading spinner, empty state, error banner, and success toast in
 * the app should pull copy from here instead of inlining strings. That way
 * the persona reads as ONE coherent character across the whole product
 * instead of 50 different writers' approximations of "friendly AI."
 *
 * Design rules (read before adding variants):
 *  1. Click is a creator coach — slightly witty, never apologetic in a
 *     corporate way ("Sorry for the inconvenience" is banned).
 *  2. Click talks about what *it* is doing, not what the *system* is
 *     doing ("Click is analyzing your style…", not "Loading…").
 *  3. Click learns. Reference that arc when it's true ("Click locked
 *     that in", "Click noticed…"). Never fake it for messages that
 *     aren't actually using the learned profile.
 *  4. Errors are partnership moments, not blame. "Click hit a snag, but
 *     we can fix it together" not "An error occurred."
 *  5. Never include the user's name in error/loading copy — it makes
 *     bugs feel personal in a bad way.
 *
 * Variants rotate deterministically per-session-and-intent (see
 * pickVariant) so the same page on the same load doesn't flicker between
 * messages, but a refresh feels alive.
 */

type ClickIntent =
  // Process states
  | 'loading'
  | 'loading.thinking'
  | 'loading.analyzing'
  | 'loading.rendering'
  | 'loading.publishing'
  | 'loading.learning'
  // Empty states (one per surface, since the right copy depends on context)
  | 'empty.posts'
  | 'empty.clips'
  | 'empty.scripts'
  | 'empty.scheduled'
  | 'empty.library'
  | 'empty.achievements'
  | 'empty.analytics'
  | 'empty.generic'
  // Error states
  | 'error'
  | 'error.network'
  | 'error.notFound'
  // Success states
  | 'success.publish'
  | 'success.save'
  | 'success.learned'
  // Ambient presence — what Click is "doing" in the dashboard header
  | 'presence.idle'
  | 'presence.learning'
  | 'presence.drafting'
  | 'presence.rendering';

const COPY: Record<ClickIntent, string[]> = {
  // Loading
  loading: [
    'Click is thinking…',
    'Working on it — give Click a second.',
    'Firing up the forge…',
  ],
  'loading.thinking': [
    'Click is thinking…',
    'Letting the model cook on this one.',
    'Click is sketching the angle…',
  ],
  'loading.analyzing': [
    'Click is reading your style…',
    'Pulling patterns from your last clips…',
    'Click is comparing this to what your audience usually loves…',
  ],
  'loading.rendering': [
    'Click is rendering the export…',
    'Stitching the frames together — hang tight.',
    'Click is exporting in your aspect ratio…',
  ],
  'loading.publishing': [
    'Click is publishing — almost there…',
    'Pushing to your connected platforms…',
    'Click is queueing this up across your channels…',
  ],
  'loading.learning': [
    'Click is locking that pick into your style…',
    'Click is updating your taste graph…',
    'Filing this away so Click suggests it next time…',
  ],

  // Empty
  'empty.posts': [
    'No posts yet. Click is ready to craft something the second you upload footage.',
    'Your post feed is blank — drop in a long-form video and Click will take it from there.',
  ],
  'empty.clips': [
    'No clips yet. Run the Forge on a video and Click will surface the best moments.',
    'Click hasn\'t made any clips for you yet. Upload a video to give it something to work with.',
  ],
  'empty.scripts': [
    'No scripts saved. Tell Click what you want to talk about and it\'ll draft one for you.',
  ],
  'empty.scheduled': [
    'Nothing scheduled. When you queue a post, Click watches the calendar and pushes it at the right time.',
  ],
  'empty.library': [
    'Library\'s empty. Upload assets and Click will pull from them when you edit.',
  ],
  'empty.achievements': [
    'No achievements yet — but Click is watching. Ship your first clip to start unlocking them.',
  ],
  'empty.analytics': [
    'Not enough data for Click to read patterns yet. Publish a few clips and the insights will sharpen.',
  ],
  'empty.generic': [
    'Nothing here yet. Click is ready when you are.',
  ],

  // Error
  error: [
    'Click hit a snag, but we can fix it together.',
    'Something broke on Click\'s end — your work is safe. Let\'s try again.',
    'Click ran into a problem. Nothing\'s lost — just need a retry.',
  ],
  'error.network': [
    'Click can\'t reach the server right now. Check your connection and Click will pick up where it left off.',
    'Looks like the network dropped. Click is waiting — try again when you\'re back.',
  ],
  'error.notFound': [
    'Click can\'t find that. Either it\'s been deleted or the link\'s off — head back and try again.',
  ],

  // Success
  'success.publish': [
    'Shipped. Click is watching what lands.',
    'Live. Click locked in what worked about this one.',
    'Posted. Click will use this to sharpen the next suggestion.',
  ],
  'success.save': [
    'Saved.',
    'Click filed it away.',
    'Locked in.',
  ],
  'success.learned': [
    'Click locked that into your style.',
    'Click noticed — that\'s your DNA now.',
    'Learned. Click will lean into this next time.',
  ],

  // Presence
  'presence.idle': [
    'Standing by.',
    'Ready when you are.',
  ],
  'presence.learning': [
    'Learning from your last clip…',
    'Updating your taste graph…',
  ],
  'presence.drafting': [
    'Drafting captions…',
    'Working on hooks…',
  ],
  'presence.rendering': [
    'Rendering in the background…',
    'Working on the export…',
  ],
};

/**
 * Deterministic-per-session variant picker. Uses a stable per-page counter
 * so two renders of the same component on the same page show the same
 * message, but a refresh or a new mount rotates. The randomness is
 * crypto-free on purpose — we don't need unpredictability, we need variety.
 */
function pickVariant(intent: ClickIntent, seedHint?: string | number): string {
  const variants = COPY[intent] ?? COPY['loading'];
  if (variants.length === 1) return variants[0];

  // Stable seed: combine intent + optional hint + a per-session salt so
  // the same intent stays consistent during a render but varies session-
  // over-session.
  const sessionSalt =
    typeof window !== 'undefined'
      ? Number(window.sessionStorage?.getItem('click:voiceSalt')) || 0
      : 0;
  const hint =
    typeof seedHint === 'number'
      ? seedHint
      : typeof seedHint === 'string'
        ? seedHint.length
        : 0;
  const i = Math.abs(hashString(intent) + hint + sessionSalt) % variants.length;
  return variants[i];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

if (typeof window !== 'undefined' && !window.sessionStorage?.getItem('click:voiceSalt')) {
  window.sessionStorage?.setItem('click:voiceSalt', String(Math.floor(Math.random() * 1000)));
}

/**
 * Main entry point. Use this anywhere you'd otherwise write a hardcoded
 * "Loading…" / "No items" / "Something went wrong" string.
 *
 * @param intent  the message category — see ClickIntent
 * @param seedHint optional value to influence which variant is picked.
 *                 Pass a stable id (e.g. `contentId`) when you want the
 *                 same item to consistently show the same message.
 */
export function clickVoice(intent: ClickIntent, seedHint?: string | number): string {
  return pickVariant(intent, seedHint);
}

export type { ClickIntent };
