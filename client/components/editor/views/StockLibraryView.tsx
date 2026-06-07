'use client'

import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  Film, Music, Volume2, Image as ImageIcon, Sticker, Wand2, Search, X,
  Play, Pause, Plus, Heart, Filter, Clock, Tag,
  Sparkles, Flame, Zap, Coffee, Cpu, Rocket, Globe, Heart as HeartIcon,
  TrendingUp, Layers, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { Panel, Badge, SectionHeader, EmptyState, Button } from '../../ui'
import { cn } from '../../../lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────
type StockCategory = 'broll' | 'music' | 'sfx' | 'gif' | 'sticker' | 'transition'

interface StockItem {
  id: string
  category: StockCategory
  title: string
  url: string
  thumb?: string
  duration?: number       // seconds
  bpm?: number            // music
  mood: string
  tags: string[]
  premium?: boolean
}

interface StockLibraryViewProps {
  setTimelineSegments?: (fn: any) => void
  showToast?: (m: string, t: 'success' | 'info' | 'error') => void
  onAddToTimeline?: (item: StockItem) => void
  currentTime?: number
  videoDuration?: number
}

// ── Curated stock data ──────────────────────────────────────────────────────
// All URLs are public-domain or CC0 sample assets. Replaceable with a real
// stock-API response (Pexels / Pixabay / Mixkit / Freesound) once wired.

const BROLL: StockItem[] = [
  { id: 'b-001', category: 'broll', title: 'City skyline timelapse',         url: 'https://cdn.pixabay.com/video/2017/11/08/12937-242664851_large.mp4', thumb: 'https://cdn.pixabay.com/video/2017/11/08/12937-242664851_tiny.jpg', duration: 12, mood: 'Urban',     tags: ['city','timelapse','aerial'] },
  { id: 'b-002', category: 'broll', title: 'Coffee pour 60fps macro',        url: 'https://cdn.pixabay.com/video/2020/06/28/43249-435873262_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/06/28/43249-435873262_tiny.jpg', duration: 8,  mood: 'Cozy',      tags: ['coffee','macro','sensory'], premium: true },
  { id: 'b-003', category: 'broll', title: 'Beach waves slow motion',        url: 'https://cdn.pixabay.com/video/2019/06/06/24241-340484253_large.mp4', thumb: 'https://cdn.pixabay.com/video/2019/06/06/24241-340484253_tiny.jpg', duration: 15, mood: 'Lifestyle', tags: ['beach','waves','calm'] },
  { id: 'b-004', category: 'broll', title: 'Stock chart growth animation',   url: 'https://cdn.pixabay.com/video/2024/07/15/222093-983893265_large.mp4', thumb: 'https://cdn.pixabay.com/video/2024/07/15/222093-983893265_tiny.jpg', duration: 6,  mood: 'Finance',   tags: ['stocks','growth','data'], premium: true },
  { id: 'b-005', category: 'broll', title: 'Forest aerial drone',            url: 'https://cdn.pixabay.com/video/2021/08/31/86598-595069488_large.mp4', thumb: 'https://cdn.pixabay.com/video/2021/08/31/86598-595069488_tiny.jpg', duration: 18, mood: 'Nature',    tags: ['forest','drone','aerial'] },
  { id: 'b-006', category: 'broll', title: 'Neon cyberpunk street',          url: 'https://cdn.pixabay.com/video/2023/05/27/164611-830537127_large.mp4', thumb: 'https://cdn.pixabay.com/video/2023/05/27/164611-830537127_tiny.jpg', duration: 10, mood: 'Tech',      tags: ['neon','cyberpunk','night'] },
  { id: 'b-007', category: 'broll', title: 'Gym workout tracking shot',      url: 'https://cdn.pixabay.com/video/2020/02/12/31858-391432466_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/02/12/31858-391432466_tiny.jpg', duration: 9,  mood: 'Fitness',   tags: ['gym','workout','tracking'] },
  { id: 'b-008', category: 'broll', title: 'Laptop typing close-up',         url: 'https://cdn.pixabay.com/video/2019/04/15/22639-331538195_large.mp4', thumb: 'https://cdn.pixabay.com/video/2019/04/15/22639-331538195_tiny.jpg', duration: 7,  mood: 'Productivity', tags: ['laptop','typing','work'] },
  { id: 'b-009', category: 'broll', title: 'Sunset golden hour landscape',   url: 'https://cdn.pixabay.com/video/2022/02/12/107283-680846848_large.mp4', thumb: 'https://cdn.pixabay.com/video/2022/02/12/107283-680846848_tiny.jpg', duration: 14, mood: 'Cinematic', tags: ['sunset','golden','landscape'] },
  { id: 'b-010', category: 'broll', title: 'Money bills counting',           url: 'https://cdn.pixabay.com/video/2023/12/19/192829-895110554_large.mp4', thumb: 'https://cdn.pixabay.com/video/2023/12/19/192829-895110554_tiny.jpg', duration: 6,  mood: 'Finance',   tags: ['money','wealth','cash'], premium: true },
  { id: 'b-011', category: 'broll', title: 'Friends laughing at cafe',       url: 'https://cdn.pixabay.com/video/2020/05/25/40021-422992042_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/05/25/40021-422992042_tiny.jpg', duration: 11, mood: 'Lifestyle', tags: ['friends','cafe','social'] },
  { id: 'b-012', category: 'broll', title: 'Code on monitor loop',           url: 'https://cdn.pixabay.com/video/2023/01/19/146913-790108321_large.mp4', thumb: 'https://cdn.pixabay.com/video/2023/01/19/146913-790108321_tiny.jpg', duration: 8,  mood: 'Tech',      tags: ['code','monitor','dev'] },
  { id: 'b-013', category: 'broll', title: 'Mountain peak at dawn',          url: 'https://cdn.pixabay.com/video/2020/12/27/60139-494178519_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/12/27/60139-494178519_tiny.jpg', duration: 16, mood: 'Cinematic', tags: ['mountain','dawn','epic'] },
  { id: 'b-014', category: 'broll', title: 'Hands typing phone',             url: 'https://cdn.pixabay.com/video/2020/04/08/35094-406927898_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/04/08/35094-406927898_tiny.jpg', duration: 6,  mood: 'Lifestyle', tags: ['phone','hands','social'] },
  { id: 'b-015', category: 'broll', title: 'Smoke wisps abstract',           url: 'https://cdn.pixabay.com/video/2020/03/08/33244-396435402_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/03/08/33244-396435402_tiny.jpg', duration: 9,  mood: 'Abstract',  tags: ['smoke','abstract','overlay'] },
  { id: 'b-016', category: 'broll', title: 'Skyscraper looking up',          url: 'https://cdn.pixabay.com/video/2017/05/24/9462-219088514_large.mp4', thumb: 'https://cdn.pixabay.com/video/2017/05/24/9462-219088514_tiny.jpg', duration: 8,  mood: 'Urban',     tags: ['skyscraper','city','vertical'] },
  { id: 'b-017', category: 'broll', title: 'Plant time-lapse growth',        url: 'https://cdn.pixabay.com/video/2020/05/13/38866-419045895_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/05/13/38866-419045895_tiny.jpg', duration: 10, mood: 'Nature',    tags: ['plant','growth','time-lapse'] },
  { id: 'b-018', category: 'broll', title: 'Skater sunset silhouette',       url: 'https://cdn.pixabay.com/video/2020/08/30/48304-454495151_large.mp4', thumb: 'https://cdn.pixabay.com/video/2020/08/30/48304-454495151_tiny.jpg', duration: 12, mood: 'Lifestyle', tags: ['skate','sunset','youth'] },
  { id: 'b-019', category: 'broll', title: 'Ink drop in water',              url: 'https://cdn.pixabay.com/video/2017/09/11/12012-233512300_large.mp4', thumb: 'https://cdn.pixabay.com/video/2017/09/11/12012-233512300_tiny.jpg', duration: 7,  mood: 'Abstract',  tags: ['ink','water','art'] },
  { id: 'b-020', category: 'broll', title: 'Gourmet meal plating',           url: 'https://cdn.pixabay.com/video/2022/05/02/116080-707076632_large.mp4', thumb: 'https://cdn.pixabay.com/video/2022/05/02/116080-707076632_tiny.jpg', duration: 9,  mood: 'Food',      tags: ['food','plating','chef'] },
]

const MUSIC: StockItem[] = [
  { id: 'm-001', category: 'music', title: 'Hype Energy Drop',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: 220, bpm: 128, mood: 'Energy',    tags: ['hype','edm','workout'] },
  { id: 'm-002', category: 'music', title: 'Lo-fi Study Loop',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration: 180, bpm: 88,  mood: 'Cozy',      tags: ['lofi','chill','study'] },
  { id: 'm-003', category: 'music', title: 'Cinematic Build',        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration: 240, bpm: 95,  mood: 'Cinematic', tags: ['cinematic','epic','film'] },
  { id: 'm-004', category: 'music', title: 'Trap Bass Drop',         url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', duration: 200, bpm: 140, mood: 'Energy',    tags: ['trap','viral','tiktok'] },
  { id: 'm-005', category: 'music', title: 'Corporate Inspire',      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', duration: 195, bpm: 110, mood: 'Corporate', tags: ['corporate','clean','b2b'] },
  { id: 'm-006', category: 'music', title: 'Dreamy Synth Pad',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', duration: 210, bpm: 72,  mood: 'Ambient',   tags: ['dreamy','ambient','calm'] },
  { id: 'm-007', category: 'music', title: 'Acoustic Vlog Folk',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', duration: 175, bpm: 100, mood: 'Lifestyle', tags: ['acoustic','vlog','folk'] },
  { id: 'm-008', category: 'music', title: 'Neon Synthwave',         url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', duration: 230, bpm: 116, mood: 'Tech',      tags: ['synthwave','retro','80s'], premium: true },
  { id: 'm-009', category: 'music', title: 'Deep House Vibes',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', duration: 250, bpm: 124, mood: 'Energy',    tags: ['house','dance','party'] },
  { id: 'm-010', category: 'music', title: 'Piano Storytelling',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', duration: 190, bpm: 80,  mood: 'Cinematic', tags: ['piano','emotional','story'] },
  { id: 'm-011', category: 'music', title: 'Hip-Hop Old School',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', duration: 200, bpm: 92,  mood: 'Energy',    tags: ['hiphop','beats','classic'] },
  { id: 'm-012', category: 'music', title: 'Tropical Summer',        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', duration: 185, bpm: 105, mood: 'Lifestyle', tags: ['tropical','summer','beach'] },
  { id: 'm-013', category: 'music', title: 'Dramatic Trailer',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', duration: 165, bpm: 90,  mood: 'Cinematic', tags: ['trailer','dramatic','tense'], premium: true },
  { id: 'm-014', category: 'music', title: 'Indie Pop Bright',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', duration: 195, bpm: 118, mood: 'Lifestyle', tags: ['indie','pop','bright'] },
  { id: 'm-015', category: 'music', title: 'Tech Glitch Loop',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', duration: 150, bpm: 130, mood: 'Tech',      tags: ['glitch','tech','loop'] },
  { id: 'm-016', category: 'music', title: 'Reggaeton Heat',         url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', duration: 215, bpm: 96,  mood: 'Energy',    tags: ['reggaeton','latin','dance'] },
  { id: 'm-017', category: 'music', title: 'Quiet Reflection',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3', duration: 240, bpm: 65,  mood: 'Ambient',   tags: ['quiet','reflective','spa'] },
  { id: 'm-018', category: 'music', title: 'Trailer Boom Hits',      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-18.mp3', duration: 130, bpm: 100, mood: 'Cinematic', tags: ['boom','hits','trailer'] },
  { id: 'm-019', category: 'music', title: 'Funky Groove Bass',      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-19.mp3', duration: 220, bpm: 112, mood: 'Energy',    tags: ['funk','groove','bass'] },
  { id: 'm-020', category: 'music', title: 'Future Bass Anthem',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-20.mp3', duration: 200, bpm: 132, mood: 'Energy',    tags: ['future','bass','drop'], premium: true },
]

const SFX: StockItem[] = [
  { id: 'sfx-001', category: 'sfx', title: 'Bass drop punch',       url: '', duration: 1, mood: 'Impact',     tags: ['drop','bass','punch'] },
  { id: 'sfx-002', category: 'sfx', title: 'Whoosh transition',     url: '', duration: 1, mood: 'Transition', tags: ['whoosh','swipe','cut'] },
  { id: 'sfx-003', category: 'sfx', title: 'Riser uplift',          url: '', duration: 3, mood: 'Build',      tags: ['riser','uplift','tension'] },
  { id: 'sfx-004', category: 'sfx', title: 'Glitch burst',          url: '', duration: 1, mood: 'Tech',       tags: ['glitch','burst','digital'] },
  { id: 'sfx-005', category: 'sfx', title: 'Cinematic boom',        url: '', duration: 2, mood: 'Impact',     tags: ['boom','cinematic','trailer'] },
  { id: 'sfx-006', category: 'sfx', title: 'Cash register ka-ching',url: '', duration: 1, mood: 'Trigger',    tags: ['cash','money','reward'] },
  { id: 'sfx-007', category: 'sfx', title: 'Notification ping',     url: '', duration: 1, mood: 'Trigger',    tags: ['ping','alert','notif'] },
  { id: 'sfx-008', category: 'sfx', title: 'Camera shutter click',  url: '', duration: 1, mood: 'Trigger',    tags: ['camera','shutter','snap'] },
  { id: 'sfx-009', category: 'sfx', title: 'Vinyl scratch reverse', url: '', duration: 2, mood: 'Transition', tags: ['vinyl','scratch','dj'] },
  { id: 'sfx-010', category: 'sfx', title: 'Crowd cheer applause',  url: '', duration: 4, mood: 'Reaction',   tags: ['crowd','cheer','applause'] },
  { id: 'sfx-011', category: 'sfx', title: 'Drum fill sting',       url: '', duration: 2, mood: 'Build',      tags: ['drum','fill','sting'] },
  { id: 'sfx-012', category: 'sfx', title: 'Vinyl needle drop',     url: '', duration: 1, mood: 'Transition', tags: ['vinyl','needle','intro'] },
  { id: 'sfx-013', category: 'sfx', title: 'UI tap success',        url: '', duration: 1, mood: 'Trigger',    tags: ['ui','tap','success'] },
  { id: 'sfx-014', category: 'sfx', title: 'Laser zap',             url: '', duration: 1, mood: 'Tech',       tags: ['laser','zap','sci-fi'] },
  { id: 'sfx-015', category: 'sfx', title: 'Page flip whoosh',      url: '', duration: 1, mood: 'Transition', tags: ['page','flip','book'] },
  { id: 'sfx-016', category: 'sfx', title: 'Stinger orchestral',    url: '', duration: 2, mood: 'Impact',     tags: ['stinger','orchestral','epic'] },
  { id: 'sfx-017', category: 'sfx', title: 'Glass tap chime',       url: '', duration: 1, mood: 'Trigger',    tags: ['glass','tap','chime'] },
  { id: 'sfx-018', category: 'sfx', title: 'Distortion sweep',      url: '', duration: 2, mood: 'Tech',       tags: ['distortion','sweep','heavy'] },
  { id: 'sfx-019', category: 'sfx', title: 'Heartbeat thump',       url: '', duration: 3, mood: 'Tension',    tags: ['heart','thump','suspense'] },
  { id: 'sfx-020', category: 'sfx', title: 'Coin pickup',           url: '', duration: 1, mood: 'Trigger',    tags: ['coin','game','retro'] },
]

const GIFS: StockItem[] = [
  { id: 'g-001', category: 'gif', title: 'Mind blown reaction',    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',   thumb: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif', mood: 'Reaction', tags: ['mind','blown','wow'] },
  { id: 'g-002', category: 'gif', title: 'Yes celebration',         url: 'https://media.giphy.com/media/3oz8xAFtqoOUUrsh7W/giphy.gif',   thumb: 'https://media.giphy.com/media/3oz8xAFtqoOUUrsh7W/200w.gif', mood: 'Reaction', tags: ['yes','celebrate','win'] },
  { id: 'g-003', category: 'gif', title: 'Money rain falling',      url: 'https://media.giphy.com/media/JtBZm3Getg3dqxK0zP/giphy.gif',   thumb: 'https://media.giphy.com/media/JtBZm3Getg3dqxK0zP/200w.gif', mood: 'Finance',  tags: ['money','rain','wealth'] },
  { id: 'g-004', category: 'gif', title: 'Confetti pop',            url: 'https://media.giphy.com/media/26FPCXdkvDbKBbgWA/giphy.gif',   thumb: 'https://media.giphy.com/media/26FPCXdkvDbKBbgWA/200w.gif', mood: 'Celebration', tags: ['confetti','party','win'] },
  { id: 'g-005', category: 'gif', title: 'Looking around suspicious',url:'https://media.giphy.com/media/3o7TKsQ8gqVrxZZkS4/giphy.gif',   thumb: 'https://media.giphy.com/media/3o7TKsQ8gqVrxZZkS4/200w.gif', mood: 'Reaction', tags: ['suspicious','look','meme'] },
  { id: 'g-006', category: 'gif', title: 'Thumbs up approval',      url: 'https://media.giphy.com/media/26gsrRaylU5RxaxmU/giphy.gif',   thumb: 'https://media.giphy.com/media/26gsrRaylU5RxaxmU/200w.gif', mood: 'Reaction', tags: ['thumbs','up','approve'] },
  { id: 'g-007', category: 'gif', title: 'Glitter sparkles loop',   url: 'https://media.giphy.com/media/3o7TKsQrjXopqrKD3i/giphy.gif',   thumb: 'https://media.giphy.com/media/3o7TKsQrjXopqrKD3i/200w.gif', mood: 'Aesthetic',tags: ['glitter','sparkle','loop'] },
  { id: 'g-008', category: 'gif', title: 'Eye roll meme',           url: 'https://media.giphy.com/media/QQ2FN16HAEXigwQOPk/giphy.gif',   thumb: 'https://media.giphy.com/media/QQ2FN16HAEXigwQOPk/200w.gif', mood: 'Reaction', tags: ['eyeroll','tired','meme'] },
  { id: 'g-009', category: 'gif', title: 'Fire burning loop',       url: 'https://media.giphy.com/media/lp3GUtG2waCMo/giphy.gif',         thumb: 'https://media.giphy.com/media/lp3GUtG2waCMo/200w.gif',     mood: 'Energy',   tags: ['fire','flames','hype'] },
  { id: 'g-010', category: 'gif', title: 'Galaxy particles',        url: 'https://media.giphy.com/media/3oxRm1aTkFp1lWzxnG/giphy.gif',   thumb: 'https://media.giphy.com/media/3oxRm1aTkFp1lWzxnG/200w.gif', mood: 'Aesthetic',tags: ['galaxy','space','dreamy'] },
  { id: 'g-011', category: 'gif', title: 'Loading spinner clean',   url: 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif',   thumb: 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/200w.gif', mood: 'Tech',     tags: ['loading','spinner','ui'] },
  { id: 'g-012', category: 'gif', title: 'Heart pulse beat',        url: 'https://media.giphy.com/media/9JsX6keuIvEPYUuUAd/giphy.gif',   thumb: 'https://media.giphy.com/media/9JsX6keuIvEPYUuUAd/200w.gif', mood: 'Reaction', tags: ['heart','pulse','love'] },
  { id: 'g-013', category: 'gif', title: 'Skeleton dance loop',     url: 'https://media.giphy.com/media/Ju7l5y9osyymQ/giphy.gif',         thumb: 'https://media.giphy.com/media/Ju7l5y9osyymQ/200w.gif',     mood: 'Reaction', tags: ['dance','skeleton','meme'] },
  { id: 'g-014', category: 'gif', title: 'Lightning bolt energy',   url: 'https://media.giphy.com/media/xT9DPB46tigHGeYbWg/giphy.gif',   thumb: 'https://media.giphy.com/media/xT9DPB46tigHGeYbWg/200w.gif', mood: 'Energy',   tags: ['lightning','power','energy'] },
  { id: 'g-015', category: 'gif', title: 'Clapping hands',          url: 'https://media.giphy.com/media/26FmRLBRZfpMNwWdy/giphy.gif',   thumb: 'https://media.giphy.com/media/26FmRLBRZfpMNwWdy/200w.gif', mood: 'Reaction', tags: ['clap','applause','win'] },
  { id: 'g-016', category: 'gif', title: 'Smoke wisps overlay',     url: 'https://media.giphy.com/media/l4FGsehyGwL5M/giphy.gif',         thumb: 'https://media.giphy.com/media/l4FGsehyGwL5M/200w.gif',     mood: 'Aesthetic',tags: ['smoke','overlay','mystic'] },
  { id: 'g-017', category: 'gif', title: 'VHS distortion loop',     url: 'https://media.giphy.com/media/l3vRfNA1p0rt5Mz5e/giphy.gif',     thumb: 'https://media.giphy.com/media/l3vRfNA1p0rt5Mz5e/200w.gif', mood: 'Tech',     tags: ['vhs','distortion','retro'] },
  { id: 'g-018', category: 'gif', title: 'Crying laugh tears',      url: 'https://media.giphy.com/media/HhTXt43pk1I1W/giphy.gif',         thumb: 'https://media.giphy.com/media/HhTXt43pk1I1W/200w.gif',     mood: 'Reaction', tags: ['laugh','crying','meme'] },
]

const STICKERS: StockItem[] = [
  { id: 's-001', category: 'sticker', title: '🔥 Fire',         url: '🔥', mood: 'Reaction',  tags: ['fire','hype','viral'] },
  { id: 's-002', category: 'sticker', title: '✨ Sparkles',     url: '✨', mood: 'Aesthetic', tags: ['sparkles','aesthetic','magic'] },
  { id: 's-003', category: 'sticker', title: '💯 Hundred',      url: '💯', mood: 'Reaction',  tags: ['hundred','perfect','agree'] },
  { id: 's-004', category: 'sticker', title: '🎯 Bullseye',     url: '🎯', mood: 'Strategy',  tags: ['target','aim','goal'] },
  { id: 's-005', category: 'sticker', title: '🚀 Rocket',       url: '🚀', mood: 'Energy',    tags: ['rocket','launch','growth'] },
  { id: 's-006', category: 'sticker', title: '👀 Eyes',         url: '👀', mood: 'Reaction',  tags: ['eyes','look','curiosity'] },
  { id: 's-007', category: 'sticker', title: '💸 Money',        url: '💸', mood: 'Finance',   tags: ['money','dollar','cash'] },
  { id: 's-008', category: 'sticker', title: '⚡ Lightning',    url: '⚡', mood: 'Energy',    tags: ['lightning','fast','power'] },
  { id: 's-009', category: 'sticker', title: '🎬 Clapboard',    url: '🎬', mood: 'Cinematic', tags: ['clapboard','film','start'] },
  { id: 's-010', category: 'sticker', title: '🧠 Brain',        url: '🧠', mood: 'Strategy',  tags: ['brain','smart','idea'] },
  { id: 's-011', category: 'sticker', title: '🤯 Mind blown',   url: '🤯', mood: 'Reaction',  tags: ['mind','blown','wow'] },
  { id: 's-012', category: 'sticker', title: '👇 Tap below',    url: '👇', mood: 'CTA',       tags: ['tap','below','swipe'] },
  { id: 's-013', category: 'sticker', title: '⏰ Time',         url: '⏰', mood: 'Strategy',  tags: ['time','clock','urgent'] },
  { id: 's-014', category: 'sticker', title: '🎉 Party',        url: '🎉', mood: 'Celebration', tags: ['party','celebrate','launch'] },
  { id: 's-015', category: 'sticker', title: '✅ Check',         url: '✅', mood: 'CTA',       tags: ['check','done','agree'] },
  { id: 's-016', category: 'sticker', title: '❌ X',             url: '❌', mood: 'CTA',       tags: ['x','no','cancel'] },
  { id: 's-017', category: 'sticker', title: '⭐ Star',          url: '⭐', mood: 'Aesthetic', tags: ['star','rating','best'] },
  { id: 's-018', category: 'sticker', title: '🌊 Wave',         url: '🌊', mood: 'Aesthetic', tags: ['wave','flow','calm'] },
  { id: 's-019', category: 'sticker', title: '🎵 Note',         url: '🎵', mood: 'Music',     tags: ['music','note','beat'] },
  { id: 's-020', category: 'sticker', title: '📈 Chart up',     url: '📈', mood: 'Finance',   tags: ['chart','growth','up'] },
  { id: 's-021', category: 'sticker', title: '🔔 Bell',         url: '🔔', mood: 'CTA',       tags: ['bell','notify','sub'] },
  { id: 's-022', category: 'sticker', title: '💪 Muscle',       url: '💪', mood: 'Energy',    tags: ['muscle','strong','fitness'] },
  { id: 's-023', category: 'sticker', title: '🏆 Trophy',       url: '🏆', mood: 'Celebration', tags: ['trophy','win','achievement'] },
  { id: 's-024', category: 'sticker', title: '👉 Tap right',    url: '👉', mood: 'CTA',       tags: ['tap','right','swipe'] },
]

const TRANSITIONS: StockItem[] = [
  { id: 't-001', category: 'transition', title: 'Whip pan fast',       url: 'whip-pan',     duration: 0.4, mood: 'Energy',     tags: ['whip','pan','fast'] },
  { id: 't-002', category: 'transition', title: 'Zoom punch in',       url: 'zoom-in',      duration: 0.3, mood: 'Energy',     tags: ['zoom','punch','impact'] },
  { id: 't-003', category: 'transition', title: 'Glitch RGB split',    url: 'glitch-rgb',   duration: 0.5, mood: 'Tech',       tags: ['glitch','rgb','digital'] },
  { id: 't-004', category: 'transition', title: 'Dissolve smooth',     url: 'dissolve',     duration: 0.8, mood: 'Cinematic',  tags: ['dissolve','smooth','classic'] },
  { id: 't-005', category: 'transition', title: 'Slide left/right',    url: 'slide',        duration: 0.4, mood: 'Modern',     tags: ['slide','direction','clean'] },
  { id: 't-006', category: 'transition', title: 'Black flash cut',     url: 'flash-black',  duration: 0.2, mood: 'Energy',     tags: ['flash','black','impact'] },
  { id: 't-007', category: 'transition', title: 'White flash cut',     url: 'flash-white',  duration: 0.2, mood: 'Energy',     tags: ['flash','white','impact'] },
  { id: 't-008', category: 'transition', title: 'Spin rotate',         url: 'spin',         duration: 0.5, mood: 'Energy',     tags: ['spin','rotate','dynamic'] },
  { id: 't-009', category: 'transition', title: 'Swipe paint reveal',  url: 'swipe-paint',  duration: 0.6, mood: 'Modern',     tags: ['swipe','paint','reveal'] },
  { id: 't-010', category: 'transition', title: 'Light leak warm',     url: 'light-leak',   duration: 0.7, mood: 'Cinematic',  tags: ['light','leak','vintage'] },
  { id: 't-011', category: 'transition', title: 'Pixelate dissolve',   url: 'pixelate',     duration: 0.5, mood: 'Tech',       tags: ['pixelate','retro','8bit'] },
  { id: 't-012', category: 'transition', title: 'Shutter blinds',      url: 'shutter',      duration: 0.4, mood: 'Modern',     tags: ['shutter','blinds','geometric'] },
  { id: 't-013', category: 'transition', title: 'Mosaic shatter',      url: 'mosaic',       duration: 0.6, mood: 'Tech',       tags: ['mosaic','shatter','geometric'] },
  { id: 't-014', category: 'transition', title: 'Cross-zoom blur',     url: 'cross-zoom',   duration: 0.5, mood: 'Modern',     tags: ['cross','zoom','blur'] },
  { id: 't-015', category: 'transition', title: 'Spinning logo wipe',  url: 'logo-wipe',    duration: 0.7, mood: 'Brand',      tags: ['logo','wipe','brand'] },
  { id: 't-016', category: 'transition', title: 'Match cut subject',   url: 'match-cut',    duration: 0.3, mood: 'Cinematic',  tags: ['match','cut','seamless'] },
]

const ALL_DATA: Record<StockCategory, StockItem[]> = {
  broll: BROLL,
  music: MUSIC,
  sfx: SFX,
  gif: GIFS,
  sticker: STICKERS,
  transition: TRANSITIONS,
}

const CATEGORY_META: Record<StockCategory, { label: string; icon: LucideIcon; color: string; accent: string; total: number }> = {
  broll:      { label: 'B-Roll',      icon: Film,      color: 'from-rose-500 to-orange-500',     accent: 'text-rose-400',     total: BROLL.length },
  music:      { label: 'Music',       icon: Music,     color: 'from-fuchsia-500 to-purple-600',  accent: 'text-fuchsia-400',  total: MUSIC.length },
  sfx:        { label: 'Sound FX',    icon: Volume2,   color: 'from-amber-500 to-orange-600',    accent: 'text-amber-400',    total: SFX.length },
  gif:        { label: 'GIFs',        icon: ImageIcon, color: 'from-cyan-500 to-blue-600',       accent: 'text-cyan-400',     total: GIFS.length },
  sticker:    { label: 'Stickers',    icon: Sticker,   color: 'from-emerald-500 to-teal-600',    accent: 'text-emerald-400',  total: STICKERS.length },
  transition: { label: 'Transitions', icon: Wand2,     color: 'from-violet-500 to-indigo-600',   accent: 'text-violet-400',   total: TRANSITIONS.length },
}

const MOOD_ICONS: Record<string, LucideIcon> = {
  Energy: Flame, Cozy: Coffee, Cinematic: Sparkles, Tech: Cpu, Lifestyle: HeartIcon,
  Reaction: Sparkles, Aesthetic: Sparkles, Finance: TrendingUp, Strategy: Layers,
  Celebration: Sparkles, CTA: ChevronRight, Music: Music, Corporate: Globe,
  Ambient: Coffee, Food: Coffee, Nature: Coffee, Urban: Globe, Productivity: Cpu,
  Abstract: Sparkles, Build: Zap, Trigger: Zap, Impact: Zap, Transition: Wand2,
  Tension: Flame, Modern: Rocket, Brand: Sparkles,
}

// ── Component ───────────────────────────────────────────────────────────────
const StockLibraryView: React.FC<StockLibraryViewProps> = ({
  setTimelineSegments,
  showToast,
  onAddToTimeline,
  currentTime = 0,
  videoDuration = 60,
}) => {
  const [active, setActive] = useState<StockCategory>('broll')
  const [search, setSearch] = useState('')
  const [moodFilter, setMoodFilter] = useState<string>('All')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(window.localStorage.getItem('click-stock-favs') || '[]')) }
    catch { return new Set() }
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const items = ALL_DATA[active]
  const moods = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.mood)))], [items])

  const visible = useMemo(() => items.filter(i => {
    if (moodFilter !== 'All' && i.mood !== moodFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return i.title.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q)) || i.mood.toLowerCase().includes(q)
  }), [items, moodFilter, search])

  const persistFavs = (next: Set<string>) => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem('click-stock-favs', JSON.stringify(Array.from(next))) } catch {}
  }

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      persistFavs(next)
      return next
    })
  }

  const handlePreview = useCallback((item: StockItem) => {
    if (previewId === item.id) {
      setPreviewId(null)
      audioRef.current?.pause()
      videoRef.current?.pause()
      return
    }
    setPreviewId(item.id)
    if (item.category === 'music' && item.url) {
      try {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.src = item.url
          void audioRef.current.play()
        }
      } catch {/* noop */}
    }
  }, [previewId])

  const handleAdd = useCallback((item: StockItem) => {
    if (onAddToTimeline) {
      onAddToTimeline(item)
      showToast?.(`✓ Added: ${item.title}`, 'success')
      return
    }
    // Fallback: append to timeline directly
    if (setTimelineSegments) {
      const seg = {
        id: `${item.category}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startTime: currentTime,
        endTime: currentTime + (item.duration || 3),
        duration: item.duration || 3,
        type: item.category === 'music' || item.category === 'sfx' ? 'audio' : item.category === 'broll' ? 'video' : 'image',
        name: item.title,
        url: item.url,
        thumb: item.thumb,
        color:
          item.category === 'music'      ? '#d946ef' :
          item.category === 'sfx'        ? '#f59e0b' :
          item.category === 'broll'      ? '#f43f5e' :
          item.category === 'gif'        ? '#06b6d4' :
          item.category === 'sticker'    ? '#10b981' : '#8b5cf6',
        track: 0,
      }
      setTimelineSegments((prev: any[]) => [...prev, seg])
      showToast?.(`✓ Added to timeline: ${item.title}`, 'success')
    } else {
      showToast?.(`Selected: ${item.title}`, 'info')
    }
  }, [currentTime, onAddToTimeline, setTimelineSegments, showToast])

  const isPlaying = (id: string) => previewId === id

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full space-y-6 overflow-y-auto p-6 ds-anim-rise">
      <audio ref={audioRef} onEnded={() => setPreviewId(null)} className="hidden" />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="outline" className="gap-2 border-fuchsia-500/30 text-fuchsia-500">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Stock Library
          </Badge>
          <SectionHeader
            as="h1"
            title="Stock & Creative Assets"
            description={`${Object.values(CATEGORY_META).reduce((s, m) => s + m.total, 0)} curated assets across ${Object.keys(CATEGORY_META).length} categories. Click any item to add to your timeline.`}
          />
        </div>
        {favorites.size > 0 && (
          <Panel variant="subtle" className="flex items-center gap-2 px-4 py-2.5">
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" aria-hidden />
            <span className="ds-text-label text-theme-secondary">{favorites.size} saved</span>
          </Panel>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_META) as StockCategory[]).map(cat => {
          const meta = CATEGORY_META[cat]
          const TabIcon = meta.icon
          const isActive = active === cat
          return (
            <button type="button"
              key={cat}
              onClick={() => { setActive(cat); setMoodFilter('All'); setPreviewId(null) }}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors',
                isActive
                  ? `border-transparent bg-gradient-to-br ${meta.color} text-white`
                  : 'border-subtle ds-surface-subtle text-theme-secondary hover:border-border hover:text-theme-primary'
              )}
            >
              <TabIcon className="h-4 w-4" aria-hidden />
              <span className="text-sm font-medium">{meta.label}</span>
              <span className={cn('rounded-full px-1.5 py-0.5 font-mono text-[10px]', isActive ? 'bg-black/20' : 'bg-accent')}>{meta.total}</span>
            </button>
          )
        })}
      </div>

      {/* Search + mood filter */}
      <Panel variant="glass" className="flex flex-col gap-3 p-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${CATEGORY_META[active].label.toLowerCase()}…`}
            className="w-full rounded-lg border border-subtle ds-surface-subtle py-2.5 pl-10 pr-10 text-sm text-theme-primary outline-none transition-colors placeholder:text-theme-muted focus:border-fuchsia-500/50"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} title="Clear" className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-theme-muted hover:text-theme-primary">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-theme-muted" aria-hidden />
          {moods.slice(0, 8).map(m => {
            const MIcon = MOOD_ICONS[m] || Tag
            return (
              <button type="button"
                key={m}
                onClick={() => setMoodFilter(m)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  moodFilter === m
                    ? 'border-transparent bg-fuchsia-600 text-white'
                    : 'border-subtle ds-surface-subtle text-theme-secondary hover:text-theme-primary'
                )}
              >
                {m !== 'All' && <MIcon className="h-3 w-3" aria-hidden />}
                {m}
              </button>
            )
          })}
        </div>
      </Panel>

      {/* Asset grid */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try a different search term or mood filter."
          action={<Button variant="secondary" onClick={() => { setSearch(''); setMoodFilter('All') }}>Reset filters</Button>}
        />
      ) : (
        <div className={
          active === 'sticker' ? 'grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8' :
          active === 'gif' ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4' :
          active === 'broll' ? 'grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3' :
          active === 'transition' ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4' :
          'grid grid-cols-1 gap-3 lg:grid-cols-2'
        }>
          {visible.map(item => (
            <StockTile
              key={item.id}
              item={item}
              isPlaying={isPlaying(item.id)}
              isFav={favorites.has(item.id)}
              onPreview={() => handlePreview(item)}
              onAdd={() => handleAdd(item)}
              onFav={() => toggleFav(item.id)}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <Panel variant="subtle" className="flex items-start gap-3 p-4">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-500" aria-hidden />
        <div>
          <p className="ds-text-label text-theme-primary">Curated stock library — hand-picked for short-form content.</p>
          <p className="ds-text-caption mt-1 leading-relaxed text-theme-muted">
            All assets are royalty-free for personal use. Premium assets (marked) ship in the Pro tier and unlock 4K + extended licensing.
            Live Pexels / Pixabay / Mixkit / Freesound integrations land once <code className="text-fuchsia-500">/api/stock</code> is wired.
          </p>
        </div>
      </Panel>
    </div>
  )
}

// ── Tile ────────────────────────────────────────────────────────────────────
const StockTile = React.forwardRef<
  any,
  {
    item: StockItem
    isPlaying: boolean
    isFav: boolean
    onPreview: () => void
    onAdd: () => void
    onFav: () => void
  }
>(({ item, isPlaying, isFav, onPreview, onAdd, onFav }, ref) => {
  const Icon = MOOD_ICONS[item.mood] || Tag
  const [imgSrc, setImgSrc] = useState(item.thumb)

  React.useEffect(() => {
    setImgSrc(item.thumb)
  }, [item.thumb])

  if (item.category === 'sticker') {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onAdd}
        title={`${item.title} · ${item.mood}`}
        className="group relative flex aspect-square items-center justify-center rounded-2xl border border-subtle ds-surface-subtle text-4xl transition-colors hover:border-emerald-500/40"
      >
        <span>{item.url}</span>
        <span className="absolute inset-x-0 bottom-1 truncate px-1 text-center text-[10px] font-medium text-theme-muted opacity-0 transition-opacity group-hover:opacity-100">{item.title.slice(2)}</span>
      </button>
    )
  }

  if (item.category === 'transition') {
    return (
      <div
        ref={ref}
        className="group overflow-hidden rounded-2xl border border-subtle ds-surface-card transition-colors hover:border-violet-500/40"
      >
        <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-violet-600/30 to-indigo-700/40">
          <Wand2 className="h-8 w-8 text-violet-300/60 transition-transform group-hover:scale-110" aria-hidden />
          <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white/70">{item.duration?.toFixed(1)}s</span>
        </div>
        <div className="p-3">
          <p className="mb-1 truncate text-sm font-medium text-theme-primary">{item.title}</p>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-violet-500"><Icon className="h-3 w-3" aria-hidden />{item.mood}</span>
            <button type="button" onClick={onAdd} title="Add to timeline" className="rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-violet-500">Add</button>
          </div>
        </div>
      </div>
    )
  }

  if (item.category === 'gif') {
    return (
      <div
        ref={ref}
        className="group cursor-pointer overflow-hidden rounded-2xl border border-subtle ds-surface-card transition-colors hover:border-cyan-500/40"
        onClick={onAdd}
      >
        <div className="relative aspect-square bg-black">
          {item.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={imgSrc} 
              onError={() => setImgSrc('https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop')} 
              alt={item.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            />
          )}
          <button
           type="button"
            onClick={(e) => { e.stopPropagation(); onFav() }}
            title={isFav ? 'Unfavorite' : 'Favorite'}
            className={cn('absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors', isFav ? 'bg-rose-500 text-white' : 'bg-black/60 text-white/70 hover:text-white')}
          >
            <Heart className={cn('h-3.5 w-3.5', isFav && 'fill-white')} aria-hidden />
          </button>
          <div className="absolute inset-x-2 bottom-2 flex items-end justify-between opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-cyan-300"><Icon className="h-3 w-3" aria-hidden />{item.mood}</span>
            <span className="rounded-full bg-cyan-600 px-2.5 py-1 text-[10px] font-semibold text-white">+ Add</span>
          </div>
        </div>
        <div className="px-3 py-2">
          <p className="truncate text-xs font-medium text-theme-primary">{item.title}</p>
        </div>
      </div>
    )
  }

  if (item.category === 'broll') {
    return (
      <div
        ref={ref}
        className="group overflow-hidden rounded-2xl border border-subtle ds-surface-card transition-colors hover:border-rose-500/40"
      >
        <div className="relative aspect-video bg-black">
          {item.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={imgSrc} 
              onError={() => setImgSrc('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop')} 
              alt={item.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {item.premium && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold text-black"><Sparkles className="h-3 w-3" aria-hidden /> Pro</span>
          )}
          <button
           type="button"
            onClick={onFav}
            title={isFav ? 'Unfavorite' : 'Favorite'}
            className={cn('absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition-colors', isFav ? 'bg-rose-500 text-white' : 'bg-black/60 text-white/70 hover:text-white')}
          >
            <Heart className={cn('h-4 w-4', isFav && 'fill-white')} aria-hidden />
          </button>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
               type="button"
                onClick={onPreview}
                title={isPlaying ? 'Pause' : 'Preview'}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black shadow transition-colors hover:bg-white"
              >
                {isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
              </button>
              <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white"><Clock className="h-3 w-3" aria-hidden /> {item.duration}s</span>
            </div>
            <button
             type="button"
              onClick={onAdd}
              title="Add to timeline"
              className="flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white shadow transition-colors hover:bg-rose-400"
            >
              <Plus className="h-3 w-3" aria-hidden /> Add
            </button>
          </div>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium text-theme-primary">{item.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-rose-500"><Icon className="h-3 w-3" aria-hidden />{item.mood}</span>
            {item.tags.slice(0, 2).map(t => (
              <span key={t} className="font-mono text-[10px] text-theme-muted">#{t}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // music + sfx — list-style row
  const isMusic = item.category === 'music'
  return (
    <div
      ref={ref}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border border-subtle ds-surface-card p-3 transition-colors',
        isMusic ? 'hover:border-fuchsia-500/40' : 'hover:border-amber-500/40'
      )}
    >
      <button
       type="button"
        onClick={onPreview}
        title={isPlaying ? 'Pause' : 'Preview'}
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-colors',
          isMusic ? 'bg-gradient-to-br from-fuchsia-500 to-purple-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'
        )}
      >
        {isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-theme-primary">
          {item.title}
          {item.premium && <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">Pro</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={cn('flex items-center gap-1.5 text-[10px] font-medium', isMusic ? 'text-fuchsia-500' : 'text-amber-500')}>
            <Icon className="h-3 w-3" aria-hidden />{item.mood}
          </span>
          {item.duration && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-theme-muted"><Clock className="h-3 w-3" aria-hidden />{Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}</span>
          )}
          {item.bpm && <span className="font-mono text-[10px] text-theme-muted">{item.bpm} BPM</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
         type="button"
          onClick={onFav}
          title={isFav ? 'Unfavorite' : 'Favorite'}
          className={cn('flex h-9 w-9 items-center justify-center rounded-xl border transition-colors', isFav ? 'border-rose-500/40 bg-rose-500/20 text-rose-500' : 'border-subtle ds-surface-subtle text-theme-muted hover:text-theme-primary')}
        >
          <Heart className={cn('h-3.5 w-3.5', isFav && 'fill-rose-500')} aria-hidden />
        </button>
        <button
         type="button"
          onClick={onAdd}
          title="Add to timeline"
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors',
            isMusic ? 'bg-fuchsia-600 hover:bg-fuchsia-500' : 'bg-amber-600 hover:bg-amber-500'
          )}
        >
          <Plus className="h-3 w-3" aria-hidden /> Add
        </button>
      </div>
    </div>
  )
})
StockTile.displayName = 'StockTile'

export default StockLibraryView
