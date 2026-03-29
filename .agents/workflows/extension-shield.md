---
description: How to suppress and recover from browser extension errors
---

# Browser Extension Error Shield Workflow

Browser extensions (like Trust Wallet, MetaMask, etc.) frequently inject scripts that conflict with Next.js/React applications, causing crashes like `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`.

## 1. Detection Logic
Check for the following patterns in error messages or stack traces:
- `chrome-extension://`
- `inpage.js`
- `MetaMask` / `Trust Wallet`
- `toLowerCase` or `toUpperCase` on `undefined` originating from external scripts.

## 2. Mitigation Strategy
Implement a multi-layered shield:

### layer A: Route-Level Error Boundary
In `app/dashboard/video/error.tsx` (or similar), use a `useEffect` to detect extension errors and auto-reset:
```tsx
useEffect(() => {
  const isExtension = error.message?.toLowerCase().includes('extension') || 
                     error.stack?.includes('chrome-extension://') ||
                     error.message?.includes('inpage.js');
  
  if (isExtension) {
    // Optional: Add loop prevention check using a timestamp
    reset();
  }
}, [error]);
```

### layer B: Global Error Boundary
In `components/ErrorBoundary.tsx`, implement similar logic as a fallback.

### layer C: Console Filtering
In `components/ClickDebugPanel.tsx` (or any global debug component), hook into `console.error` and `console.warn` to suppress these messages from reaching the UI or logs.

## 3. Component Hardening
- Wrap all `.toLowerCase()` and `.toUpperCase()` calls on external-derived data or props with `String(val || '').toLowerCase()`.
- Guard `e.key.toLowerCase()` in event listeners with `(e.key || '').toLowerCase()`.
- Add null checks to `.filter()` and `.map()` loops on arrays that might contain sparse data (e.g., `transcript.words`).

## 4. Recovering from Loops
If a loop is detected (multiple resets in < 2 seconds), suppress the reset and show a non-intrusive warning or simply let the error be swallowed by the boundary without resetting.
