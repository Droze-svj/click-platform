/**
 * Dynamic Imports for Code Splitting
 * Lazy loads large components to improve initial bundle size and loading performance
 */

import dynamic from 'next/dynamic'
import { ComponentType } from 'react'

// Loading component for dynamic imports
const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    <span className="ml-3 text-gray-600">Loading...</span>
  </div>
)

// Video Editor Components (Heavy WebGL and canvas operations)
export const DynamicModernVideoEditor = dynamic(
  () => import('./ModernVideoEditor'),
  {
    loading: LoadingFallback,
    ssr: false // Disable SSR for video editor (requires DOM APIs)
  }
)

export const DynamicEnhancedVideoEditor = dynamic(
  () => import('./EnhancedVideoEditor'),
  {
    loading: LoadingFallback,
    ssr: false
  }
)

export const DynamicWebGLVideoRenderer = dynamic(
  () => import('./WebGLVideoRenderer'),
  {
    loading: LoadingFallback,
    ssr: false
  }
)

// Analytics Components (Heavy charting libraries)
export const DynamicAnalytics = dynamic(
  () => import('./Analytics'),
  {
    loading: LoadingFallback
  }
)

export const DynamicBusinessIntelligenceDashboard = dynamic(
  () => import('./BusinessIntelligenceDashboard'),
  {
    loading: LoadingFallback
  }
)

export const DynamicContentPerformanceAnalytics = dynamic(
  () => import('./ContentPerformanceAnalytics'),
  {
    loading: LoadingFallback
  }
)

export const DynamicPredictiveAnalytics = dynamic(
  () => import('./PredictiveAnalytics'),
  {
    loading: LoadingFallback
  }
)

// Advanced Features (Complex UI components)
export const DynamicApprovalDashboard = dynamic(
  () => import('./ApprovalDashboard'),
  {
    loading: LoadingFallback
  }
)

export const DynamicEnterpriseWorkspaceDashboard = dynamic(
  () => import('./EnterpriseWorkspaceDashboard'),
  {
    loading: LoadingFallback
  }
)

export const DynamicInfrastructureDashboard = dynamic(
  () => import('./InfrastructureDashboard'),
  {
    loading: LoadingFallback
  }
)

// Search and Discovery (Heavy search algorithms)
export const DynamicAdvancedSearch = dynamic(
  () => import('./AdvancedSearch'),
  {
    loading: LoadingFallback
  }
)

export const DynamicElasticsearchSearch = dynamic(
  () => import('./ElasticsearchSearch'),
  {
    loading: LoadingFallback
  }
)

// Content Creation (Rich editors and builders)
export const DynamicDragDropContentBuilder = dynamic(
  () => import('./DragDropContentBuilder'),
  {
    loading: LoadingFallback
  }
)

export const DynamicBulkContentEditor = dynamic(
  () => import('./BulkContentEditor'),
  {
    loading: LoadingFallback
  }
)

export const DynamicCustomTemplateCreator = dynamic(
  () => import('./CustomTemplateCreator'),
  {
    loading: LoadingFallback
  }
)

// Collaboration Features (Real-time components)
export const DynamicLiveCollaboration = dynamic(
  () => import('./LiveCollaboration'),
  {
    loading: LoadingFallback
  }
)

export const DynamicRealtimeCollaboration = dynamic(
  () => import('./RealtimeCollaboration'),
  {
    loading: LoadingFallback
  }
)

export const DynamicCollaborativeEditing = dynamic(
  () => import('./CollaborativeEditing'),
  {
    loading: LoadingFallback
  }
)

// Error and Debug Components (Only load when needed)
export const DynamicErrorDashboard = dynamic(
  () => import('./ErrorDashboard'),
  {
    loading: LoadingFallback,
    ssr: false
  }
)

export const DynamicDebugDashboard = dynamic(
  () => import('./DebugDashboard'),
  {
    loading: LoadingFallback,
    ssr: false
  }
)

// Calendar and Scheduling (Heavy calendar libraries)
export const DynamicEnhancedContentCalendar = dynamic(
  () => import('./EnhancedContentCalendar'),
  {
    loading: LoadingFallback
  }
)

export const DynamicDraggableCalendar = dynamic(
  () => import('./DraggableCalendar'),
  {
    loading: LoadingFallback
  }
)

export const DynamicBestTimeToPostCalendar = dynamic(
  () => import('./BestTimeToPostCalendar'),
  {
    loading: LoadingFallback
  }
)

// Music and Audio (Audio processing libraries)
export const DynamicVoiceContentInput = dynamic(
  () => import('./VoiceContentInput'),
  {
    loading: LoadingFallback,
    ssr: false
  }
)

// Utility function to preload critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used immediately
  import('./Navbar')
  import('./ToastContainer')
  import('./LoadingSkeleton')
}

// Utility function to preload components for a specific route
export const preloadRouteComponents = (route: string) => {
  switch (route) {
    case '/dashboard/video':
      import('./ModernVideoEditor')
      import('./VideoAdvancedTools')
      break
    case '/dashboard/analytics':
      import('./Analytics')
      import('./PredictiveAnalytics')
      break
    case '/dashboard/content':
      import('./ContentLibrary')
      import('./BulkContentEditor')
      break
    case '/dashboard/calendar':
      import('./EnhancedContentCalendar')
      import('./ContentSchedulingAssistant')
      break
    default:
      break
  }
}

// Hook for dynamic component loading with error boundaries
export const useDynamicComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) => {
  return dynamic(importFn, {
    loading: LoadingFallback,
    ssr: false
  })
}




