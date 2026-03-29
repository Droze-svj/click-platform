'use client';

import React, { useState, useEffect } from 'react';

interface DNASummary {
  hasSetupDNA: boolean;
  voice: { tone: string; personality: string; pacing: string };
  content: { niche: string; coreMessage: string; uniqueAngle: string };
  topHooks: string[];
  clichesToAvoid: string[];
  lastEvolved: string | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: 'single_select' | 'text_input' | 'multi_select';
  options?: { value: string; label: string; description?: string }[];
  placeholder?: string;
  optional?: boolean;
}

interface CreatorDNAProps {
  onDNASaved?: (dna: any) => void;
  compact?: boolean;
  className?: string;
}

const VOICE_EMOJI: Record<string, string> = {
  motivational: '🔥', educational: '📚', entertaining: '😂',
  authoritative: '👔', casual: '😊', helpful: '💡',
  bold: '⚡', provocative: '💥', inspiring: '✨', analytical: '🔬', funny: '😄'
};

export default function CreatorDNA({ onDNASaved, compact = false, className = '' }: CreatorDNAProps) {
  const [summary, setSummary] = useState<DNASummary | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [view, setView] = useState<'summary' | 'quiz' | 'avatar'>('summary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [avatarData, setAvatarData] = useState<{characterId?: string, style?: string, customUrl?: string} | null>(null);

  useEffect(() => {
    loadDNA();
    loadQuiz();
  }, []);

  const loadDNA = async () => {
    try {
      const res = await fetch('/api/intelligence/dna');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        if (data.avatar) setAvatarData(data.avatar);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const loadQuiz = async () => {
    try {
      const res = await fetch('/api/intelligence/dna/quiz');
      const data = await res.json();
      if (data.success) setQuestions(data.questions);
    } catch { /* silent */ }
  };

  const setAnswer = (id: string, value: any) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const toggleMultiSelect = (id: string, value: string) => {
    const current = answers[id] || [];
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    setAnswer(id, updated);
  };

  const saveDNA = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/intelligence/dna/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers)
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        await loadDNA();
        setView('summary');
        onDNASaved?.(data.dna);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const saveAvatar = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/intelligence/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(avatarData || {})
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        await loadDNA();
        setTimeout(() => { setSaved(false); setView('summary'); }, 1500);
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const currentQuestion = questions[quizStep];
  const progress = questions.length > 0 ? ((quizStep) / questions.length) * 100 : 0;

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading Creator DNA...</div>;

  return (
    <div className={`creator-dna ${className}`} style={{
      background: 'linear-gradient(135deg, #0f0f20 0%, #1a0f2e 100%)',
      borderRadius: 16,
      border: '1px solid rgba(168, 85, 247, 0.2)',
      overflow: 'hidden',
      fontFamily: '"Outfit", "Inter", sans-serif'
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(168,85,247,0.12)', background: 'rgba(168,85,247,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🧬</span>
          <div>
            <div style={{ color: '#a855f7', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>CREATOR DNA</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Your unique voice profile</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['summary', 'quiz', 'avatar'].map(v => (
            <button
              key={v}
              onClick={() => { setView(v as any); setQuizStep(0); }}
              style={{
                padding: '5px 12px',
                background: view === v ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${view === v ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 7,
                color: view === v ? '#a855f7' : 'rgba(255,255,255,0.4)',
                fontSize: 12, fontWeight: view === v ? 700 : 400,
                cursor: 'pointer'
              }}
            >
              {v === 'summary' ? '📊 Profile' : v === 'quiz' ? '✏️ Edit DNA' : '👤 Avatar'}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY VIEW */}
      {view === 'summary' && summary && (
        <div style={{ padding: 16 }}>
          {!summary.hasSetupDNA && (
            <div style={{ padding: '12px 14px', background: 'rgba(168,85,247,0.08)', borderRadius: 10, border: '1px dashed rgba(168,85,247,0.3)', marginBottom: 14, textAlign: 'center' }}>
              <div style={{ color: '#a855f7', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🧬 Your Creator DNA is not set up</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 }}>Set up your DNA so CLICK writes in YOUR voice, not generic AI voice.</div>
              <button onClick={() => setView('quiz')} style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🚀 Set Up My DNA (2 mins)
              </button>
            </div>
          )}

          {summary.hasSetupDNA && (
            <>
              {/* Voice Profile */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Tone', value: summary.voice.tone, emoji: VOICE_EMOJI[summary.voice.tone] || '🎙️' },
                  { label: 'Personality', value: summary.voice.personality, emoji: VOICE_EMOJI[summary.voice.personality] || '💡' },
                  { label: 'Pacing', value: summary.voice.pacing, emoji: summary.voice.pacing === 'fast' ? '⚡' : summary.voice.pacing === 'slow' ? '🎬' : '🎯' }
                ].map(item => (
                  <div key={item.label} style={{ padding: '10px 12px', background: 'rgba(168,85,247,0.08)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.12)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{item.emoji}</div>
                    <div style={{ color: '#a855f7', fontSize: 11, letterSpacing: '0.06em', marginBottom: 2 }}>{item.label.toUpperCase()}</div>
                    <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Core Message */}
              {summary.content.coreMessage && (
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10 }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.08em', marginBottom: 4 }}>CORE MESSAGE</div>
                  <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>&quot;{summary.content.coreMessage}&quot;</div>
                </div>
              )}

              {/* Unique Angle */}
              {summary.content.uniqueAngle && (
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10 }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.08em', marginBottom: 4 }}>UNIQUE ANGLE</div>
                  <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>{summary.content.uniqueAngle}</div>
                </div>
              )}

              {/* Clichés to Avoid */}
              {summary.clichesToAvoid.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(255,60,60,0.06)', borderRadius: 8, border: '1px solid rgba(255,60,60,0.12)' }}>
                  <div style={{ color: '#ff6060', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>🚫 YOUR OVERUSED PHRASES (CLICK avoids these)</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {summary.clichesToAvoid.map((p, i) => (
                      <span key={i} style={{ padding: '2px 8px', background: 'rgba(255,60,60,0.1)', borderRadius: 4, color: '#ff9999', fontSize: 11, textDecoration: 'line-through' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* QUIZ VIEW */}
      {view === 'quiz' && questions.length > 0 && (
        <div style={{ padding: 16 }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>
              <span>Question {quizStep + 1} of {questions.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #a855f7, #7c3aed)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Question */}
          {currentQuestion && (
            <div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>
                {currentQuestion.question}
                {currentQuestion.optional && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 400 }}> (optional)</span>}
              </div>

              {currentQuestion.type === 'single_select' && currentQuestion.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {currentQuestion.options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setAnswer(currentQuestion.id, opt.value); }}
                      style={{
                        padding: '10px 14px',
                        background: answers[currentQuestion.id] === opt.value ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${answers[currentQuestion.id] === opt.value ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 8,
                        color: answers[currentQuestion.id] === opt.value ? '#a855f7' : 'rgba(255,255,255,0.7)',
                        fontSize: 13, textAlign: 'left', cursor: 'pointer',
                        fontWeight: answers[currentQuestion.id] === opt.value ? 700 : 400
                      }}
                    >
                      {opt.label}
                      {opt.description && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{opt.description}</div>}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'text_input' && (
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={e => setAnswer(currentQuestion.id, e.target.value)}
                  placeholder={currentQuestion.placeholder}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(168,85,247,0.25)',
                    borderRadius: 8,
                    color: '#fff', fontSize: 13,
                    outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              )}

              {currentQuestion.type === 'multi_select' && currentQuestion.options && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {currentQuestion.options.map((opt: any) => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const label = typeof opt === 'object' ? opt.label : opt;
                    const selected = (answers[currentQuestion.id] || []).includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => toggleMultiSelect(currentQuestion.id, val)}
                        style={{
                          padding: '6px 12px',
                          background: selected ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selected ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 7,
                          color: selected ? '#a855f7' : 'rgba(255,255,255,0.6)',
                          fontSize: 12, cursor: 'pointer',
                          fontWeight: selected ? 700 : 400
                        }}
                      >
                        {selected ? '✓ ' : ''}{label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button
              onClick={() => setQuizStep(Math.max(0, quizStep - 1))}
              disabled={quizStep === 0}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: quizStep === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                fontSize: 13, cursor: quizStep === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              ← Back
            </button>

            {quizStep < questions.length - 1 ? (
              <button
                onClick={() => setQuizStep(quizStep + 1)}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={saveDNA}
                disabled={saving}
                style={{
                  padding: '9px 20px',
                  background: saved ? 'linear-gradient(135deg, #00c864, #00a050)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saved ? '✅ DNA Saved!' : saving ? 'Saving...' : '🧬 Save My DNA'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* AVATAR VIEW */}
      {view === 'avatar' && (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
            {/* Avatar Preview Section */}
            <div style={{
              flex: '0 0 160px',
              height: 200,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 12,
              border: '1px solid rgba(168,85,247,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ fontSize: 64, marginBottom: 10 }}>
                {avatarData?.characterId === 'modern_minimalist' ? '🧑‍💼' :
                 avatarData?.characterId === 'casual_creator' ? '🤳' :
                 avatarData?.characterId === 'tech_innovator' ? '💻' :
                 avatarData?.characterId === 'investor' ? '📈' :
                 avatarData?.characterId === 'biohacker' ? '🧬' :
                 avatarData?.characterId === 'alchemist' ? '🧙‍♂️' :
                 avatarData?.characterId === 'neon_hustler' ? '🌃' : '✨'}
              </div>
              <div style={{ color: '#a855f7', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>PREVIEW</div>
              <div style={{
                position: 'absolute', bottom: 0, width: '100%', padding: '6px 0',
                background: 'rgba(168,85,247,0.1)', textAlign: 'center', color: '#fff', fontSize: 10
              }}>
                {avatarData?.characterId?.replace('_', ' ').toUpperCase() || 'SELECT AN ARCHETYPE'}
              </div>
            </div>

            {/* Archetype Info Section */}
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Digital Identity Synthesis</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
                Your avatar archetype defines how you appear in autonomous content and meta-verses. Choose a persona that resonates with your brand voice.
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { id: 'modern_minimalist', label: '🧑‍💼 Minimalist' },
                  { id: 'casual_creator', label: '🤳 Casual' },
                  { id: 'tech_innovator', label: '💻 Innovator' },
                  { id: 'investor', label: '📈 Investor' },
                  { id: 'biohacker', label: '🧬 Bio-Hacker' },
                  { id: 'alchemist', label: '🧙‍♂️ Alchemist' },
                  { id: 'neon_hustler', label: '🌃 Hustler' },
                  { id: 'custom', label: '✨ Custom' }
                ].map(av => (
                  <button
                    key={av.id}
                    onClick={() => setAvatarData({ ...avatarData, characterId: av.id })}
                    style={{
                      padding: '8px 10px',
                      background: avatarData?.characterId === av.id ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${avatarData?.characterId === av.id ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8,
                      color: avatarData?.characterId === av.id ? '#fff' : 'rgba(255,255,255,0.6)',
                      fontSize: 12, textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      fontWeight: avatarData?.characterId === av.id ? 700 : 400
                    }}
                  >
                    {av.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {avatarData?.characterId === 'custom' && (
            <div style={{
              marginBottom: 20, padding: 12, background: 'rgba(168,85,247,0.05)', borderRadius: 10, border: '1px solid rgba(168,85,247,0.15)'
            }}>
              <div style={{ color: '#a855f7', fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>VRM MODEL INTEGRATION</div>
              <input
                type="text"
                value={avatarData?.customUrl || ''}
                onChange={(e) => setAvatarData({ ...avatarData, customUrl: e.target.value })}
                placeholder="https://assets.readyplayer.me/avatar.vrm"
                style={{
                  width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 6 }}>Support for .vrm, .glb, and ReadyPlayerMe formats.</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: saved ? '#00c864' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 500 }}>
              {saved ? '✨ Synchronized with Neural Core' : 'Select an archetype above'}
            </div>
            <button
              onClick={saveAvatar}
              disabled={saving}
              style={{
                padding: '10px 24px',
                background: saved ? 'linear-gradient(135deg, #00c864, #00a050)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                boxShadow: saved ? '0 4px 12px rgba(0,200,100,0.3)' : '0 4px 12px rgba(168,85,247,0.3)',
                border: 'none', borderRadius: 9,
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              {saved ? '✅ IDENTITY SAVED' : saving ? 'SYNCING...' : '👤 FINALIZE AVATAR'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
