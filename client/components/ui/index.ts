/**
 * Barrel for the ui primitive library. Existing deep import paths
 * (e.g. `components/ui/button`) keep working — this only ADDS a convenient
 * single entry point for the 2026 design-system components.
 */

// Buttons
export { Button } from "./button"
export type { ButtonProps, ButtonVariant, ButtonSize } from "./button"
export { IconButton } from "./icon-button"
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from "./icon-button"

// Surfaces
export {
  Card,
  Panel,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card"
export type { CardProps, PanelProps, PanelVariant } from "./card"
export { StatCard } from "./stat-card"
export type { StatCardProps, StatDeltaDirection } from "./stat-card"

// Badge
export { Badge } from "./badge"

// Forms
export { FormField, Input, Textarea } from "./form-field"
export type { FormFieldProps, InputProps, TextareaProps } from "./form-field"
export { Slider } from "./slider"
export type { SliderProps } from "./slider"
export { Switch } from "./switch"
export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./select"

// Overlays
export { Modal, Sheet } from "./modal"
export type { ModalProps, SheetProps, SheetSide } from "./modal"

// Entitlements / paywall
export { UpgradeModal } from "./UpgradeModal"
export type { UpgradeModalProps } from "./UpgradeModal"
export { FeatureGate, LockedBadge } from "./FeatureGate"
export type {
  FeatureGateProps,
  FeatureGateMode,
  LockedBadgeProps,
} from "./FeatureGate"

// Tabs & Tooltip
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip"

// Layout / misc
export { EmptyState } from "./empty-state"
export type { EmptyStateProps } from "./empty-state"
export { SectionHeader } from "./section-header"
export type { SectionHeaderProps } from "./section-header"
export { Icon } from "./icon"
export type { IconProps, IconSize } from "./icon"
