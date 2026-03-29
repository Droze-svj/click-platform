'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Zap,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Layers,
  Play,
  CheckCircle2,
  Users,
  Wand2,
  Globe2,
  Rocket,
  Cpu
} from 'lucide-react'
import { useState, useEffect } from 'react'

const glassStyle = "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  // Handle nav blur on scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30 overflow-x-hidden font-sans">
      {/* Dynamic Backgrounds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute top-[40%] right-[-10%] w-[30%] h-[50%] bg-purple-600/20 blur-[150px] rounded-full animate-pulse delay-700" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300 ${scrolled ? 'backdrop-blur-2xl bg-[#050505]/60 border-b border-white/5' : ''}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter">CLICK</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-slate-400">
            <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
            <a href="#intelligence" className="hover:text-indigo-400 transition-colors">Intelligence</a>
            <a href="#results" className="hover:text-indigo-400 transition-colors">Results</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
              Log In
            </Link>
            <Link href="/register" className="px-6 py-2.5 sm:px-8 sm:py-2.5 rounded-xl bg-white text-black text-sm font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95">
              Get Click
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 w-full">
        {/* Hero Section */}
        <section className="relative pt-40 md:pt-48 pb-20 md:pb-32 px-6 flex flex-col items-center">
          <div className="max-w-7xl mx-auto text-center space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/5 hover:bg-indigo-500/20 transition-colors cursor-default"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Click AI 3.0 Is Now Available
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.9] text-white"
            >
              CONTENT <br />
              <span className="bg-gradient-to-r from-indigo-400 via-white to-purple-400 bg-clip-text text-transparent italic">INTELLIGENCE</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-base md:text-2xl font-medium max-w-2xl mx-auto leading-relaxed"
            >
              Click is the premium command center for high-velocity creators.
              Automate production, optimize engagement, and scale your brand at the speed of light.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6"
            >
              <Link href="/register" className="group w-full sm:w-auto px-10 py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-base font-black uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] flex items-center justify-center gap-3 active:scale-95">
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className={`${glassStyle} group w-full sm:w-auto px-10 py-5 rounded-2xl text-white text-base font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95`}>
                <Play className="w-5 h-5 transition-transform fill-white" />
                Watch Demo
              </button>
            </motion.div>
          </div>
        </section>

        {/* Featured Dashboard Mockup (Elite UX) */}
        <section className="px-4 md:px-6 pb-32">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-6xl mx-auto relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/30 via-blue-600/10 to-transparent blur-[80px] -z-10 group-hover:opacity-100 transition-opacity opacity-50" />
            <div className={`${glassStyle} rounded-[2rem] md:rounded-[3rem] p-2 md:p-6 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]`}>
              <div className="w-full aspect-[16/10] md:aspect-video bg-[#0a0a0a] rounded-[1.5rem] md:rounded-[2rem] border border-white/10 flex flex-col overflow-hidden relative group">

                {/* Mockup Toolbar */}
                <div className="h-12 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="mx-auto px-4 py-1.5 rounded-md bg-white/5 text-[10px] text-white/40 font-mono tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    CLICK-WORKSPACE-ALPHA
                  </div>
                </div>

                {/* Dashboard Inner Layout */}
                <div className="flex flex-1 overflow-hidden relative">
                  {/* Mock Sidebar */}
                  <div className="hidden md:flex w-20 border-r border-white/5 p-4 flex-col gap-6 items-center bg-black/20">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                      <Zap className="w-5 h-5" />
                    </div>
                    {[Users, Rocket, Cpu, TrendingUp].map((Icon, i) => (
                       <div key={i} className="w-10 h-10 rounded-xl hover:bg-white/10 text-white/30 hover:text-white transition-colors flex items-center justify-center cursor-pointer">
                         <Icon className="w-5 h-5" />
                       </div>
                    ))}
                  </div>

                  {/* Mock Content */}
                  <div className="flex-1 p-6 md:p-8 space-y-8 bg-gradient-to-br from-transparent to-indigo-900/10 relative">
                     <div className="flex justify-between items-center">
                        <div className="space-y-2">
                          <div className="w-32 h-4 bg-indigo-500/40 rounded-full" />
                          <div className="w-48 h-8 bg-white/10 rounded-lg" />
                        </div>
                        <div className="w-10 h-10 md:w-32 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white/80 font-bold text-xs">
                          <span className="hidden md:block">GENERATE</span>
                          <span className="md:hidden">+</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {[
                          { label: 'Engagement', val: '+124%', color: 'from-blue-500/20' },
                          { label: 'Output', val: '1.2K Clips', color: 'from-purple-500/20' },
                          { label: 'System', val: 'Online', color: 'from-emerald-500/20' }
                        ].map((stat, i) => (
                           <div key={i} className={`h-24 md:h-32 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 p-4 md:p-6 bg-gradient-to-br ${stat.color} to-transparent flex flex-col justify-between`}>
                             <div className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest font-bold">{stat.label}</div>
                             <div className="text-xl md:text-3xl font-black text-white">{stat.val}</div>
                           </div>
                        ))}
                     </div>

                     <div className="flex-1 min-h-[150px] bg-white/5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 p-4 md:p-8 relative overflow-hidden group-hover:border-indigo-500/30 transition-colors duration-700">
                        {/* Fake animated graph */}
                        <div className="absolute bottom-0 left-0 right-0 h-full flex items-end justify-between px-6 pb-6 gap-2 opacity-50">
                           {[20, 40, 30, 70, 50, 80, 60, 90, 100, 85].map((h, i) => (
                              <motion.div
                                key={i}
                                initial={{ height: '0%' }}
                                whileInView={{ height: `${h}%` }}
                                transition={{ duration: 1, delay: i * 0.1, type: 'spring' }}
                                viewport={{ once: true }}
                                className="w-full bg-gradient-to-t from-indigo-600/50 to-purple-400 rounded-t-sm md:rounded-t-md"
                              />
                           ))}
                        </div>
                     </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </section>

        {/* Intelligence / Features Sections */}
        <section id="features" className="py-24 px-6 bg-[#020202] relative">
          {/* Subtle separator line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="max-w-7xl mx-auto">
             <div className="text-center mb-20">
               <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
                 THE <span className="text-indigo-400">ENGINE</span>
               </h2>
               <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
                 Click harnesses multi-agent AI to turn raw footage into viral gold. Automatically.
               </p>
             </div>

             <div className="grid md:grid-cols-3 gap-6 md:gap-8">
               {[
                 {
                   icon: Wand2,
                   title: "AI Editor Pro",
                   desc: "Automatically cuts silence, adds dynamic zooms, and highlights key moments without lifting a finger.",
                   color: "text-purple-400"
                 },
                 {
                   icon: Globe2,
                   title: "Omni-Channel Auto-Post",
                   desc: "Schedule and distribute formatted clips across TikTok, YouTube Shorts, and Reels instantly.",
                   color: "text-blue-400"
                 },
                 {
                   icon: Cpu,
                   title: "Neural Analytics",
                   desc: "Predict viral potential before you post using models trained on millions of data points.",
                   color: "text-emerald-400"
                 }
               ].map((feat, i) => (
                 <motion.div
                   key={i}
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: i * 0.2 }}
                   className={`${glassStyle} p-8 rounded-3xl group hover:border-indigo-500/30 transition-colors`}
                 >
                   <div className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${feat.color}`}>
                     <feat.icon className="w-7 h-7" />
                   </div>
                   <h3 className="text-2xl font-black mb-4">{feat.title}</h3>
                   <p className="text-slate-400 font-medium leading-relaxed">{feat.desc}</p>
                 </motion.div>
               ))}
             </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
                TRUSTED BY <span className="text-indigo-400">ELITE</span> CREATORS
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                 {
                   name: "Sarah Chen",
                   handle: "@sarahcreates",
                   quote: "Click replaced a 3-person editing team. The AI scene detection is literally magic.",
                   metric: "+400% Output"
                 },
                 {
                   name: "Marcus Thorne",
                   handle: "@marcusthifts",
                   quote: "I connected my YouTube, and Click handles the Shorts distribution on autopilot. My views 10x'd.",
                   metric: "1.2M New Views"
                 },
                 {
                   name: "Elena Rodriguez",
                   handle: "@elena_tech",
                   quote: "The visual aesthetic out of the box is incredible. The AI knows exactly what retention editing means.",
                   metric: "89% Retention"
                 }
              ].map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className={`${glassStyle} p-8 rounded-3xl relative group`}
                >
                  <div className="text-4xl text-indigo-500/20 absolute top-6 right-6 font-serif">"</div>
                  <div className="text-sm font-bold text-indigo-400 mb-6 uppercase tracking-widest">{t.metric}</div>
                  <p className="text-slate-300 font-medium leading-relaxed mb-8">{t.quote}</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 border border-white/10" />
                    <div>
                       <div className="font-bold">{t.name}</div>
                       <div className="text-xs text-slate-500">{t.handle}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6 bg-[#020202] relative border-y border-white/5">
           <div className="max-w-7xl mx-auto">
             <div className="text-center mb-16">
               <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
                 UNLOCK <span className="text-purple-400">MULTIPLIER</span>
               </h2>
               <p className="text-slate-400">Designed for creators who value time above all.</p>
             </div>

             <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { tier: "Creator", price: "$49", desc: "For rising channels", features: ["100 AI Generations", "Basic Transcripts", "720p Exports"] },
                  { tier: "Pro", price: "$149", desc: "The AI Command Center", features: ["Unlimited Generations", "Omni-Channel Auto-Post", "4K Exports", "Custom Branding"], highlight: true },
                  { tier: "Agency", price: "$399", desc: "For volume operations", features: ["Custom White-Label", "Dedicated GPU Pods", "Team Collaboration"] }
                ].map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className={`${glassStyle} p-8 rounded-3xl relative flex flex-col ${p.highlight ? 'border-indigo-500/50 shadow-[0_0_40px_rgba(79,70,229,0.15)] bg-indigo-500/5' : ''}`}
                  >
                    {p.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">Most Popular</div>}
                    <div className="text-xl font-black uppercase tracking-wide mb-2">{p.tier}</div>
                    <div className="text-sm text-slate-400 mb-6">{p.desc}</div>
                    <div className="text-5xl font-black mb-8">{p.price}<span className="text-lg text-slate-500 font-medium">/mo</span></div>

                    <ul className="space-y-4 mb-8 flex-1">
                      {p.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                           <CheckCircle2 className={`w-4 h-4 ${p.highlight ? 'text-indigo-400' : 'text-slate-600'}`} />
                           {f}
                        </li>
                      ))}
                    </ul>

                    <button className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${p.highlight ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                      Select {p.tier}
                    </button>
                  </motion.div>
                ))}
             </div>
           </div>
        </section>

        {/* Global Impact / Stats */}
        <section id="results" className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-900/10 blur-[100px] -z-10" />
          <div className="max-w-7xl mx-auto">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
               {[
                 { label: 'Active Creators', value: '25K+', icon: <Users className="text-indigo-400 w-8 h-8" /> },
                 { label: 'Clips Generated', value: '145M', icon: <Layers className="text-purple-400 w-8 h-8" /> },
                 { label: 'Avg. Brand Lift', value: '312%', icon: <TrendingUp className="text-blue-400 w-8 h-8" /> },
                 { label: 'System Uptime', value: '99.9%', icon: <ShieldCheck className="text-emerald-400 w-8 h-8" /> }
               ].map((stat, i) => (
                 <motion.div
                   key={i}
                   initial={{ opacity: 0, scale: 0.9 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true }}
                   transition={{ delay: i * 0.1, type: "spring" }}
                   className="text-center group flex flex-col items-center"
                 >
                   <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:-translate-y-2 transition-transform shadow-xl">
                     {stat.icon}
                   </div>
                   <div className="text-4xl md:text-5xl font-black tracking-tighter mb-3">{stat.value}</div>
                   <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{stat.label}</div>
                 </motion.div>
               ))}
             </div>
          </div>
        </section>

        {/* Final CTA CTA */}
        <section className="py-32 px-6 relative flex flex-col items-center justify-center min-h-[60vh]">
           <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050505] -z-10" />
           <motion.div
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="max-w-4xl w-full mx-auto text-center"
           >
             <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8">
               READY TO <span className="text-indigo-500">DOMINATE?</span>
             </h2>
             <p className="text-slate-400 text-xl md:text-2xl font-medium mb-12 max-w-2xl mx-auto">
               Join elite creators who are scaling their content empires with Click autonomous ecosystem.
             </p>

             <Link href="/register" className="inline-flex group px-12 py-6 rounded-full bg-white text-black text-lg font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] items-center justify-center gap-4 active:scale-95">
               Unleash The AI
               <Wand2 className="w-6 h-6 group-hover:rotate-12 transition-transform" />
             </Link>
           </motion.div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-16 px-6 relative bg-[#020202]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
               <Zap className="w-4 h-4 text-white" />
             </div>
             <span className="text-lg font-black tracking-tighter uppercase text-white">CLICK</span>
          </div>

          <div className="flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-600">
             <a href="#" className="hover:text-white transition-colors">Privacy</a>
             <a href="#" className="hover:text-white transition-colors">Terms</a>
             <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>

          <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} CLICK AI. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>
    </div>
  )
}
