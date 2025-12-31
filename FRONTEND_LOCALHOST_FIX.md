# Frontend Localhost:3000 Fix

## Problem
The frontend was making API calls to `localhost:3000` instead of the production backend at `https://click-platform.onrender.com/api`. This was causing `404 (Not Found)` errors for endpoints like:
- `/api/onboarding`
- `/api/suggestions/daily`
- `/api/engagement/challenges`
- `/api/templates`
- `/api/ai/multi-model/models`
- `/api/ai/recommendations/personalized`

## Root Cause
Several components were using relative URLs (e.g., `/api/onboarding`) which resolve to `http://localhost:3000/api/...` when running in the browser. These should be calling the production backend directly.

## Solution
Updated all affected components to use the production API URL:

1. **OnboardingFlow.tsx** - Fixed all 4 API calls:
   - `/api/onboarding` → `${API_URL}/onboarding`
   - `/api/onboarding/complete-step` → `${API_URL}/onboarding/complete-step`
   - `/api/onboarding/skip` → `${API_URL}/onboarding/skip`
   - `/api/onboarding/goto-step` → `${API_URL}/onboarding/goto-step`

2. **SmartSuggestions.tsx** - Fixed:
   - `/api/suggestions/daily` → `${API_URL}/suggestions/daily`

3. **DailyChallenges.tsx** - Fixed:
   - `/api/engagement/challenges` → `${API_URL}/engagement/challenges`

4. **QuickTemplateAccess.tsx** - Fixed:
   - `/api/templates?...` → `${API_URL}/templates?...`
   - `/api/templates/${id}/use` → `${API_URL}/templates/${id}/use`

5. **AIMultiModelSelector.tsx** - Fixed:
   - `/api/ai/multi-model/models` → `${API_URL}/ai/multi-model/models`
   - `/api/ai/multi-model/provider` → `${API_URL}/ai/multi-model/provider`
   - `/api/ai/multi-model/compare` → `${API_URL}/ai/multi-model/compare`

6. **AIRecommendations.tsx** - Fixed:
   - `/api/ai/recommendations/personalized` → `${API_URL}/ai/recommendations/personalized`

## Pattern Used
All components now use:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
```

This ensures:
- In production, `NEXT_PUBLIC_API_URL` can be set to override the default
- In development, it falls back to the production URL (not localhost)
- All API calls use the full URL instead of relative paths

## Remaining Components
There are still other components using relative URLs that may need fixing:
- `InfrastructureDashboard.tsx`
- `PrivacySettings.tsx`
- `SupportTicketSystem.tsx`
- `HelpCenter.tsx`
- `SecurityDashboard.tsx`
- `BackupManager.tsx`
- And others...

These can be fixed as they're encountered or in a future pass. The critical dashboard components have been fixed.

## Testing
After deploying, verify:
1. Dashboard loads without `404` errors for the fixed endpoints
2. Onboarding flow works correctly
3. All dashboard widgets load their data
4. No more `localhost:3000` calls in the browser console

