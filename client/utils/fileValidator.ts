/**
 * useFileValidator — Detects corrupted, invalid, or oversized files
 * before they reach the server. Provides per-file health reports.
 */

export interface FileValidationResult {
  valid: boolean
  file: File
  errors: string[]
  warnings: string[]
  meta: {
    name: string
    type: string
    size: number
    sizeMB: number
    extension: string
    lastModified: number
  }
}

interface FileValidatorOptions {
  /** Allowed MIME type prefixes, e.g. ['video/', 'image/'] */
  allowedTypes?: string[]
  /** Max file size in MB (default: 500) */
  maxSizeMB?: number
  /** Whether to check the binary header to confirm file type */
  checkMagicBytes?: boolean
}

// ── Magic byte signatures ─────────────────────────────────────────────────────
const MAGIC_BYTES: Record<string, Uint8Array> = {
  'video/mp4':          new Uint8Array([0x00, 0x00, 0x00]),           // ftyp at byte 4
  'video/quicktime':    new Uint8Array([0x00, 0x00, 0x00]),
  'image/jpeg':         new Uint8Array([0xFF, 0xD8, 0xFF]),
  'image/png':          new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  'image/webp':         new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  'image/gif':          new Uint8Array([0x47, 0x49, 0x46, 0x38]),
  'audio/mpeg':         new Uint8Array([0xFF, 0xFB]),
  'audio/wav':          new Uint8Array([0x52, 0x49, 0x46, 0x46]),
}

async function checkMagicBytesOk(file: File, declaredType: string): Promise<boolean> {
  const expected = MAGIC_BYTES[declaredType]
  if (!expected) return true // No signature registered, pass

  const buf = await file.slice(0, 8).arrayBuffer()
  const actual = new Uint8Array(buf)
  return expected.every((byte, i) => actual[i] === byte)
}

/** Validate a single file. Returns a rich result with errors and metadata. */
export async function validateFile(
  file: File,
  options: FileValidatorOptions = {}
): Promise<FileValidationResult> {
  const { allowedTypes = ['video/', 'image/', 'audio/'], maxSizeMB = 500, checkMagicBytes: doMagic = true } = options

  const errors: string[] = []
  const warnings: string[] = []
  const sizeMB = file.size / (1024 * 1024)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  const meta = {
    name: file.name,
    type: file.type || 'unknown',
    size: file.size,
    sizeMB: Math.round(sizeMB * 100) / 100,
    extension: ext,
    lastModified: file.lastModified,
  }

  // ── Size checks ─────────────────────────────────────────────────────────────
  if (file.size === 0) {
    errors.push('File is empty (0 bytes) — it may be corrupted.')
  }
  if (sizeMB > maxSizeMB) {
    errors.push(`File is too large: ${meta.sizeMB}MB (max ${maxSizeMB}MB).`)
  }
  if (sizeMB > maxSizeMB * 0.8) {
    warnings.push(`File is large (${meta.sizeMB}MB) — upload may be slow.`)
  }

  // ── Type checks ─────────────────────────────────────────────────────────────
  if (!file.type) {
    warnings.push('File has no MIME type — format cannot be verified.')
  } else {
    const typeAllowed = allowedTypes.some(t => file.type.startsWith(t))
    if (!typeAllowed) {
      errors.push(`Unsupported file type: ${file.type}`)
    }
  }

  // ── Name checks ─────────────────────────────────────────────────────────────
  if (/[<>:"/\\|?*\x00-\x1F]/.test(file.name)) {
    warnings.push('Filename contains special characters — rename before uploading.')
  }
  if (!ext) {
    warnings.push('File has no extension — processing may fail.')
  }

  // ── Magic bytes ─────────────────────────────────────────────────────────────
  if (doMagic && file.type && file.size > 0) {
    try {
      const magicOk = await checkMagicBytesOk(file, file.type)
      if (!magicOk) {
        errors.push(`File header does not match declared type "${file.type}" — file may be corrupted or renamed.`)
      }
    } catch {
      warnings.push('Could not read file header for corruption check.')
    }
  }

  // ── Modification date sanity ─────────────────────────────────────────────────
  const modifiedMs = file.lastModified
  if (modifiedMs === 0 || modifiedMs > Date.now() + 1000 * 86400) {
    warnings.push('File has an unusual modification date.')
  }

  return { valid: errors.length === 0, file, errors, warnings, meta }
}

/** Validate multiple files in parallel. */
export async function validateFiles(
  files: File[],
  options?: FileValidatorOptions
): Promise<FileValidationResult[]> {
  return Promise.all(files.map(f => validateFile(f, options)))
}

/** Convenience: returns only invalid files and their errors. */
export async function findCorruptedFiles(
  files: File[],
  options?: FileValidatorOptions
): Promise<FileValidationResult[]> {
  const results = await validateFiles(files, options)
  return results.filter(r => !r.valid)
}
