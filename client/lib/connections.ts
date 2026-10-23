// /oauth/connections returns, per platform, the list of connected accounts —
// an empty array means "not connected". Older/other shapes: an object with a
// `connected` flag, or a truthy value.
export function isPlatformConnected(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return (value as { connected?: boolean }).connected !== false
  return Boolean(value)
}
