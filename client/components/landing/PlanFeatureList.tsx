'use client';

import { CheckCircle2, MinusCircle, Info } from 'lucide-react';
import type { PlanFeature } from '../../lib/plans';

interface Props {
  features: PlanFeature[];
  featured?: boolean;
}

export function PlanFeatureList({ features, featured = false }: Props) {
  return (
    <ul className="space-y-3">
      {features.map((f) => (
        <li
          key={f.label}
          className={`flex items-start gap-3 text-sm font-medium ${
            f.included ? 'text-slate-200' : 'text-slate-500 line-through decoration-slate-700'
          }`}
        >
          {f.included ? (
            <CheckCircle2
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${featured ? 'text-fuchsia-300' : 'text-indigo-400'}`}
              aria-hidden="true"
            />
          ) : (
            <MinusCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-700" aria-hidden="true" />
          )}
          <span className="flex-1 leading-relaxed">{f.label}</span>
          {f.tooltip && (
            <span title={f.tooltip} className="text-slate-600 hover:text-slate-300 transition-colors cursor-help">
              <Info className="w-3.5 h-3.5" aria-label={f.tooltip} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
