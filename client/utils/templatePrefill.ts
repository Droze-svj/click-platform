import { apiGet } from '../lib/api'

/**
 * "Use template" on the Templates page opens the content generator or the
 * script writer with ?template=<id>. Neither page read it, so the template was
 * counted as used and then nothing was filled in. This loads the template and
 * pulls out the common fields; templateData has no fixed schema, so each field
 * is looked up under the names templates actually use.
 */
export interface TemplatePrefill {
  name: string
  text: string
  title: string
  topic: string
  platforms: string[]
  tone: string
  audience: string
  keywords: string
}

const firstString = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim()
  return ''
}

export function templateIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const id = new URLSearchParams(window.location.search).get('template')
  return id && /^[0-9a-f]{24}$/i.test(id) ? id : null
}

export async function loadTemplatePrefill(templateId: string): Promise<TemplatePrefill | null> {
  const res: any = await apiGet(`/templates/${templateId}`, undefined, false)
  const tpl = res?.data ?? res
  if (!tpl || typeof tpl !== 'object') return null
  const d = (tpl.templateData && typeof tpl.templateData === 'object') ? tpl.templateData : {}
  const keywords = Array.isArray(d.keywords) ? d.keywords.join(', ') : firstString(d.keywords)
  return {
    name: firstString(tpl.name),
    text: firstString(d.text, d.content, d.body, d.prompt, d.script, tpl.description),
    title: firstString(d.title, tpl.name),
    topic: firstString(d.topic, d.seed, d.prompt, tpl.name),
    platforms: Array.isArray(d.platforms) ? d.platforms.filter((p: unknown) => typeof p === 'string') : [],
    tone: firstString(d.tone),
    audience: firstString(d.targetAudience, d.audience),
    keywords,
  }
}
