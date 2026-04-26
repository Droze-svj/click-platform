'use client'

import React, { useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, Music, Volume2, Image as ImageIcon, Sticker, Wand2, Search, X,
  Play, Pause, Plus, Heart, Download, Filter, Clock, Tag,
  Sparkles, Flame, Zap, Coffee, Cpu, Rocket, Globe, Heart as HeartIcon,
  TrendingUp, Layers, ChevronRight, Volume1
} from 'lucide-react'

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

const CATEGORY_META: Record<StockCategory, { label: string; icon: any; color: string; accent: string; total: number }> = {
  broll:      { label: 'B-Roll',      icon: Film,      color: 'from-rose-500 to-orange-500',     accent: 'text-rose-400',     total: BROLL.length },
  music:      { label: 'Music',       icon: Music,     color: 'from-fuchsia-500 to-purple-600',  accent: 'text-fuchsia-400',  total: MUSIC.length },
  sfx:        { label: 'Sound FX',    icon: Volume2,   color: 'from-amber-500 to-orange-600',    accent: 'text-amber-400',    total: SFX.length },
  gif:        { label: 'GIFs',        icon: ImageIcon, color: 'from-cyan-500 to-blue-600',       accent: 'text-cyan-400',     total: GIFS.length },
  sticker:    { label: 'Stickers',    icon: Sticker,   color: 'from-emerald-500 to-teal-600',    accent: 'text-emerald-400',  total: STICKERS.length },
  transition: { label: 'Transitions', icon: Wand2,     color: 'from-violet-500 to-indigo-600',   accent: 'text-violet-400',   total: TRANSITIONS.length },
}

const MOOD_ICONS: Record<string, any> = {
  Energy: Flame, Cozy: Coffee, Cinematic: Sparkles, Tech: Cpu, Lifestyle: HeartIcon,
  Reaction: Sparkles, Aesthetic: Sparkles, Finance: TrendingUp, Strategy: Layers,
  Celebration: Sparkles, CTA: ChevronRight, Music: Music, Corporate: Globe,
  Ambient: Coffee, Food: Coffee, Nature: Coffee, Urban: Globe, Productivity: Cpu,
  Abstract: Sparkles, Build: Zap, Trigger: Zap, Impact: Zap, Transition: Wand2,
  Tension: Flame, Modern: Rocket, Brand: Sparkles,
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]'

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
    <div className="h-full overflow-y-auto bg-gradient-to-br from-[#0a0a14] via-[#0d0d18] to-[#080812] p-6 space-y-6">
      <audio ref={audioRef} onEnded={() => setPreviewId(null)} className="hidden" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-400">Click · Stock Library</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Stock & Creative Assets</h2>
          <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
            {Object.values(CATEGORY_META).reduce((s, m) => s + m.total, 0)} curated assets across {Object.keys(CATEGORY_META).length} categories. Click any item to add to your timeline.
          </p>
        </div>
        {favorites.size > 0 && (
          <div className={`${glassStyle} rounded-2xl px-5 py-3 flex items-center gap-3`}>
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em]">{favorites.size} saved</span>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-3">
        {(Object.keys(CATEGORY_META) as StockCategory[]).map(cat => {
          const meta = CATEGORY_META[cat]
          const Icon = meta.icon
          const isActive = active === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => { setActive(cat); setMoodFilter('All'); setPreviewId(null) }}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-colors ${
                isActive
                  ? `bg-gradient-to-br ${meta.color} text-white border-transparent shadow-[0_8px_30px_rgba(0,0,0,0.4)]`
                  : `bg-white/[0.02] ${meta.accent} border-white/10 hover:bg-white/[0.05] hover:border-white/20`
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[12px] font-bold tracking-tight">{meta.label}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isActive ? 'bg-black/20' : 'bg-white/5'}`}>{meta.total}</span>
            </button>
          )
        })}
      </div>

      {/* Search + mood filter */}
      <div className={`${glassStyle} rounded-2xl p-4 flex flex-col md:flex-row gap-3`}>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${CATEGORY_META[active].label.toLowerCase()}…`}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-10 py-3 text-[13px] font-medium text-white focus:outline-none focus:border-fuchsia-500/50 transition-colors placeholder:text-slate-500"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} title="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          {moods.slice(0, 8).map(m => {
            const Icon = MOOD_ICONS[m] || Tag
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMoodFilter(m)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 ${
                  moodFilter === m
                    ? 'bg-fuchsia-600 text-white border-transparent'
                    : 'bg-white/[0.02] text-slate-300 border-white/10 hover:text-white hover:border-white/30'
                }`}
              >
                {m !== 'All' && <Icon className="w-3 h-3" />}
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* Asset grid */}
      {visible.length === 0 ? (
        <div className={`${glassStyle} rounded-2xl p-12 text-center`}>
          <Search className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-2xl font-black text-white mb-2">No matches</h3>
          <p className="text-[13px] text-slate-400 mb-5">Try a different search term or mood filter.</p>
          <button type="button" onClick={() => { setSearch(''); setMoodFilter('All') }} className="px-6 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:text-white">Reset filters</button>
        </div>
      ) : (
        <div className={
          active === 'sticker' ? 'grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3' :
          active === 'gif' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' :
          active === 'broll' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' :
          active === 'transition' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' :
          'grid grid-cols-1 lg:grid-cols-2 gap-3'
        }>
          <AnimatePresence mode="popLayout">
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
          </AnimatePresence>
        </div>
      )}

      {/* Footer note */}
      <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold text-fuchsia-300 leading-snug">Curated stock library — hand-picked for short-form content.</p>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            All assets are royalty-free for personal use. Premium assets (marked) ship in the Pro tier and unlock 4K + extended licensing.
            Live Pexels / Pixabay / Mixkit / Freesound integrations land once <code className="text-fuchsia-300">/api/stock</code> is wired.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Tile ────────────────────────────────────────────────────────────────────
function StockTile({
  item, isPlaying, isFav, onPreview, onAdd, onFav,
}: {
  item: StockItem
  isPlaying: boolean
  isFav: boolean
  onPreview: () => void
  onAdd: () => void
  onFav: () => void
}) {
  const Icon = MOOD_ICONS[item.mood] || Tag

  if (item.category === 'sticker') {
    return (
      <motion.button
        type="button"
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        whileHover={{ scale: 1.1, y: -4 }}
        whileTap={{ scale: 0.95 }}
        onClick={onAdd}
        title={`${item.title} · ${item.mood}`}
        className="aspect-square rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.06] flex items-center justify-center text-4xl transition-colors relative group"
      >
        <span>{item.url}</span>
        <span className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-bold text-slate-400 truncate px-1 opacity-0 group-hover:opacity-100 transition-opacity">{item.title.slice(2)}</span>
      </motion.button>
    )
  }

  if (item.category === 'transition') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-2xl bg-white/[0.03] border border-white/10 hover:border-violet-500/40 transition-colors overflow-hidden group"
      >
        <div className="aspect-video bg-gradient-to-br from-violet-600/30 to-indigo-700/40 relative flex items-center justify-center">
          <Wand2 className="w-8 h-8 text-violet-300/60 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
          <span className="absolute top-2 right-2 text-[8px] font-mono text-white/60 bg-black/40 px-2 py-0.5 rounded-full">{item.duration?.toFixed(1)}s</span>
        </div>
        <div className="p-3">
          <p className="text-[12px] font-bold text-white truncate mb-1">{item.title}</p>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400 flex items-center gap-1.5"><Icon className="w-2.5 h-2.5" />{item.mood}</span>
            <button type="button" onClick={onAdd} title="Add to timeline" className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full bg-violet-600 hover:bg-violet-500 transition-colors uppercase tracking-wider">Add</button>
          </div>
        </div>
      </motion.div>
    )
  }

  if (item.category === 'gif') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 transition-colors overflow-hidden group cursor-pointer"
        onClick={onAdd}
      >
        <div className="aspect-square bg-black relative">
          {item.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumb} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFav() }}
            title={isFav ? 'Unfavorite' : 'Favorite'}
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isFav ? 'bg-rose-500 text-white' : 'bg-black/60 text-white/70 hover:text-white'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}`} />
          </button>
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 bg-black/60 px-2 py-1 rounded-full flex items-center gap-1.5"><Icon className="w-2.5 h-2.5" />{item.mood}</span>
            <span className="text-[10px] font-bold text-white bg-cyan-600 px-2.5 py-1 rounded-full">+ Add</span>
          </div>
        </div>
        <div className="px-3 py-2">
          <p className="text-[11px] font-medium text-white truncate">{item.title}</p>
        </div>
      </motion.div>
    )
  }

  if (item.category === 'broll') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-2xl bg-white/[0.03] border border-white/10 hover:border-rose-500/40 transition-colors overflow-hidden group"
      >
        <div className="aspect-video bg-black relative">
          {item.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumb} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {item.premium && (
            <span className="absolute top-2 left-2 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-500 text-black flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> Pro</span>
          )}
          <button
            type="button"
            onClick={onFav}
            title={isFav ? 'Unfavorite' : 'Favorite'}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isFav ? 'bg-rose-500 text-white' : 'bg-black/60 text-white/70 hover:text-white hover:bg-black/80'}`}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-white' : ''}`} />
          </button>
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPreview}
                title={isPlaying ? 'Pause' : 'Preview'}
                className="w-9 h-9 rounded-full bg-white/90 text-black hover:bg-white flex items-center justify-center transition-colors shadow-xl"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded-full flex items-center gap-1.5"><Clock className="w-2.5 h-2.5" /> {item.duration}s</span>
            </div>
            <button
              type="button"
              onClick={onAdd}
              title="Add to timeline"
              className="px-4 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-bold uppercase tracking-wider rounded-full transition-colors flex items-center gap-1.5 shadow-xl"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
        <div className="p-3">
          <p className="text-[13px] font-bold text-white truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-widest text-rose-400 flex items-center gap-1.5"><Icon className="w-2.5 h-2.5" />{item.mood}</span>
            {item.tags.slice(0, 2).map(t => (
              <span key={t} className="text-[9px] font-mono text-slate-500">#{t}</span>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  // music + sfx — list-style row
  const isMusic = item.category === 'music'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl bg-white/[0.03] border transition-colors p-3 flex items-center gap-3 group ${
        isMusic ? 'border-white/10 hover:border-fuchsia-500/40' : 'border-white/10 hover:border-amber-500/40'
      }`}
    >
      <button
        type="button"
        onClick={onPreview}
        title={isPlaying ? 'Pause' : 'Preview'}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-colors flex-shrink-0 ${
          isMusic ? 'bg-gradient-to-br from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700' : 'bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white truncate flex items-center gap-2">
          {item.title}
          {item.premium && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Pro</span>}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isMusic ? 'text-fuchsia-400' : 'text-amber-400'}`}>
            <Icon className="w-2.5 h-2.5" />{item.mood}
          </span>
          {item.duration && (
            <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}</span>
          )}
          {item.bpm && <span className="text-[9px] font-mono text-slate-400">{item.bpm} BPM</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onFav}
          title={isFav ? 'Unfavorite' : 'Favorite'}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isFav ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'}`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-400' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onAdd}
          title="Add to timeline"
          className={`px-4 py-2 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 ${
            isMusic ? 'bg-fuchsia-600 hover:bg-fuchsia-500' : 'bg-amber-600 hover:bg-amber-500'
          }`}
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </motion.div>
  )
}

export default StockLibraryView
