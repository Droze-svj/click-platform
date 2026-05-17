'use client';
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EliteAIView = void 0;
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = __importStar(require("react"));
var lucide_react_1 = require("lucide-react");
var api_1 = require("../../lib/api");
var framer_motion_1 = require("framer-motion");
var glassStyle = 'backdrop-blur-2xl bg-black/40 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500';
var EliteAIView = function (_a) {
    var videoId = _a.videoId, isTranscribing = _a.isTranscribing, setIsTranscribing = _a.setIsTranscribing, transcript = _a.transcript, setTranscript = _a.setTranscript, editingWords = _a.editingWords, setEditingWords = _a.setEditingWords, aiSuggestions = _a.aiSuggestions, setTimelineSegments = _a.setTimelineSegments, showToast = _a.showToast;
    var _b = (0, react_1.useState)('DYNAMIC'), editStyle = _b[0], setEditStyle = _b[1];
    var _c = (0, react_1.useState)('FAST'), pacing = _c[0], setPacing = _c[1];
    var _d = (0, react_1.useState)(false), isGeneratingVariants = _d[0], setIsGeneratingVariants = _d[1];
    var _e = (0, react_1.useState)([]), variants = _e[0], setVariants = _e[1];
    var _f = (0, react_1.useState)(0), cognitiveLoad = _f[0], setCognitiveLoad = _f[1];
    react_1.default.useEffect(function () {
        if (isGeneratingVariants || isTranscribing) {
            var interval_1 = setInterval(function () {
                setCognitiveLoad(function (prev) { return Math.min(prev + (Math.random() * 10), 100); });
            }, 300);
            return function () { return clearInterval(interval_1); };
        }
        else {
            setCognitiveLoad(0);
        }
    }, [isGeneratingVariants, isTranscribing]);
    var generateVariants = function () { return __awaiter(void 0, void 0, void 0, function () {
        var newVariants, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!transcript) {
                        showToast('Please transcribe the video first.', 'error');
                        return [2 /*return*/];
                    }
                    setIsGeneratingVariants(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    // Mocking a long generation process for the variants
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2500); })];
                case 2:
                    // Mocking a long generation process for the variants
                    _a.sent();
                    newVariants = [
                        { id: 'v1', name: 'Alpha Edit', style: editStyle, pacing: pacing, description: 'Optimized for high retention', score: 98 },
                        { id: 'v2', name: 'Beta Sequence', style: editStyle === 'DYNAMIC' ? 'AGGRESSIVE' : 'DYNAMIC', pacing: pacing, description: 'Pattern-interrupt heavy', score: 92 },
                        { id: 'v3', name: 'Gamma Flow', style: 'CINEMATIC', pacing: 'STEADY', description: 'Narrative-driven pacing', score: 87 }
                    ];
                    setVariants(newVariants);
                    showToast('Neural variants synthesized successfully.', 'success');
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    showToast('Variant generation failed.', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setIsGeneratingVariants(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var applyVariant = function (variant) { return __awaiter(void 0, void 0, void 0, function () {
        var data, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    showToast('Applying variant and locking neural preferences...', 'info');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    // Inform the backend to learn from this choice
                    return [4 /*yield*/, (0, api_1.apiPost)('/intelligence/preferences/learn', {
                            videoId: videoId,
                            selectedVariant: variant.name,
                            style: variant.style,
                            pacing: variant.pacing,
                            context: 'auto-edit'
                        }).catch(function () { })];
                case 2:
                    // Inform the backend to learn from this choice
                    _a.sent(); // Fire and forget learning
                    return [4 /*yield*/, (0, api_1.apiPost)('/video/apply-all', {
                            videoId: videoId,
                            suggestions: aiSuggestions,
                            stylePreference: variant.style
                        })];
                case 3:
                    data = _a.sent();
                    if (data.success) {
                        setTimelineSegments(data.timeline);
                        showToast("Applied ".concat(variant.name, "! Preferences saved to Neural Vault."), 'success');
                    }
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _a.sent();
                    console.error('Master AI Edit failed', err_2);
                    showToast('Failed to apply AI edits', 'error');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 text-white pb-10", children: [(0, jsx_runtime_1.jsxs)("div", { className: "".concat(glassStyle, " rounded-3xl p-6 relative overflow-hidden group"), children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute -top-20 -right-20 w-40 h-40 bg-fuchsia-600/20 blur-[60px] rounded-full pointer-events-none group-hover:bg-fuchsia-600/30 transition-all duration-1000" }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between mb-4 relative z-10", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-12 h-12 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(217,70,239,0.2)]", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Cpu, { className: "w-6 h-6 text-fuchsia-400 animate-pulse" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-xl font-black italic uppercase tracking-tighter text-white drop-shadow-md", children: "Elite Auto-Forge" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 mt-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Activity, { size: 10, className: "text-emerald-400 animate-pulse" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[9px] font-black uppercase tracking-widest text-emerald-400 leading-none", children: "Neural Sync Active" })] })] })] }) }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-gray-400 font-medium italic relative z-10", children: "Advanced AI automation. The system learns your editing style based on the variants you select." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "".concat(glassStyle, " rounded-3xl p-6 relative overflow-hidden"), children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-5", children: [(0, jsx_runtime_1.jsxs)("h4", { className: "text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquare, { className: "w-3 h-3 text-indigo-400" }), " PHASE 1: AUDIO INTELLIGENCE"] }), isTranscribing && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse", children: ["COGNITIVE_LOAD: ", Math.round(cognitiveLoad), "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "w-16 h-1 bg-white/10 rounded-full overflow-hidden", children: (0, jsx_runtime_1.jsx)(framer_motion_1.motion.div, { animate: { width: "".concat(cognitiveLoad, "%") }, className: "h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" }) })] }))] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return __awaiter(void 0, void 0, void 0, function () {
                            var data, err_3;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        setIsTranscribing(true);
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, 4, 5]);
                                        return [4 /*yield*/, (0, api_1.apiPost)('/transcribe', { videoId: videoId })];
                                    case 2:
                                        data = _a.sent();
                                        if (data.success) {
                                            setTranscript(data);
                                            setEditingWords(data.words);
                                            showToast('Transcription complete! Audio vectors mapped.', 'success');
                                        }
                                        return [3 /*break*/, 5];
                                    case 3:
                                        err_3 = _a.sent();
                                        console.error('Transcription failed', err_3);
                                        showToast('Transcription failed', 'error');
                                        return [3 /*break*/, 5];
                                    case 4:
                                        setIsTranscribing(false);
                                        return [7 /*endfinally*/];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); }, disabled: isTranscribing || !!transcript, className: "w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-3 shadow-lg border-2 italic ".concat(transcript
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default'
                            : isTranscribing
                                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300 cursor-wait'
                                : 'bg-white text-black border-white hover:bg-gray-200 hover:scale-[1.02]'), children: [transcript ? (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "w-4 h-4" }) : isTranscribing ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "w-4 h-4 animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Mic2, { className: "w-4 h-4" }), transcript ? 'SEMANTIC DATA EXTRACTED' : isTranscribing ? 'ANALYZING AUDIO VECTORS...' : 'EXTRACT AUDIO VECTORS'] })] }), (0, jsx_runtime_1.jsx)(framer_motion_1.AnimatePresence, { children: transcript && ((0, jsx_runtime_1.jsxs)(framer_motion_1.motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, className: "".concat(glassStyle, " rounded-3xl p-6 space-y-6 relative border-fuchsia-500/20"), children: [(0, jsx_runtime_1.jsxs)("h4", { className: "text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.SlidersHorizontal, { className: "w-3 h-3 text-fuchsia-400" }), " PHASE 2: STYLE CALIBRATION"] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block", children: "Base Aesthetic Pivot" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-2", children: ['DYNAMIC', 'CINEMATIC', 'AGGRESSIVE', 'MINIMAL'].map(function (style) { return ((0, jsx_runtime_1.jsx)("button", { onClick: function () { return setEditStyle(style); }, className: "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all border ".concat(editStyle === style
                                                    ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300 shadow-[0_0_20px_rgba(217,70,239,0.3)]'
                                                    : 'bg-black/40 border-white/5 text-gray-400 hover:border-white/20'), children: style }, style)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block", children: "Rhythm & Pacing" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-3 gap-2", children: ['FAST', 'STEADY', 'SURGE'].map(function (p) { return ((0, jsx_runtime_1.jsx)("button", { onClick: function () { return setPacing(p); }, className: "py-2 rounded-xl text-[9px] font-black uppercase tracking-widest italic transition-all border ".concat(pacing === p
                                                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                                                    : 'bg-black/40 border-white/5 text-gray-400 hover:border-white/20'), children: p }, p)); }) })] })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: generateVariants, disabled: isGeneratingVariants, className: "w-full py-4 rounded-2xl font-black text-[12px] uppercase tracking-[0.4em] transition-all duration-700 flex items-center justify-center gap-3 italic border-2 relative overflow-hidden group ".concat(isGeneratingVariants
                                ? 'bg-fuchsia-600/30 border-fuchsia-500/30 text-fuchsia-300'
                                : 'bg-fuchsia-600 border-fuchsia-400 text-white hover:bg-fuchsia-500 shadow-[0_0_40px_rgba(217,70,239,0.4)] hover:scale-[1.02]'), children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" }), isGeneratingVariants ? (0, jsx_runtime_1.jsx)(lucide_react_1.Orbit, { className: "w-5 h-5 animate-spin-slow" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "w-5 h-5" }), isGeneratingVariants ? 'SYNTHESIZING VARIANTS...' : 'GENERATE AI VARIANTS'] }), variants.length > 0 && ((0, jsx_runtime_1.jsxs)(framer_motion_1.motion.div, { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, className: "pt-4 border-t border-white/10 space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between", children: (0, jsx_runtime_1.jsxs)("h4", { className: "text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "w-3 h-3 text-emerald-400" }), " PHASE 3: SELECT & TRAIN"] }) }), (0, jsx_runtime_1.jsx)("p", { className: "text-[10px] text-gray-500 italic", children: "Select your preferred sequence. The Neural Vault will adapt to your style for future automations." }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: variants.map(function (v, i) { return ((0, jsx_runtime_1.jsxs)("div", { className: "p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-fuchsia-500/50 hover:bg-white/10 transition-all flex flex-col gap-3 group", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center font-black text-xs text-fuchsia-400 italic", children: ['α', 'β', 'γ'][i] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h5", { className: "font-black text-sm uppercase italic tracking-tight text-white", children: v.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-[9px] text-gray-400 uppercase tracking-widest", children: v.description })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xl font-black italic text-emerald-400 drop-shadow-md", children: v.score }), (0, jsx_runtime_1.jsx)("span", { className: "text-[8px] text-gray-500 uppercase tracking-widest block", children: "Resonance" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "px-3 py-1 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 text-[8px] font-black uppercase text-fuchsia-300", children: v.style }), (0, jsx_runtime_1.jsx)("span", { className: "px-3 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black uppercase text-indigo-300", children: v.pacing })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return applyVariant(v); }, className: "mt-2 w-full py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "w-3 h-3" }), " Select & Train Model"] })] }, v.id)); }) })] }))] })) }), transcript && ((0, jsx_runtime_1.jsxs)(framer_motion_1.motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "".concat(glassStyle, " rounded-3xl p-6 mt-6 border-white/5"), children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-[10px] font-black mb-4 uppercase tracking-[0.3em] flex items-center gap-2 text-gray-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Scissors, { className: "w-3 h-3 text-purple-400" }), "Semantic Script Map"] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar", children: (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-1.5", children: editingWords.map(function (word, idx) { return ((0, jsx_runtime_1.jsxs)("span", { className: "px-2 py-1 rounded-md bg-black/60 border border-white/10 text-[11px] text-gray-300 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-white transition-all cursor-pointer group relative font-medium", title: "".concat(word.start, "s - ").concat(word.end, "s"), children: [word.word, (0, jsx_runtime_1.jsx)("div", { className: "absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(244,63,94,1)]" })] }, idx)); }) }) })] })), (0, jsx_runtime_1.jsx)("style", { dangerouslySetInnerHTML: { __html: "\n                .animate-spin-slow { animation: spin 8s linear infinite; }\n                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n                @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }\n            " } })] }));
};
exports.EliteAIView = EliteAIView;
