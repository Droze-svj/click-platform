import { TimelineSegmentType } from '../types/editor'

export const formatTime = (time: number): string => {
    if (!isFinite(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const getSegmentColor = (type: TimelineSegmentType | string): string => {
    const colors: { [key: string]: string } = {
        video: '#3B82F6',
        audio: '#10B981',
        text: '#F59E0B',
        transition: '#8B5CF6',
        image: '#EC4899'
    }
    return colors[type] || '#6B7280'
}

export const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
        'ai-edit': 'from-fuchsia-600 to-purple-600',
        'edit': 'from-blue-500 to-blue-600',
        'effects': 'from-purple-500 to-purple-600',
        'color': 'from-indigo-500 to-indigo-600',
        'chromakey': 'from-emerald-500 to-emerald-600',
        'visual-fx': 'from-cyan-500 to-blue-500',
        'automate': 'from-orange-500 to-red-500',
        'ai-analysis': 'from-pink-500 to-purple-500',
        'collaborate': 'from-green-500 to-teal-500',
        'timeline': 'from-yellow-500 to-orange-500',
        'assets': 'from-indigo-500 to-purple-500',
        'ai': 'from-emerald-500 to-teal-500',
        'export': 'from-red-500 to-pink-500',
        'growth': 'from-emerald-500 to-teal-500',
        'remix': 'from-orange-500 to-amber-500'
    }
    return colors[category] || 'from-gray-500 to-gray-600'
}

export const getStatusColor = (status: string): string => {
    switch (status) {
        case 'saving': return 'text-blue-500'
        case 'saved': return 'text-green-500'
        case 'error': return 'text-red-500'
        default: return 'text-gray-400'
    }
}
