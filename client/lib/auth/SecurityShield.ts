export class SecurityShield {
  static scrubMetadata(data: any) {
    const sensitive = ['email', 'userId', 'token', 'folderId', 'private'];
    const scrubbed = { ...data };
    Object.keys(scrubbed).forEach(key => {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        scrubbed[key] = 'REDACTED_ID';
      }
    });
    console.log('[SecurityShield] Metadata Sanitized');
    return scrubbed;
  }

  static enforceIsolation() {
    if (!globalThis.crossOriginIsolated) {
      console.warn('[Security] Cross-Origin Isolation missing. MemoryBridge in fallback mode.');
    }
  }
}
