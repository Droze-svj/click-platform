import React from 'react'

export const VideoCameraIcon = ({ className = "w-5 h-5" }: { className?: string }) => {

  return (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 10L11 7L15 4V10Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="9" cy="9" r="2" fill="currentColor"/>
  </svg>
)
}

export const ProfessionalCameraIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M19 9L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M5 9L3 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 5V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const ColorWheelIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 2C13.1 2 14 2.9 14 4V6C14 7.1 13.1 8 12 8C10.9 8 10 7.1 10 6V4C10 2.9 10.9 2 12 2Z" fill="currentColor"/>
    <path d="M22 12C22 10.9 21.1 10 20 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H20C21.1 14 22 13.1 22 12Z" fill="currentColor"/>
    <path d="M12 16C13.1 16 14 16.9 14 18V20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20V18C10 16.9 10.9 16 12 16Z" fill="currentColor"/>
    <path d="M8 12C8 10.9 7.1 10 6 10H4C2.9 10 2 10.9 2 12C2 13.1 2.9 14 4 14H6C7.1 14 8 13.1 8 12Z" fill="currentColor"/>
  </svg>
)

export const TextToolIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V4H20V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 20H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 16H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const TimelineIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="2" y="14" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
    <path d="M8 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="6" cy="10" r="2" fill="currentColor"/>
    <circle cx="18" cy="10" r="2" fill="currentColor"/>
  </svg>
)

export const AudioWaveIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M11 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M15 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M3 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M21 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const EffectsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="currentColor"/>
    <circle cx="18" cy="18" r="3" fill="currentColor"/>
    <path d="M18 15V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M21 18H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const AIIntelligenceIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="8" cy="8" r="1" fill="currentColor"/>
    <circle cx="16" cy="8" r="1" fill="currentColor"/>
    <path d="M12 6V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M18 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 18V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M6 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const ExportIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const ScissorsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/>
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 4L8.12 15.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M14.47 14.48L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8.12 8.12L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const MagicEffectsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="currentColor"/>
    <path d="M5 21L8 17L12 19L16 15L19 19L16 21L12 19L8 21L5 21Z" fill="currentColor"/>
  </svg>
)

export const CollaborationIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M15 11C15 12.6569 13.6569 14 12 14C10.3431 14 9 12.6569 9 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M5 19C5 16.7909 6.79086 15 9 15H15C17.2091 15 19 16.7909 19 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M18 8C18 9.10457 17.1046 10 16 10C14.8954 10 14 9.10457 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M14 12C14 10.8954 14.8954 10 16 10H18C19.1046 10 20 10.8954 20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const MovieClapperIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 10H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 14H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 14L16 18V14H20V18L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 18H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const DSLRIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <rect x="6" y="8" width="4" height="2" rx="1" fill="currentColor"/>
    <path d="M16 8H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 10H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const ColorPaletteIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z" fill="#FF6B6B"/>
    <path d="M19 7C20.1 7 21 7.9 21 9C21 10.1 20.1 11 19 11C17.9 11 17 10.1 17 9C17 7.9 17.9 7 19 7Z" fill="#4ECDC4"/>
    <path d="M5 7C6.1 7 7 7.9 7 9C7 10.1 6.1 11 5 11C3.9 11 3 10.1 3 9C3 7.9 3.9 7 5 7Z" fill="#45B7D1"/>
    <path d="M19 13C20.1 13 21 13.9 21 15C21 16.1 20.1 17 19 17C17.9 17 17 16.1 17 15C17 13.9 17.9 13 19 13Z" fill="#96CEB4"/>
    <path d="M5 13C6.1 13 7 13.9 7 15C7 16.1 6.1 17 5 17C3.9 17 3 16.1 3 15C3 13.9 3.9 13 5 13Z" fill="#FFEAA7"/>
    <path d="M12 16C13.1 16 14 16.9 14 18C14 19.1 13.1 20 12 20C10.9 20 10 19.1 10 18C10 16.9 10.9 16 12 16Z" fill="#DDA0DD"/>
  </svg>
)

export const TypographyIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V4H20V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 20H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 16H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 7L8 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 7L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const LayersIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const SoundWaveIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 12L4 10L4 14L2 12Z" fill="currentColor"/>
    <path d="M6 9L8 7L8 17L6 15V9Z" fill="currentColor"/>
    <path d="M10 6L12 4L12 20L10 18V6Z" fill="currentColor"/>
    <path d="M14 6L16 4L16 20L14 18V6Z" fill="currentColor"/>
    <path d="M18 9L20 7L20 17L18 15V9Z" fill="currentColor"/>
    <path d="M22 12L24 10L24 14L22 12Z" fill="currentColor"/>
  </svg>
)

export const MagicWandIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 4V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 20H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 8L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 12L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 4L19 2L17 4L19 6L21 4Z" fill="currentColor"/>
    <path d="M3 20L5 18L7 20L5 22L3 20Z" fill="currentColor"/>
  </svg>
)

export const NeuralNetworkIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="2" fill="currentColor"/>
    <circle cx="18" cy="6" r="2" fill="currentColor"/>
    <circle cx="6" cy="18" r="2" fill="currentColor"/>
    <circle cx="18" cy="18" r="2" fill="currentColor"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <path d="M8 6L10 12" stroke="currentColor" strokeWidth="2"/>
    <path d="M14 12L16 6" stroke="currentColor" strokeWidth="2"/>
    <path d="M8 18L10 12" stroke="currentColor" strokeWidth="2"/>
    <path d="M14 12L16 18" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 8L12 10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 14L6 16" stroke="currentColor" strokeWidth="2"/>
    <path d="M18 8L12 10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 14L18 16" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

export const UploadCloudIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 16L12 12L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 12V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20.39 18.39C21.365 17.858 22 16.757 22 15.487C22 13.624 20.626 12.097 18.766 12.251C17.794 11.842 16.728 11.625 15.621 11.625C13.961 11.625 12.372 12.047 11.032 12.787C9.624 13.584 8.615 14.885 8.22 16.487C6.439 16.487 5 17.926 5 19.707C5 21.488 6.439 22.927 8.22 22.927H18.78C20.561 22.927 22 21.488 22 19.707C22 19.049 21.827 18.43 21.516 17.894" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const EditToolIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
