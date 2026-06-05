'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MarketingStrategistChat.css';
import AgentAvatar from './AgentAvatar';
import { apiGet, apiPost } from '../lib/api';
import { useTranslation } from '@/hooks/useTranslation';

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

const STARTER_QUESTION_KEYS = [
  'starterQuestion0',
  'starterQuestion1',
  'starterQuestion2',
  'starterQuestion3',
  'starterQuestion4'
];

const PLAYBOOK_LABELS: Record<string, { icon: string; labelKey: string }> = {
  growth: { icon: '📈', labelKey: 'growthPlaybook' },
  engagement: { icon: '💬', labelKey: 'engagementPlaybook' },
  monetization: { icon: '💰', labelKey: 'monetizationPlaybook' }
};

export default function MarketingStrategistChat({
  niche,
  platforms = ['tiktok'],
  className = ''
}: MarketingStrategistChatProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickTips, setQuickTips] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchQuickTips = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        niche: niche || '',
        platform: platforms[0] || '',
        count: '3',
      });
      const data: any = await apiGet(`/intelligence/strategist/tips?${params.toString()}`);
      if (data?.success && Array.isArray(data.tips)) setQuickTips(data.tips);
    } catch { /* silent fail — strategist tips are decorative */ }
  }, [niche, platforms]);

  useEffect(() => {
    // Load quick tips on mount
    fetchQuickTips();
    // Welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: t('marketingStrategistChat.welcomeMessage', { niche: niche || t('marketingStrategistChat.yourNicheFallback') }),
      timestamp: new Date(),
      followUps: STARTER_QUESTION_KEYS.slice(0, 3).map(k => t(`marketingStrategistChat.${k}`))
    }]);
  }, [niche, fetchQuickTips, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const data: any = await apiPost('/intelligence/strategist/ask', { question, niche, platforms });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data?.answer || data?.error || t('marketingStrategistChat.couldNotGenerateResponse'),
        timestamp: new Date(),
        // Server returns followUps; older copies of the UI expected followUpQuestions.
        // Accept either so a response shape change doesn't strand existing chats.
        followUps: data?.followUps || data?.followUpQuestions,
        relatedPlaybooks: data?.relatedPlaybooks,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('marketingStrategistChat.connectionIssue'),
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
    sendMessage(t('marketingStrategistChat.thirtyDayPlanPrompt', { niche, platforms: platforms.join(' and ') }));
  };

  return (
    <div className={`marketing-strategist-chat ${className}`}>

      {/* Header */}
      <div className="mchat-header">
        <AgentAvatar agentId="ora-1" size={48} />
        <div>
          <div className="mchat-title">
            {t('marketingStrategistChat.headerTitle')}
          </div>
          <div className="mchat-subtitle">
            {t('marketingStrategistChat.headerSubtitle')}
          </div>
        </div>
        <button
          type="button"
          onClick={generate30DayPlan}
          className="mchat-plan-btn"
          aria-label={t('marketingStrategistChat.thirtyDayPlanAria')}
        >
          📅 {t('marketingStrategistChat.thirtyDayPlanButton')}
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
                    type="button"
                    key={pb}
                    onClick={() => sendMessage(t('marketingStrategistChat.tellMeMorePrompt', { playbook: pb, niche: niche || '' }))}
                    className="mchat-playbook-btn"
                    aria-label={t('marketingStrategistChat.viewPlaybookAria', { playbook: pb })}
                  >
                    {PLAYBOOK_LABELS[pb]?.icon} {PLAYBOOK_LABELS[pb] ? t(`marketingStrategistChat.${PLAYBOOK_LABELS[pb].labelKey}`) : pb}
                  </button>
                ))}
              </div>
            )}

            {/* Follow-up questions */}
            {msg.followUps && msg.followUps.length > 0 && (
              <div className="mchat-followups">
                {msg.followUps.map((q, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="mchat-followup-btn"
                    aria-label={t('marketingStrategistChat.askFollowUpAria', { question: q })}
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
            <span>{t('marketingStrategistChat.analyzingYourNiche')}</span>
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
          placeholder={t('marketingStrategistChat.inputPlaceholder')}
          rows={1}
          className="mchat-textarea"
          aria-label={t('marketingStrategistChat.inputAria')}
        />
        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={isLoading || !inputValue.trim()}
          className={`mchat-send-btn ${inputValue.trim() ? 'mchat-send-active' : 'mchat-send-disabled'}`}
          aria-label={t('marketingStrategistChat.sendMessageAria')}
        >
          {isLoading ? '⏳' : '▶'}
        </button>
      </div>
    </div>
  );
}
