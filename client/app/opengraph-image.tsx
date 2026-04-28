/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Click — Content Intelligence for high-velocity creators';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background:
            'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 80% 70%, rgba(217,70,239,0.30), transparent 55%), #050505',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.5,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 28,
            }}
          >
            ⚡
          </div>
          CLICK
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 18,
              color: '#a5b4fc',
              textTransform: 'uppercase',
              letterSpacing: 4,
              fontWeight: 700,
            }}
          >
            ✦ Click AI 3.0
          </div>
          <div
            style={{
              fontSize: 124,
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: -3,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>CONTENT</span>
            <span
              style={{
                background: 'linear-gradient(90deg, #818cf8, #ffffff, #f0abfc)',
                backgroundClip: 'text',
                color: 'transparent',
                fontStyle: 'italic',
              }}
            >
              INTELLIGENCE.
            </span>
          </div>
          <div style={{ fontSize: 28, color: '#94a3b8', maxWidth: 900, lineHeight: 1.3 }}>
            Niche-aware AI auto-edits, retention forecasts, and omni-channel publishing — for high-velocity creators.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 18,
            color: '#64748b',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          <span>25K+ creators · 145M clips</span>
          <span style={{ color: '#a5b4fc' }}>click.app</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
