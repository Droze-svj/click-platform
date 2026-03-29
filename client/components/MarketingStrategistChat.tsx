'use client';

import React, { useState, useEffect, useRef } from 'react';
import './MarketingStrategistChat.css';
import AgentAvatar from './AgentAvatar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUps?: string[];
  relatedPlaybooks?: string[];
}

interface MarketingStrategistChatProps {
  niche?: string;
  platforms?: string[];
  className?: string;
}

const STARTER_QUESTIONS = [
  'How do I grow to 10K followers in my niche with $0 budget?',
  'What content should I post every day this week?',
  'Which platform should I focus on first?',
  'How do I turn my content into revenue?',
  'What makes my niche audience stop scrolling?'
];

const PLAYBOOK_LABELS: Record<string, { icon: string; label: string }> = {
  growth: { icon: '📈', label: 'Growth Playbook' },
  engagement: { icon: '💬', label: 'Engagement Playbook' },
  monetization: { icon: '💰', label: 'Monetization Playbook' }
};

export default function MarketingStrategistChat({
  niche,
  platforms = ['tiktok'],
  className = ''
}: MarketingStrategistChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickTips, setQuickTips] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load quick tips on mount
    fetchQuickTips();
    // Welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hey! I'm your CLICK AI Marketing Strategist. I have deep knowledge of the **${niche || 'your'}** niche and what's working across all platforms right now.\n\nAsk me anything — from content strategy to 30-day growth plans. I give specific advice, not generic tips.`,
      timestamp: new Date(),
      followUps: STARTER_QUESTIONS.slice(0, 3)
    }]);
  }, [niche]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchQuickTips = async () => {
    try {
      const res = await fetch(`/api/intelligence/strategist/tips?niche=${niche || ''}&platform=${platforms[0]}&count=3`);
      const data = await res.json();
      if (data.success) setQuickTips(data.tips);
    } catch { /* silent fail */ }
  };

  const sendMessage = async (text?: string) => {
    const question = text || inputValue.trim();
    if (!question || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/intelligence/strategist/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, niche, platforms })
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || data.error || 'I couldn\'t generate a response. Try rephrasing your question.',
        timestamp: new Date(),
        followUps: data.followUpQuestions,
        relatedPlaybooks: data.relatedPlaybooks
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Connection issue. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const generate30DayPlan = async () => {
    if (!niche) return;
    sendMessage(`Generate a specific 30-day content plan for ${niche} on ${platforms.join(' and ')} with $0 budget.`);
  };

  return (
    <div className={`marketing-strategist-chat ${className}`}>

      {/* Header */}
      <div className="mchat-header">
        <AgentAvatar agentId="ora-1" size={48} />
        <div>
          <div className="mchat-title">
            AI MARKETING STRATEGIST
          </div>
          <div className="mchat-subtitle">
            Niche-specific strategy · Real-time platform intelligence
          </div>
        </div>
        <button
          onClick={generate30DayPlan}
          className="mchat-plan-btn"
          aria-label="Generate a 30-day marketing plan"
        >
          📅 30-Day Plan
        </button>
      </div>

      {/* Quick Tips Bar */}
      {quickTips.length > 0 && (
        <div className="mchat-tips-bar">
          {quickTips.map((tip, i) => (
            <div key={i} className="mchat-tip">
              {tip.type === 'algorithm' ? '⚡' : tip.type === 'scheduling' ? '📅' : '🎣'} {tip.tip.length > 60 ? tip.tip.slice(0, 60) + '...' : tip.tip}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="mchat-messages">
        {messages.map(msg => (
          <div key={msg.id} className="mchat-msg-container" style={{ alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`mchat-msg ${msg.role === 'user' ? 'mchat-msg-user' : 'mchat-msg-assistant'}`}>
              {msg.content}
            </div>

            {/* Playbook buttons */}
            {msg.relatedPlaybooks && msg.relatedPlaybooks.length > 0 && (
              <div className="mchat-playbooks">
                {msg.relatedPlaybooks.map(pb => (
                  <button
                    key={pb}
                    onClick={() => sendMessage(`Tell me more about the ${pb} strategy for ${niche}`)}
                    className="mchat-playbook-btn"
                    aria-label={`View the ${pb} playbook`}
                  >
                    {PLAYBOOK_LABELS[pb]?.icon} {PLAYBOOK_LABELS[pb]?.label || pb}
                  </button>
                ))}
              </div>
            )}

            {/* Follow-up questions */}
            {msg.followUps && msg.followUps.length > 0 && (
              <div className="mchat-followups">
                {msg.followUps.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="mchat-followup-btn"
                    aria-label={`Ask follow-up: ${q}`}
                  >
                    ↳ {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="mchat-loading">
            <div className="mchat-dots">
              {[0,1,2].map(i => (
                <div key={i} className="mchat-dot" />
              ))}
            </div>
            <span>Analyzing your niche...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mchat-input-area">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a strategy question… e.g. 'How do I get to 1K followers in 30 days?'"
          rows={1}
          className="mchat-textarea"
          aria-label="Ask a strategy question"
        />
        <button
          onClick={() => sendMessage()}
          disabled={isLoading || !inputValue.trim()}
          className={`mchat-send-btn ${inputValue.trim() ? 'mchat-send-active' : 'mchat-send-disabled'}`}
          aria-label="Send message"
        >
          {isLoading ? '⏳' : '▶'}
        </button>
      </div>
    </div>
  );
}
