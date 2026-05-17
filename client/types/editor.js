"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDITOR_CONTENT_PREFS_KEY = exports.EFFECT_PRESETS = exports.EFFECT_TYPE_COLORS = exports.EFFECT_EASINGS = exports.KEYFRAME_EASINGS = exports.MOTION_GRAPHIC_TEMPLATES = exports.KEYFRAME_ANIMATION_PRESETS = exports.MOTION_GRAPHIC_PRESETS = exports.CAPTION_FONTS = exports.CAPTION_SIZE_PX = exports.CAPTION_CREATIVE_PRESETS = exports.CAPTION_TEXT_STYLES = exports.TEMPLATE_LAYOUTS = exports.ALL_TIMELINE_TRACKS = exports.AUDIO_TRACKS = exports.VIDEO_TRACKS = void 0;
exports.getDefaultTrackForSegmentType = getDefaultTrackForSegmentType;
exports.getTrackDef = getTrackDef;
/** Video tracks: V1–V2 A-Roll (base), V3–V4 B-Roll (covers A-Roll), V5–V6 Graphics */
exports.VIDEO_TRACKS = [
    { index: 0, id: 'V1', name: 'A-Roll', kind: 'video' },
    { index: 1, id: 'V2', name: 'A-Roll', kind: 'video' },
    { index: 2, id: 'V3', name: 'B-Roll', kind: 'video' },
    { index: 3, id: 'V4', name: 'B-Roll', kind: 'video' },
    { index: 4, id: 'V5', name: 'Graphics', kind: 'video' },
    { index: 5, id: 'V6', name: 'Graphics', kind: 'video' },
];
/** Audio tracks: A1 Music, A2 Dialogue, A3–A4 SFX */
exports.AUDIO_TRACKS = [
    { index: 6, id: 'A1', name: 'Music', kind: 'audio' },
    { index: 7, id: 'A2', name: 'Dialogue', kind: 'audio' },
    { index: 8, id: 'A3', name: 'SFX', kind: 'audio' },
    { index: 9, id: 'A4', name: 'SFX', kind: 'audio' },
];
exports.ALL_TIMELINE_TRACKS = __spreadArray(__spreadArray([], exports.VIDEO_TRACKS, true), exports.AUDIO_TRACKS, true);
/** Default track index by segment type (A-Roll for video, Dialogue for audio, Graphics for image) */
function getDefaultTrackForSegmentType(type) {
    switch (type) {
        case 'video':
        case 'transition':
            return 0; // V1 A-Roll
        case 'image':
            return 4; // V5 Graphics
        case 'audio':
            return 7; // A2 Dialogue
        case 'text':
            return 4; // V5 Graphics (text as graphic)
        default:
            return 0;
    }
}
/** Get track definition by index */
function getTrackDef(trackIndex) {
    return exports.ALL_TIMELINE_TRACKS.find(function (t) { return t.index === trackIndex; });
}
exports.TEMPLATE_LAYOUTS = [
    { id: 'auto', label: 'Auto', aspect: '16/9', desc: 'Match video', platform: 'Source' },
    { id: 'standard', label: 'Standard', aspect: '16/9', desc: '16:9', platform: 'YouTube · Landscape' },
    { id: 'square', label: 'Square', aspect: '1/1', desc: '1:1', platform: 'Instagram · Feed' },
    { id: 'vertical', label: 'Vertical', aspect: '9/16', desc: '9:16', platform: 'Reels · Stories · TikTok' },
    { id: 'portrait', label: 'Portrait', aspect: '4/5', desc: '4:5', platform: 'Instagram · Portrait' },
    { id: 'cinematic', label: 'Cinematic', aspect: '239/100', desc: '2.39:1', platform: 'Widescreen' },
    { id: 'classic', label: 'Classic', aspect: '4/3', desc: '4:3', platform: 'Traditional' },
];
exports.CAPTION_TEXT_STYLES = [
    { id: 'default', label: 'Default', desc: 'Clean, readable' },
    { id: 'bold', label: 'Bold', desc: 'Heavy weight' },
    { id: 'uppercase', label: 'Uppercase', desc: 'ALL CAPS' },
    { id: 'minimal', label: 'Minimal', desc: 'Thin, subtle' },
    { id: 'shadow', label: 'Shadow', desc: 'Strong drop shadow' },
    { id: 'outline', label: 'Outline', desc: 'Stroked, no fill' },
    { id: 'high-contrast', label: 'High contrast', desc: 'White on black' },
    { id: 'pill', label: 'Pill', desc: 'Rounded pill bg' },
    { id: 'bubble', label: 'Bubble', desc: 'Speech bubble' },
    { id: 'sticker', label: 'Sticker', desc: 'Rounded box' },
    { id: 'neon', label: 'Neon', desc: 'Glowing' },
    { id: 'kinetic', label: 'Kinetic', desc: 'Scale pop on word' },
    { id: 'karaoke', label: 'Karaoke', desc: 'Bold center' },
    { id: 'gradient', label: 'Gradient', desc: 'Color gradient' },
    { id: 'pop', label: 'Pop', desc: 'Bright + outline' },
    { id: 'cinematic', label: 'Cinematic', desc: 'Film serif' },
    { id: 'serif', label: 'Serif', desc: 'Elegant' },
    { id: 'retro', label: 'Retro', desc: 'Vintage warm' },
    { id: 'vintage', label: 'Vintage', desc: 'Sepia typewriter' },
    { id: 'subtitle', label: 'Subtitle', desc: 'Classic subtitle' },
];
exports.CAPTION_CREATIVE_PRESETS = [
    { id: 'tiktok', label: 'TikTok', description: 'Bold, center, high impact', textStyle: 'bold', layout: 'bottom-center', size: 'large', font: 'Inter, sans-serif' },
    { id: 'reels', label: 'Reels', description: 'Clean uppercase, trendy', textStyle: 'uppercase', layout: 'bottom-center', size: 'medium', font: '"Montserrat", sans-serif' },
    { id: 'podcast', label: 'Podcast', description: 'Minimal, lower third', textStyle: 'minimal', layout: 'lower-third', size: 'medium', font: 'Inter, sans-serif' },
    { id: 'cinematic', label: 'Cinematic', description: 'Film-style serif', textStyle: 'cinematic', layout: 'bottom-center', size: 'medium', font: 'Georgia, serif' },
    { id: 'documentary', label: 'Documentary', description: 'Classic subtitle bar', textStyle: 'subtitle', layout: 'full-width-bottom', size: 'medium', font: 'Arial, sans-serif' },
    { id: 'neon', label: 'Neon', description: 'Glowing, night vibe', textStyle: 'neon', layout: 'bottom-center', size: 'large', font: '"Montserrat", sans-serif' },
    { id: 'karaoke', label: 'Karaoke', description: 'Bold karaoke style', textStyle: 'karaoke', layout: 'bottom-center', size: 'large', font: 'Inter, sans-serif' },
    { id: 'pill', label: 'Pill', description: 'Rounded pill words', textStyle: 'pill', layout: 'bottom-center', size: 'medium', font: 'Inter, sans-serif' },
    { id: 'bubble', label: 'Bubble', description: 'Speech bubble style', textStyle: 'bubble', layout: 'lower-third', size: 'medium', font: '"Open Sans", sans-serif' },
    { id: 'gradient', label: 'Gradient', description: 'Colorful gradient text', textStyle: 'gradient', layout: 'bottom-center', size: 'large', font: '"Montserrat", sans-serif' },
    { id: 'retro', label: 'Retro', description: 'Warm vintage look', textStyle: 'retro', layout: 'bottom-center', size: 'medium', font: 'Georgia, serif' },
    { id: 'vintage', label: 'Vintage', description: 'Sepia typewriter', textStyle: 'vintage', layout: 'lower-third', size: 'medium', font: 'Georgia, serif' },
    { id: 'pop', label: 'Pop', description: 'Bright and punchy', textStyle: 'pop', layout: 'bottom-center', size: 'large', font: '"Montserrat", sans-serif' },
    { id: 'high-contrast', label: 'Accessible', description: 'High contrast, readable', textStyle: 'high-contrast', layout: 'full-width-bottom', size: 'medium', font: 'Arial, sans-serif' },
    { id: 'kinetic', label: 'Kinetic', description: 'Words pop on beat', textStyle: 'kinetic', layout: 'bottom-center', size: 'large', font: 'Inter, sans-serif' },
];
exports.CAPTION_SIZE_PX = {
    small: 18,
    medium: 24,
    large: 32
};
exports.CAPTION_FONTS = [
    { id: 'Inter', name: 'Inter', family: 'Inter, sans-serif' },
    { id: 'Arial', name: 'Arial', family: 'Arial, Helvetica, sans-serif' },
    { id: 'Georgia', name: 'Georgia', family: 'Georgia, serif' },
    { id: 'Roboto', name: 'Roboto', family: '"Roboto", sans-serif' },
    { id: 'Open Sans', name: 'Open Sans', family: '"Open Sans", sans-serif' },
    { id: 'Playfair Display', name: 'Playfair Display', family: '"Playfair Display", serif' },
    { id: 'Montserrat', name: 'Montserrat', family: '"Montserrat", sans-serif' },
    { id: 'system', name: 'System', family: 'system-ui, -apple-system, sans-serif' }
];
exports.MOTION_GRAPHIC_PRESETS = [
    { id: 'none', label: 'None' },
    { id: 'pulse', label: 'Pulse' },
    { id: 'float', label: 'Float' },
    { id: 'wiggle', label: 'Wiggle' },
    { id: 'glow', label: 'Glow' },
    { id: 'breathe', label: 'Breathe' },
    { id: 'shake', label: 'Shake' },
];
exports.KEYFRAME_ANIMATION_PRESETS = [
    { id: 'slow-zoom', label: 'Slow zoom', description: 'Scale 100% → 110%', start: { scale: 1 }, end: { scale: 1.1 }, easing: 'ease-in-out' },
    { id: 'fly-in-left', label: 'Fly in from left', description: 'Position from off-screen left', start: { positionX: -50 }, end: { positionX: 0 }, easing: 'ease-out' },
    { id: 'fly-in-right', label: 'Fly in from right', description: 'Position from off-screen right', start: { positionX: 50 }, end: { positionX: 0 }, easing: 'ease-out' },
    { id: 'fly-in-top', label: 'Fly in from top', description: 'Position from off-screen top', start: { positionY: -40 }, end: { positionY: 0 }, easing: 'ease-out' },
    { id: 'fly-in-bottom', label: 'Fly in from bottom', description: 'Position from off-screen bottom', start: { positionY: 40 }, end: { positionY: 0 }, easing: 'ease-out' },
    { id: 'fade-in-out', label: 'Fade in & out', description: 'Opacity 0 → 1 → 0', start: { opacity: 0 }, end: { opacity: 1 }, easing: 'ease-in-out' },
];
exports.MOTION_GRAPHIC_TEMPLATES = [
    {
        id: 'lower-third-left',
        name: 'Lower Third Left',
        description: 'Name/title bar sliding from left',
        icon: '📌',
        shapeOverlays: [
            { kind: 'rect', x: 5, y: 78, width: 32, height: 14, color: 'rgba(0,0,0,0.75)', opacity: 1, startOffset: 0, duration: 5 },
        ],
        textOverlays: [
            { text: 'Your Name', x: 18, y: 78, fontSize: 22, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'slide-left', animationOut: 'slide-left', animationInDuration: 0.35, animationOutDuration: 0.25, startOffset: 0, duration: 5 },
            { text: 'Title or Tagline', x: 18, y: 84, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-left', animationOut: 'slide-left', animationInDuration: 0.35, startOffset: 0.1, duration: 5 },
        ],
    },
    {
        id: 'lower-third-minimal',
        name: 'Lower Third Minimal',
        description: 'Simple text bar, no background',
        icon: '▬',
        textOverlays: [
            { text: 'Name · Title', x: 12, y: 82, fontSize: 20, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'outline', outlineColor: '#000000', animationIn: 'fade', animationOut: 'fade', motionGraphic: 'none', startOffset: 0, duration: 5 },
        ],
    },
    {
        id: 'subscribe-bug',
        name: 'Subscribe Bug',
        description: 'Corner reminder with icon placeholder',
        icon: '🔔',
        shapeOverlays: [
            { kind: 'circle', x: 92, y: 12, width: 8, height: 8, color: '#E53935', opacity: 1, startOffset: 0, duration: 5, motionGraphic: 'pulse' },
        ],
        textOverlays: [
            { text: 'SUBSCRIBE', x: 92, y: 12, fontSize: 10, color: '#fff', fontFamily: 'Inter, sans-serif', animationIn: 'pop', animationOut: 'fade', motionGraphic: 'pulse', startOffset: 0, duration: 5 },
        ],
    },
    {
        id: 'countdown-3',
        name: 'Countdown 3-2-1',
        description: 'Three number cards for intros',
        icon: '3️⃣',
        textOverlays: [
            { text: '3', x: 50, y: 50, fontSize: 120, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'shadow', animationIn: 'zoom-in', animationOut: 'scale-out', animationInDuration: 0.2, animationOutDuration: 0.2, startOffset: 0, duration: 1 },
            { text: '2', x: 50, y: 50, fontSize: 120, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'shadow', animationIn: 'zoom-in', animationOut: 'scale-out', animationInDuration: 0.2, animationOutDuration: 0.2, startOffset: 1, duration: 1 },
            { text: '1', x: 50, y: 50, fontSize: 120, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'shadow', animationIn: 'zoom-in', animationOut: 'scale-out', animationInDuration: 0.2, animationOutDuration: 0.2, startOffset: 2, duration: 1 },
        ],
    },
    {
        id: 'bumper-cta',
        name: 'Bumper CTA',
        description: 'Call-to-action bar at bottom',
        icon: '🎯',
        shapeOverlays: [
            { kind: 'rect', x: 50, y: 92, width: 70, height: 10, color: 'rgba(139,92,246,0.9)', opacity: 1, startOffset: 0, duration: 5 },
        ],
        textOverlays: [
            { text: 'Like · Comment · Subscribe', x: 50, y: 92, fontSize: 18, color: '#ffffff', fontFamily: 'Inter, sans-serif', animationIn: 'slide-bottom', animationOut: 'slide-bottom', motionGraphic: 'glow', startOffset: 0, duration: 5 },
        ],
    },
    {
        id: 'quote-card',
        name: 'Quote Card',
        description: 'Centered quote with subtle background',
        icon: '💬',
        shapeOverlays: [
            { kind: 'rect', x: 50, y: 50, width: 75, height: 28, color: 'rgba(0,0,0,0.6)', opacity: 1, startOffset: 0, duration: 6 },
        ],
        textOverlays: [
            { text: '"Your quote here"', x: 50, y: 48, fontSize: 26, color: '#ffffff', fontFamily: 'Georgia, serif', style: 'minimal', animationIn: 'fade', animationOut: 'fade', motionGraphic: 'breathe', startOffset: 0, duration: 6 },
        ],
    },
    {
        id: 'title-reveal',
        name: 'Title Reveal',
        description: 'Big title with slide and glow',
        icon: '✨',
        textOverlays: [
            { text: 'TITLE HERE', x: 50, y: 50, fontSize: 56, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'neon', animationIn: 'blur-in', animationOut: 'fade', animationInDuration: 0.6, motionGraphic: 'glow', startOffset: 0, duration: 4 },
        ],
    },
    {
        id: 'social-handles',
        name: 'Social Handles',
        description: 'Top corner @handle line',
        icon: '📱',
        textOverlays: [
            { text: '@yourhandle', x: 88, y: 8, fontSize: 16, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'slide-right', animationOut: 'slide-right', motionGraphic: 'none', startOffset: 0, duration: 5 },
        ],
    },
    {
        id: 'progress-bar',
        name: 'Progress Bar',
        description: 'Thin progress line at bottom (decorative)',
        icon: '▰',
        shapeOverlays: [
            { kind: 'rect', x: 50, y: 96, width: 100, height: 0.8, color: 'rgba(255,255,255,0.3)', opacity: 1, startOffset: 0, duration: 5 },
            { kind: 'rect', x: 0, y: 96, width: 30, height: 0.8, color: '#8B5CF6', opacity: 1, startOffset: 0, duration: 5 },
        ],
        textOverlays: [],
    },
    {
        id: 'split-lower-third',
        name: 'Split Lower Third',
        description: 'Two lines with accent bar',
        icon: '▌',
        shapeOverlays: [
            { kind: 'rect', x: 8, y: 78, width: 3, height: 12, color: '#8B5CF6', opacity: 1, startOffset: 0, duration: 5 },
            { kind: 'rect', x: 12, y: 78, width: 35, height: 12, color: 'rgba(0,0,0,0.7)', opacity: 1, startOffset: 0, duration: 5 },
        ],
        textOverlays: [
            { text: 'Name', x: 28, y: 78, fontSize: 20, color: '#fff', fontFamily: 'Inter, sans-serif', animationIn: 'slide-left', animationOut: 'slide-left', startOffset: 0, duration: 5 },
            { text: 'Role', x: 28, y: 84, fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-left', startOffset: 0.08, duration: 5 },
        ],
    },
    {
        id: 'lower-third-right',
        name: 'Lower Third Right',
        description: 'Name/title bar from the right',
        icon: '📌',
        shapeOverlays: [
            { kind: 'rect', x: 95, y: 78, width: 32, height: 14, color: 'rgba(0,0,0,0.75)', opacity: 1, startOffset: 0, duration: 5 },
        ],
        textOverlays: [
            { text: 'Your Name', x: 82, y: 78, fontSize: 22, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'slide-right', animationOut: 'slide-right', animationInDuration: 0.35, animationOutDuration: 0.25, startOffset: 0, duration: 5 },
            { text: 'Title or Tagline', x: 82, y: 84, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-right', animationOut: 'slide-right', animationInDuration: 0.35, startOffset: 0.1, duration: 5 },
        ],
    },
    {
        id: 'coming-up',
        name: 'Coming Up',
        description: 'Teaser line for next segment',
        icon: '⏭',
        textOverlays: [
            { text: 'COMING UP', x: 50, y: 25, fontSize: 18, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif', style: 'minimal', animationIn: 'slide-top', animationOut: 'slide-top', motionGraphic: 'none', startOffset: 0, duration: 4 },
            { text: 'Next: Your topic here', x: 50, y: 32, fontSize: 28, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'fade', animationOut: 'fade', startOffset: 0.15, duration: 4 },
        ],
    },
    {
        id: 'end-card',
        name: 'End Card',
        description: 'Outro with CTA and handle',
        icon: '🛑',
        shapeOverlays: [
            { kind: 'rect', x: 50, y: 50, width: 80, height: 45, color: 'rgba(0,0,0,0.85)', opacity: 1, startOffset: 0, duration: 8 },
        ],
        textOverlays: [
            { text: 'Thanks for watching', x: 50, y: 42, fontSize: 32, color: '#ffffff', fontFamily: 'Inter, sans-serif', animationIn: 'fade', animationOut: 'fade', startOffset: 0, duration: 8 },
            { text: 'Like · Subscribe · @yourhandle', x: 50, y: 58, fontSize: 20, color: 'rgba(255,255,255,0.95)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-bottom', animationOut: 'fade', motionGraphic: 'glow', startOffset: 0.3, duration: 8 },
        ],
    },
    {
        id: 'particle-accent',
        name: 'Particle accent',
        description: 'Subtle floating particles for energy',
        icon: '✨',
        shapeOverlays: [
            { kind: 'circle', x: 15, y: 20, width: 1.5, height: 1.5, color: 'rgba(255,255,255,0.6)', opacity: 1, startOffset: 0, duration: 6, motionGraphic: 'float' },
            { kind: 'circle', x: 85, y: 25, width: 1, height: 1, color: 'rgba(255,255,255,0.5)', opacity: 1, startOffset: 0.5, duration: 6, motionGraphic: 'float' },
            { kind: 'circle', x: 90, y: 75, width: 1.2, height: 1.2, color: 'rgba(255,255,255,0.4)', opacity: 1, startOffset: 1, duration: 6, motionGraphic: 'float' },
            { kind: 'circle', x: 10, y: 80, width: 1, height: 1, color: 'rgba(255,255,255,0.5)', opacity: 1, startOffset: 0.3, duration: 6, motionGraphic: 'float' },
        ],
        textOverlays: [],
    },
];
exports.KEYFRAME_EASINGS = [
    { id: 'linear', label: 'Linear' },
    { id: 'ease-in', label: 'Ease In' },
    { id: 'ease-out', label: 'Ease Out' },
    { id: 'ease-in-out', label: 'Ease In-Out' },
    { id: 'ease-in-out-cubic', label: 'Smooth' },
    { id: 'bounce-out', label: 'Bounce Out' },
    { id: 'bounce-in-out', label: 'Bounce' },
];
exports.EFFECT_EASINGS = [
    { id: 'none', label: 'None', icon: '━' },
    { id: 'linear', label: 'Linear', icon: '📈' },
    { id: 'ease-in', label: 'Ease In', icon: '🚀' },
    { id: 'ease-out', label: 'Ease Out', icon: '🛬' },
    { id: 'ease-in-out', label: 'Ease In-Out', icon: '🌊' },
];
exports.EFFECT_TYPE_COLORS = {
    filter: '#8B5CF6', // Purple
    transition: '#EC4899', // Pink
    motion: '#F59E0B', // Amber
    overlay: '#10B981', // Emerald
    speed: '#3B82F6', // Blue
    audio: '#EF4444', // Red
    retention: '#FCD34D', // Yellow
    style: '#A78BFA', // Lavender
};
exports.EFFECT_PRESETS = [
    // Filters
    { type: 'filter', name: 'Warm Glow', icon: '🌅', params: { temperature: 120, brightness: 105, saturation: 110 } },
    { type: 'filter', name: 'Cool Tone', icon: '❄️', params: { temperature: 80, brightness: 100, saturation: 95 } },
    { type: 'filter', name: 'Vintage', icon: '📷', params: { sepia: 30, saturation: 80, contrast: 110 } },
    { type: 'filter', name: 'High Contrast', icon: '⚡', params: { contrast: 130, brightness: 105, saturation: 115 } },
    { type: 'filter', name: 'Desaturate', icon: '🎭', params: { saturation: 50, contrast: 105 } },
    // Transitions
    { type: 'transition', name: 'Fade In', icon: '🌙', params: { direction: 'in', duration: 1 } },
    { type: 'transition', name: 'Fade Out', icon: '🌑', params: { direction: 'out', duration: 1 } },
    { type: 'transition', name: 'Cross Dissolve', icon: '✨', params: { style: 'dissolve', duration: 0.5 } },
    { type: 'transition', name: 'Wipe Right', icon: '➡️', params: { style: 'wipe', direction: 'right' } },
    { type: 'transition', name: 'Blur Transition', icon: '🔮', params: { style: 'blur', amount: 10 } },
    // Motion
    { type: 'motion', name: 'Slow Zoom In', icon: '🔍', params: { zoom: 110, duration: 3 } },
    { type: 'motion', name: 'Slow Zoom Out', icon: '🔎', params: { zoom: 90, duration: 3 } },
    { type: 'motion', name: 'Pan Left', icon: '⬅️', params: { panX: -10, duration: 2 } },
    { type: 'motion', name: 'Pan Right', icon: '➡️', params: { panX: 10, duration: 2 } },
    { type: 'motion', name: 'Shake', icon: '📳', params: { intensity: 5, frequency: 10 } },
    { type: 'motion', name: 'Ken Burns In', icon: '📷', params: { zoom: 115, panX: 5, panY: 5, duration: 4 } },
    { type: 'motion', name: 'Ken Burns Out', icon: '📷', params: { zoom: 85, panX: -5, panY: -5, duration: 4 } },
    { type: 'motion', name: 'Smooth Zoom In', icon: '🔎', params: { zoom: 105, duration: 5, easing: 'ease-out' } },
    { type: 'motion', name: 'Smooth Zoom Out', icon: '🔍', params: { zoom: 95, duration: 5, easing: 'ease-in' } },
    { type: 'motion', name: 'Parallax Left', icon: '⬅️', params: { panX: -15, duration: 3, easing: 'linear' } },
    { type: 'motion', name: 'Parallax Right', icon: '➡️', params: { panX: 15, duration: 3, easing: 'linear' } },
    { type: 'motion', name: 'Subtle Drift', icon: '🌊', params: { panX: 3, panY: 2, duration: 6 } },
    { type: 'motion', name: 'Dramatic Zoom', icon: '🎬', params: { zoom: 130, duration: 2 } },
    { type: 'motion', name: 'Push In', icon: '📐', params: { zoom: 108, duration: 3 } },
    { type: 'motion', name: 'Pull Back', icon: '📐', params: { zoom: 92, duration: 3 } },
    // Overlays
    { type: 'overlay', name: 'Vignette', icon: '🎬', params: { strength: 30, softness: 50 } },
    { type: 'overlay', name: 'Film Grain', icon: '🎞️', params: { amount: 20, size: 1.5 } },
    { type: 'overlay', name: 'Light Leak', icon: '☀️', params: { intensity: 40, position: 'top-right' } },
    { type: 'overlay', name: 'Letterbox', icon: '📽️', params: { ratio: 2.39, color: '#000000' } },
    { type: 'overlay', name: 'Dust & Scratches', icon: '🧹', params: { density: 15, opacity: 30 } },
    { type: 'overlay', name: 'Cinematic Vignette', icon: '🎬', params: { strength: 35, softness: 60 } },
    { type: 'overlay', name: 'Light Leak Gold', icon: '☀️', params: { intensity: 45, position: 'top-right' } },
    { type: 'overlay', name: 'Soft Glow', icon: '✨', params: { strength: 20, softness: 80 } },
    { type: 'motion', name: 'Cinematic Push In', icon: '📐', params: { zoom: 105, duration: 4, easing: 'ease-out' } },
    { type: 'motion', name: 'Reveal Zoom Out', icon: '🔍', params: { zoom: 85, duration: 3, easing: 'ease-in' } },
    // Speed
    { type: 'speed', name: 'Slow Motion 50%', icon: '🐢', params: { rate: 0.5 } },
    { type: 'speed', name: 'Slow Motion 25%', icon: '🦥', params: { rate: 0.25 } },
    { type: 'speed', name: 'Fast Forward 2x', icon: '⏩', params: { rate: 2 } },
    { type: 'speed', name: 'Fast Forward 4x', icon: '🚀', params: { rate: 4 } },
    { type: 'speed', name: 'Reverse', icon: '⏪', params: { rate: -1 } },
    // Audio
    { type: 'audio', name: 'Echo', icon: '🔊', params: { delay: 0.3, decay: 0.5 } },
    { type: 'audio', name: 'Reverb', icon: '🏛️', params: { roomSize: 0.7, wetLevel: 0.3 } },
    { type: 'audio', name: 'Fade Audio', icon: '🔉', params: { direction: 'in', duration: 1 } },
    { type: 'audio', name: 'Bass Boost', icon: '🎸', params: { gain: 6, frequency: 100 } },
    { type: 'audio', name: 'Vocal Enhance', icon: '🎤', params: { midGain: 4, clarity: 20 } },
    // Retention Boosters (Viral/Hook & Smart Camera)
    { type: 'retention', name: 'Viral Hook Zoom', icon: '🪝', params: { zoom: 125, duration: 0.3, easing: 'bounce-out' } },
    { type: 'retention', name: 'Smart Camera: Follow', icon: '🎥', params: { mode: 'follow', smoothness: 80, tracking: 'head' } },
    { type: 'retention', name: 'Dynamic Punch-In', icon: '🥊', params: { zoom: 140, duration: 0.15, easing: 'ease-out' } },
    { type: 'retention', name: 'Glitch Pop', icon: '👾', params: { intensity: 60, speed: 80, chromatic: 15 } },
    { type: 'retention', name: 'Viral Glow', icon: '🌟', params: { brightness: 120, blur: 15, bloom: 40 } },
    { type: 'retention', name: 'Jump Cut', icon: '✂️', params: { type: 'hard-cut', zoom: 105 } },
    { type: 'retention', name: 'Viral Swoosh', icon: '💨', params: { type: 'sfx', sound: 'swoosh_heavy', volume: 0.8 } },
];
exports.EDITOR_CONTENT_PREFS_KEY = 'editor-content-preferences';
