/**
 * Word/phrase → emoji map for transcript captions.
 * Used to show contextually relevant emojis alongside dialogue for engagement.
 * Match is case-insensitive; longer phrases are checked first.
 */

export interface TranscriptWord {
  word: string
  start: number
  end: number
}

/** [phrase or word, emoji]. Sorted by length desc so "thank you" matches before "thank". */
const MAP: [string, string][] = [
  // Phrases (longer first)
  ['thank you', '🙏'],
  ['thank you so much', '🙏'],
  ['love it', '❤️'],
  ['let me know', '💡'],
  ['check it out', '👀'],
  ['make sure', '✅'],
  ['go ahead', '🚀'],
  ['you know what', '💡'],
  ['no way', '😮'],
  ['oh my god', '😮'],
  ['oh my gosh', '😮'],
  ['i think', '🤔'],
  ['i mean', '🤔'],
  ['so basically', '💡'],
  ['right now', '⚡'],
  ['good luck', '🍀'],
  ['well done', '👏'],
  ['nice one', '👍'],
  ['great job', '👏'],
  ['stay tuned', '👀'],
  ['stay safe', '🤗'],
  ['take care', '🤗'],
  ['see you', '👋'],
  ['talk soon', '💬'],
  ['can’t wait', '🔥'],
  ["can't wait", '🔥'],
  ['so excited', '🤩'],
  ['so happy', '😊'],
  ['so cool', '😎'],
  ['so fun', '🎉'],
  ['so good', '👍'],
  ['so great', '✨'],
  ['so amazing', '🤩'],
  ['so awesome', '🔥'],
  ['really love', '❤️'],
  ['really like', '👍'],
  ['really good', '👍'],
  ['really great', '✨'],
  ['feel free', '🙌'],
  ['drop a', '💬'],
  ['hit that', '👆'],
  ['smash that', '👆'],
  ['share this', '📤'],
  ['save this', '🔖'],
  ['bookmark', '🔖'],
  ['subscribe', '🔔'],
  ['follow', '👣'],
  ['comment', '💬'],
  ['like', '❤️'],
  ['love', '❤️'],
  ['hate', '😤'],
  ['amazing', '🤩'],
  ['awesome', '🔥'],
  ['great', '👍'],
  ['good', '👍'],
  ['bad', '😞'],
  ['perfect', '✨'],
  ['incredible', '🤩'],
  ['beautiful', '😍'],
  ['fantastic', '🌟'],
  ['excellent', '⭐'],
  ['wonderful', '✨'],
  ['happy', '😊'],
  ['sad', '😢'],
  ['excited', '🤩'],
  ['angry', '😤'],
  ['cool', '😎'],
  ['fun', '🎉'],
  ['funny', '😂'],
  ['hilarious', '😂'],
  ['crazy', '🤯'],
  ['insane', '🤯'],
  ['wild', '🔥'],
  ['fire', '🔥'],
  ['yes', '✅'],
  ['yeah', '👍'],
  ['yep', '👍'],
  ['no', '❌'],
  ['nope', '❌'],
  ['maybe', '🤔'],
  ['sure', '👍'],
  ['absolutely', '💯'],
  ['definitely', '💯'],
  ['exactly', '💯'],
  ['totally', '💯'],
  ['literally', '🔥'],
  ['actually', '💡'],
  ['really', '💪'],
  ['think', '🤔'],
  ['know', '💡'],
  ['idea', '💡'],
  ['question', '❓'],
  ['what', '🤔'],
  ['why', '🤔'],
  ['how', '🤔'],
  ['when', '⏰'],
  ['where', '📍'],
  ['thanks', '🙏'],
  ['please', '🙏'],
  ['hello', '👋'],
  ['hey', '👋'],
  ['hi', '👋'],
  ['bye', '👋'],
  ['wow', '😮'],
  ['whoa', '😮'],
  ['win', '🏆'],
  ['winning', '🏆'],
  ['money', '💰'],
  ['success', '🏆'],
  ['work', '💼'],
  ['run', '🚀'],
  ['go', '🚀'],
  ['start', '🚀'],
  ['ready', '⚡'],
  ['watch', '👀'],
  ['learn', '📚'],
  ['learned', '📚'],
  ['learn something', '📚'],
  ['tip', '💡'],
  ['trick', '✨'],
  ['secret', '🤫'],
  ['key', '🔑'],
  ['important', '⭐'],
  ['best', '👑'],
  ['top', '🔝'],
  ['new', '🆕'],
  ['first', '1️⃣'],
  ['next', '➡️'],
  ['last', '🔚'],
  ['today', '📅'],
  ['now', '⚡'],
  ['week', '📅'],
  ['year', '📅'],
  ['future', '🔮'],
  ['break', '☕'],
  ['wait', '⏳'],
  ['stop', '🛑'],
  ['listen', '👂'],
  ['share', '📤'],
  ['give', '🎁'],
  ['get', '📥'],
  ['make', '🛠️'],
  ['build', '🛠️'],
  ['create', '✨'],
  ['done', '✅'],
  ['finished', '✅'],
  ['complete', '✅'],
  ['easy', '👍'],
  ['simple', '👍'],
  ['hard', '😓'],
  ['difficult', '😓'],
  ['breakthrough', '💡'],
  ['game changer', '🚀'],
  ['mindset', '🧠'],
  ['growth', '📈'],
  ['hustle', '💪'],
  ['grind', '💪'],
  ['goals', '🎯'],
  ['dream', '💫'],
  ['believe', '🙏'],
  ['challenge', '🏋️'],
  ['opportunity', '🚀'],
]

const normalizedMap = MAP.map(([k, e]) => [k.toLowerCase().trim(), e] as [string, string]).sort(
  (a, b) => b[0].length - a[0].length
)

function normalize(w: string): string {
  return w.toLowerCase().replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchWord(key: string, word: string): boolean {
  const n = normalize(word)
  if (!n) return false
  if (key.includes(' ')) return n === key || n.includes(key)
  return n === key || (key.length >= 2 && n.startsWith(key)) || (key.length >= 3 && n.includes(key))
}

/**
 * Find a matching emoji for the given caption chunk.
 * Prefers the active word when it matches; otherwise first match in chunk.
 * Longer phrases are matched first. Returns null if no match.
 */
export function getMatchingEmojiForChunk(
  words: TranscriptWord[],
  activeWord?: TranscriptWord | null
): string | null {
  const normalizedWords = words.map((w) => ({ raw: w.word, n: normalize(w.word) }))
  const joined = normalizedWords.map((w) => w.n).join(' ')
  let best: string | null = null
  let bestLen = 0

  // Prefer match on active word (single-word keys only)
  if (activeWord) {
    for (const [key, emoji] of normalizedMap) {
      if (key.includes(' ')) continue
      if (matchWord(key, activeWord.word) && key.length > bestLen) {
        bestLen = key.length
        best = emoji
      }
    }
    if (best) return best
  }

  // Otherwise first match in chunk (phrase or single word)
  for (const [key, emoji] of normalizedMap) {
    if (key.length <= bestLen) continue
    const matched = key.includes(' ')
      ? joined.includes(key)
      : normalizedWords.some(({ raw }) => matchWord(key, raw))
    if (matched) {
      bestLen = key.length
      best = emoji
    }
  }
  return best
}
