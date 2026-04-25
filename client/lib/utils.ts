import { twMerge } from 'tailwind-merge';

// Inlined clsx-equivalent: flattens any nested arrays of strings/numbers/
// booleans into a single space-separated class list, dropping falsy values.
// We avoided pulling in clsx as a dependency since no caller uses the object
// form; if you need that, re-introduce clsx.
export type ClassValue = string | number | boolean | null | undefined | ClassValue[];

function flatten(values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v && v !== 0) continue;
    if (Array.isArray(v)) {
      out.push(flatten(v));
    } else if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    }
  }
  return out.join(' ');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(flatten(inputs));
}
