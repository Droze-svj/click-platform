import {
    Cpu,
    Settings,
    Sparkles,
    Link2,
    LineChart,
    Users,
    Wand2,
    Lock,
    Layers,
    Download,
    Calendar,
    PenTool
} from 'lucide-react'
import {
    EditToolIcon,
    MagicEffectsIcon,
    ColorPaletteIcon,
    MagicWandIcon,
    MagicEffectsIcon as VisualFXIcon,
    NeuralNetworkIcon,
    CollaborationIcon,
    LayersIcon,
    UploadCloudIcon
} from '../components/icons/VideoIcons'
import { EditorCategory } from '../types/editor'

export interface Category {
    id: EditorCategory
    label: string
    icon: any
    color: string
    bgColor: string
    textColor: string
    description: string
    features?: string[]
    badge?: string
}

export const CATEGORIES: Category[] = [
    {
        id: 'ai-edit',
        label: 'Elite AI',
        icon: Cpu,
        color: 'from-fuchsia-600 to-purple-600',
        bgColor: 'bg-fuchsia-100 dark:bg-fuchsia-900/10',
        textColor: 'text-fuchsia-600 dark:text-fuchsia-400',
        description: 'Superior automated production',
        features: ['Semantic Edit', 'Smart B-Roll', 'Variety Sync']
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        color: 'from-slate-500 to-slate-700',
        bgColor: 'bg-slate-100 dark:bg-slate-900/10',
        textColor: 'text-slate-600 dark:text-slate-400',
        description: 'App preferences & settings'
    },
    {
        id: 'scripts',
        label: 'AI Scripts',
        icon: PenTool,
        color: 'from-blue-600 to-indigo-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/10',
        textColor: 'text-blue-600 dark:text-blue-400',
        description: 'Strategic script generation',
        features: ['Role Based', '3s Hooks', 'CTA Optimization']
    },
    {
        id: 'scheduling',
        label: 'Schedule',
        icon: Calendar,
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/10',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        description: 'Post distribution hub',
        features: ['Calendar View', 'Conflict Check', 'Blast Post']
    },
    {
        id: 'intelligence',
        label: 'Intelligence',
        icon: Sparkles,
        color: 'from-fuchsia-600 to-indigo-600',
        bgColor: 'bg-fuchsia-100 dark:bg-fuchsia-900/10',
        textColor: 'text-fuchsia-600 dark:text-fuchsia-400',
        description: 'Clone creator pacing & styles'
    },
    {
        id: 'accounts',
        label: 'Accounts',
        icon: Link2,
        color: 'from-blue-600 to-emerald-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/10',
        textColor: 'text-blue-600 dark:text-blue-400',
        description: 'Link social platforms'
    },
    {
        id: 'growth',
        label: 'Growth',
        icon: LineChart,
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/10',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        description: 'Viral probability & insights',
        features: ['Viral Score', 'Hooks Analysis', 'Retention Tips']
    },
    {
        id: 'remix',
        label: 'Remix',
        icon: Users,
        color: 'from-orange-500 to-amber-500',
        bgColor: 'bg-orange-100 dark:bg-orange-900/10',
        textColor: 'text-orange-600 dark:text-orange-400',
        description: 'Community templates',
        badge: 'BETA'
    },
    {
        id: 'edit',
        label: 'Edit',
        icon: EditToolIcon,
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
        textColor: 'text-blue-700 dark:text-blue-300',
        description: 'Basic editing tools',
        features: ['Trim', 'Crop', 'Rotate', 'Split']
    },
    {
        id: 'assets',
        label: 'Music, Images & B-Roll',
        icon: UploadCloudIcon,
        color: 'from-indigo-500 to-purple-500',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/20',
        textColor: 'text-indigo-700 dark:text-indigo-300',
        description: 'Add music, images & B-roll clips',
        features: ['Music', 'Images', 'B-Roll', 'Upload']
    },
    {
        id: 'effects',
        label: 'Effects',
        icon: MagicEffectsIcon,
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/20',
        textColor: 'text-purple-700 dark:text-purple-300',
        description: 'Filters & enhancements',
        features: ['Filters', 'Text', 'Transitions', 'Audio']
    },
    {
        id: 'color',
        label: 'Color',
        icon: ColorPaletteIcon,
        color: 'from-indigo-500 to-indigo-600',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/20',
        textColor: 'text-indigo-700 dark:text-indigo-300',
        description: 'Professional color grading',
        features: ['Curves', 'Color Wheels', 'LUTs', 'Scopes']
    },
    {
        id: 'chromakey',
        label: 'Chroma Key',
        icon: MagicWandIcon,
        color: 'from-emerald-500 to-emerald-600',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/20',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        description: 'Green screen & compositing',
        features: ['Key Removal', 'Spill Suppression', 'Edge Refinement']
    },
    {
        id: 'visual-fx',
        label: 'Visual FX',
        icon: VisualFXIcon,
        color: 'from-cyan-500 to-blue-500',
        bgColor: 'bg-cyan-100 dark:bg-cyan-900/20',
        textColor: 'text-cyan-700 dark:text-cyan-300',
        description: 'Particle systems & effects',
        features: ['Particles', 'Lens Flares', 'Lights', 'Motion']
    },
    {
        id: 'automate',
        label: 'Automate',
        icon: Wand2,
        color: 'from-orange-500 to-red-500',
        bgColor: 'bg-orange-100 dark:bg-orange-900/10',
        textColor: 'text-orange-600 dark:text-orange-400',
        description: 'AI-powered production tools',
        features: ['Voiceover', 'Auto-Jumpcut', 'Frame Refit']
    },
    {
        id: 'ai-analysis',
        label: 'AI Analysis',
        icon: NeuralNetworkIcon,
        color: 'from-pink-500 to-purple-500',
        bgColor: 'bg-pink-100 dark:bg-pink-900/20',
        textColor: 'text-pink-700 dark:text-pink-300',
        description: 'Smart scene detection',
        features: ['Scene Detection', 'Auto-Editing', 'Suggestions']
    },
    {
        id: 'collaborate',
        label: 'Collaborate',
        icon: CollaborationIcon,
        color: 'from-green-500 to-teal-500',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
        textColor: 'text-green-700 dark:text-green-300',
        description: 'Real-time collaboration',
        features: ['Live Cursors', 'Comments', 'Team Editing']
    },
    {
        id: 'timeline',
        label: 'Timeline',
        icon: LayersIcon,
        color: 'from-yellow-500 to-orange-500',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        textColor: 'text-yellow-700 dark:text-yellow-300',
        description: 'Advanced editing',
        features: ['Multi-track', 'Keyframes', 'Precision', 'Layers']
    },
    {
        id: 'ai',
        label: 'AI Assistance',
        icon: Sparkles,
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/20',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        description: 'AI-powered editing insights',
        features: ['Smart Analysis', 'Edit Suggestions', 'Auto-Cuts']
    },
    {
        id: 'export',
        label: 'Export',
        icon: UploadCloudIcon,
        color: 'from-red-500 to-pink-500',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
        textColor: 'text-red-700 dark:text-red-300',
        description: 'Share & export',
        features: ['Social Media', 'Formats', 'Quality', 'Presets']
    }
]
