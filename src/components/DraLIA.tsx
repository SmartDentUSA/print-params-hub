import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import PrinterParamsFlow from './PrinterParamsFlow';
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface MediaCard {
  type: 'video' | 'article';
  title: string;
  thumbnail?: string;
  url?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  interactionId?: string;
  feedbackSent?: boolean;
  mediaCards?: MediaCard[];
}

interface DraLIAProps {
  embedded?: boolean;
}

const localeMap: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

interface TopicOption {
  id: string;
  emoji: string;
  label: string;
  description: string;
  userMessage: string;
}

const TOPIC_OPTIONS: TopicOption[] = [
  {
    id: 'parameters',
    emoji: '🎯',
    label: 'Quero acertar na Impressão!',
    description: 'Configurações ideais para sua impressora e nossa resina',
    userMessage: 'Quero acertar na impressão! Me ajude com configurações ideais.',
  },
  {
    id: 'commercial',
    emoji: '💰',
    label: 'Quero transformar minha vida profissional e dos meus pacientes!',
    description: 'Tudo sobre nossos equipamentos, softwares e sistemas completos',
    userMessage: 'Quero transformar minha vida profissional! Me conte sobre equipamentos e sistemas.',
  },
  {
    id: 'products',
    emoji: '🔬',
    label: 'Quero conhecer mais dos produtos',
    description: 'Catálogo completo, resinas e indicações técnicas e certificados',
    userMessage: 'Quero conhecer mais dos produtos e resinas.',
  },
  {
    id: 'support',
    emoji: '🛠️',
    label: 'Preciso de uma Mãozinha!',
    description: 'Suporte técnico e ajuda com equipamentos ou materiais',
    userMessage: 'Preciso de uma mãozinha! Tenho um problema técnico.',
  },
];

// Simple markdown renderer (bold, links, lists)
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, lineIdx) => {
        // Parse inline: **bold** and [text](url)
        const parseInline = (raw: string): React.ReactNode[] => {
          const parts: React.ReactNode[] = [];
          let remaining = raw;
          let key = 0;

          while (remaining.length > 0) {
            // Bold+Link combo: **[text](url)**
            const boldLinkMatch = remaining.match(/\*\*\[(.+?)\]\(([^)]+)\)\*\*/);
            // Link with bold inside text: [**text**](url)
            const boldInLinkMatch = remaining.match(/\[\*\*(.+?)\*\*\]\(([^)]+)\)/);
            // Bold: **text**
            const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
            // Link: [text](url)
            const linkMatch = remaining.match(/\[(.+?)\]\(([^)]+)\)/);
            // Raw URL: https://... (no markdown brackets)
            const rawUrlMatch = remaining.match(/https?:\/\/[^\s)"'<>]+/);

            let firstMatch: RegExpMatchArray | null = null;
            let firstType: 'bold' | 'link' | 'boldlink' | 'boldInLink' | 'rawUrl' | null = null;

            const boldLinkIdx = boldLinkMatch?.index ?? Infinity;
            const boldInLinkIdx = boldInLinkMatch?.index ?? Infinity;
            const boldIdx = boldMatch?.index ?? Infinity;
            const linkIdx = linkMatch?.index ?? Infinity;
            const rawUrlIdx = rawUrlMatch?.index ?? Infinity;

            const minIdx = Math.min(boldLinkIdx, boldInLinkIdx, boldIdx, linkIdx, rawUrlIdx);

            if (boldLinkMatch && boldLinkIdx === minIdx) {
              firstMatch = boldLinkMatch;
              firstType = 'boldlink';
            } else if (boldInLinkMatch && boldInLinkIdx === minIdx) {
              firstMatch = boldInLinkMatch;
              firstType = 'boldInLink';
            } else if (linkMatch && linkIdx === minIdx) {
              firstMatch = linkMatch;
              firstType = 'link';
            } else if (rawUrlMatch && rawUrlIdx === minIdx) {
              firstMatch = rawUrlMatch;
              firstType = 'rawUrl';
            } else if (boldMatch) {
              firstMatch = boldMatch;
              firstType = 'bold';
            }

            if (!firstMatch || firstType === null) {
              parts.push(<span key={key++}>{remaining}</span>);
              break;
            }

            const before = remaining.slice(0, firstMatch.index!);
            if (before) parts.push(<span key={key++}>{before}</span>);

            if (firstType === 'boldlink' || firstType === 'boldInLink') {
              const href = firstMatch[2];
              const isWhatsApp = href.includes('wa.me');
              parts.push(
                <a
                  key={key++}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline font-semibold ${isWhatsApp ? 'text-green-600' : 'text-blue-600'}`}
                >
                  {firstMatch[1]}
                </a>
              );
            } else if (firstType === 'bold') {
              parts.push(<strong key={key++} className="font-semibold">{firstMatch[1]}</strong>);
            } else if (firstType === 'link') {
              const href = firstMatch[2];
              const isWhatsApp = href.includes('wa.me');
              parts.push(
                <a
                  key={key++}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline font-medium ${isWhatsApp ? 'text-green-600' : 'text-blue-600'}`}
                >
                  {firstMatch[1]}
                </a>
              );
            } else if (firstType === 'rawUrl') {
              const href = firstMatch[0];
              const isWhatsApp = href.includes('wa.me');
              parts.push(
                <a
                  key={key++}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline font-medium ${isWhatsApp ? 'text-green-600' : 'text-blue-600'}`}
                >
                  {isWhatsApp ? 'Chamar no WhatsApp' : href}
                </a>
              );
            }

            remaining = remaining.slice(firstMatch.index! + firstMatch[0].length);
          }

          return parts;
        };

        // List item
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={lineIdx} className="flex gap-2 ml-2">
              <span className="mt-0.5 shrink-0">•</span>
              <span>{parseInline(line.slice(2))}</span>
            </div>
          );
        }

        // Empty line → spacer
        if (line.trim() === '') {
          return <div key={lineIdx} className="h-2" />;
        }

        return (
          <div key={lineIdx}>
            {parseInline(line)}
          </div>
        );
      })}
    </>
  );
}

export default function DraLIA({ embedded = false }: DraLIAProps) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('dra_lia.welcome_message'),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'positive' | 'negative' | 'comment'>>({});
  const [feedbackComments, setFeedbackComments] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const generateSessionId = () => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('dra_lia_session', id);
    return id;
  };

  const sessionId = useRef<string>(
    sessionStorage.getItem('dra_lia_session') || generateSessionId()
  );

  const lang = localeMap[language] || 'pt-BR';
  const pendingQueryRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Update welcome message when language changes
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === 'welcome' ? { ...m, content: t('dra_lia.welcome_message') } : m))
    );
  }, [language, t]);

  const [leadCollected, setLeadCollected] = useState<boolean>(() => {
    return !!sessionStorage.getItem('dra_lia_lead_collected');
  });
  const [topicSelected, setTopicSelected] = useState<boolean>(() => {
    return !!sessionStorage.getItem('dra_lia_topic_context');
  });
  const [topicContext, setTopicContext] = useState<string>(() => {
    return sessionStorage.getItem('dra_lia_topic_context') || '';
  });

  // Printer guided flow state
  const [printerFlowStep, setPrinterFlowStep] = useState<'brand' | 'model' | 'resin' | null>(null);

  // Listen for dra-lia:ask CustomEvent from KnowledgeBase search
  useEffect(() => {
    if (embedded) return;
    const handler = (e: CustomEvent<{ query: string }>) => {
      const query = e.detail?.query?.trim();
      if (!query) return;
      pendingQueryRef.current = query;
      setIsOpen(true);
      setInput(query);
    };
    window.addEventListener('dra-lia:ask', handler as EventListener);
    return () => window.removeEventListener('dra-lia:ask', handler as EventListener);
  }, [embedded]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/dra-lia?action=chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          lang,
          session_id: sessionId.current,
          topic_context: topicContext || undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        // Mensagem amigável para instabilidade temporária (503) ou outros erros
        const friendlyError = errData.error || t('dra_lia.connection_error');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: friendlyError } : m
          )
        );
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let interactionId: string | undefined;
      let mediaCards: MediaCard[] | undefined;
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);

            // Meta chunk with interaction_id and media_cards
            if (parsed.type === 'meta') {
              if (parsed.interaction_id) interactionId = parsed.interaction_id;
              if (parsed.media_cards) mediaCards = parsed.media_cards;
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: fullContent, interactionId, mediaCards }
                    : m
                )
              );
            }
          } catch {
            // partial JSON
          }
        }
      }

      // Final update with interactionId and mediaCards
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, interactionId, mediaCards } : m
        )
      );

      // Detect lead collection confirmation from backend
      if (!leadCollected && /Agora sim, estou pronta|Now I'm ready|Ahora sí, estoy lista/i.test(fullContent)) {
        setLeadCollected(true);
        sessionStorage.setItem('dra_lia_lead_collected', 'true');
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: e instanceof Error ? e.message : t('dra_lia.connection_error') }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, lang, t]);

  // Fire sendMessage once input is updated by the CustomEvent handler
  useEffect(() => {
    if (pendingQueryRef.current && input === pendingQueryRef.current) {
      pendingQueryRef.current = null;
      sendMessage();
    }
  }, [input, sendMessage]);

  const sendFeedback = useCallback(
    async (interactionId: string, feedback: 'positive' | 'negative', comment?: string) => {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/dra-lia?action=feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interaction_id: interactionId, feedback, feedback_comment: comment }),
        });
      } catch {
        // silently fail
      }
    },
    []
  );

  const handleFeedback = useCallback(
    (msgId: string, interactionId: string, type: 'positive' | 'negative') => {
      if (type === 'positive') {
        setFeedbackState((prev) => ({ ...prev, [msgId]: 'positive' }));
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedbackSent: true } : m)));
        sendFeedback(interactionId, 'positive');
      } else {
        setFeedbackState((prev) => ({ ...prev, [msgId]: 'comment' }));
      }
    },
    [sendFeedback]
  );

  const submitNegativeFeedback = useCallback(
    (msgId: string, interactionId: string) => {
      const comment = feedbackComments[msgId] || '';
      setFeedbackState((prev) => ({ ...prev, [msgId]: 'negative' }));
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedbackSent: true } : m)));
      sendFeedback(interactionId, 'negative', comment);
    },
    [feedbackComments, sendFeedback]
  );

  const handleTopicSelect = useCallback((opt: TopicOption) => {
    // Intercept parameters topic — use guided flow instead of AI
    if (opt.id === 'parameters') {
      setTopicSelected(true);
      setTopicContext(opt.id);
      sessionStorage.setItem('dra_lia_topic_context', opt.id);
      setPrinterFlowStep('brand');
      return;
    }

    setTopicSelected(true);
    setTopicContext(opt.id);
    sessionStorage.setItem('dra_lia_topic_context', opt.id);
    // We need to send after input is set — use a tiny timeout so state flushes
    setTimeout(() => {
      setInput('');
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: opt.userMessage };
      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '' };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      const history = messages
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      fetch(`${SUPABASE_URL}/functions/v1/dra-lia?action=chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: opt.userMessage,
          history,
          lang,
          session_id: sessionId.current,
          topic_context: opt.id,
        }),
      }).then(async (resp) => {
        if (!resp.ok || !resp.body) {
          const errData = await resp.json().catch(() => ({}));
          const friendlyError = errData.error || t('dra_lia.connection_error');
          setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: friendlyError } : m));
          setIsLoading(false);
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let interactionId: string | undefined;
        let mediaCards: MediaCard[] | undefined;
        let fullContent = '';

        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              if (line.endsWith('\r')) line = line.slice(0, -1);
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.type === 'meta') {
                  if (parsed.interaction_id) interactionId = parsed.interaction_id;
                  if (parsed.media_cards) mediaCards = parsed.media_cards;
                  continue;
                }
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullContent, interactionId, mediaCards } : m));
                }
              } catch { /* partial JSON */ }
            }
          }
          setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, interactionId, mediaCards } : m));
          // Detect lead collection confirmation from backend
          if (!leadCollected && /Agora sim, estou pronta|Now I'm ready|Ahora sí, estoy lista/i.test(fullContent)) {
            setLeadCollected(true);
            sessionStorage.setItem('dra_lia_lead_collected', 'true');
          }
          setIsLoading(false);
        };

        processStream().catch(() => setIsLoading(false));
      }).catch((e) => {
        setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: e instanceof Error ? e.message : t('dra_lia.connection_error') } : m));
        setIsLoading(false);
      });
    }, 50);
  }, [messages, lang, t]);

  const resetTopic = useCallback(() => {
    setTopicSelected(false);
    setTopicContext('');
    setLeadCollected(false);
    setPrinterFlowStep(null);
    sessionStorage.removeItem('dra_lia_topic_context');
    sessionStorage.removeItem('dra_lia_lead_collected');
    // Generate new session ID so backend starts fresh (old session still has lead data)
    sessionId.current = generateSessionId();
    // Reset the welcome message to show name prompt again
    setMessages([{ id: 'welcome', role: 'assistant', content: t('dra_lia.welcome_message') }]);
  }, [t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const chatContent = (
    <div
      className={`flex flex-col bg-white ${
        embedded ? 'w-full h-full' : 'w-[380px] h-[560px] rounded-2xl shadow-2xl'
      } overflow-hidden`}
      style={{ fontFamily: 'inherit' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white shrink-0"
        style={{ background: '#1e3a5f' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
            🦷
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">{t('dra_lia.button_label')}</div>
            <div className="text-xs text-white/70 leading-tight">{t('dra_lia.header_subtitle')}</div>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={() => setIsOpen(false)}
            aria-label={t('dra_lia.close_aria')}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]">
              <div
                className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                }`}
                style={msg.role === 'user' ? { background: '#1e3a5f' } : {}}
              >
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>

              {/* Topic selection menu — shown after lead collected (name+email), before topic is selected */}
              {(() => {
                const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id;
                return msg.id === lastAssistantId && leadCollected && !topicSelected && !isLoading;
              })() && (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {TOPIC_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleTopicSelect(opt)}
                        className="flex flex-col items-start p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 transition-all text-left text-xs shadow-sm"
                        style={{ borderColor: 'transparent', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1e3a5f')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                      >
                        <span className="text-base mb-1">{opt.emoji}</span>
                        <span className="font-semibold text-gray-800 leading-tight">{opt.label}</span>
                        <span className="text-gray-400 leading-tight mt-0.5 text-[10px]">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-[10px] text-gray-400 mt-2">
                    Ou digite sua dúvida livremente abaixo ↓
                  </p>
                </div>
              )}
              {/* Media cards strip — videos with thumbnail / articles */}
              {msg.role === 'assistant' && msg.mediaCards && msg.mediaCards.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.mediaCards.map((card, i) => (
                    <a
                      key={i}
                      href={card.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors overflow-hidden shadow-sm p-2"
                    >
                      <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                        {card.thumbnail ? (
                          <img
                            src={card.thumbnail}
                            alt={card.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-2xl">{card.type === 'video' ? '▶' : '📄'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">
                          {card.title}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {card.type === 'video' ? '▶ Assistir no site' : '📖 Ver publicação'}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}


              {msg.role === 'assistant' &&
                msg.id !== 'welcome' &&
                msg.interactionId &&
                !msg.feedbackSent && (
                  <div className="mt-1 ml-1">
                    {feedbackState[msg.id] === 'comment' ? (
                      <div className="mt-2 space-y-1">
                        <textarea
                          className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                          rows={2}
                          placeholder={t('dra_lia.feedback_comment_placeholder')}
                          value={feedbackComments[msg.id] || ''}
                          onChange={(e) =>
                            setFeedbackComments((prev) => ({ ...prev, [msg.id]: e.target.value }))
                          }
                        />
                        <button
                          onClick={() => submitNegativeFeedback(msg.id, msg.interactionId!)}
                          className="text-xs px-2 py-1 rounded-lg text-white"
                          style={{ background: '#1e3a5f' }}
                        >
                          {t('dra_lia.feedback_send')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => handleFeedback(msg.id, msg.interactionId!, 'positive')}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition-colors px-2 py-1 rounded-lg hover:bg-green-50"
                          title={t('dra_lia.feedback_helpful')}
                        >
                          <ThumbsUp size={12} />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, msg.interactionId!, 'negative')}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                          title={t('dra_lia.feedback_missing')}
                        >
                          <ThumbsDown size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

              {msg.feedbackSent && msg.role === 'assistant' && msg.id !== 'welcome' && (
                <div className="text-xs text-gray-400 ml-1 mt-1">{t('dra_lia.feedback_thanks')}</div>
              )}
            </div>
          </div>
        ))}

        {/* Printer guided flow */}
        {printerFlowStep && (
          <div className="flex justify-start">
            <div className="max-w-[95%] w-full">
              <PrinterParamsFlow
                step={printerFlowStep}
                onStepChange={(newStep) => {
                  if (newStep === null) {
                    setPrinterFlowStep(null);
                    setTopicSelected(false);
                    setTopicContext('');
                    sessionStorage.removeItem('dra_lia_topic_context');
                  } else {
                    setPrinterFlowStep(newStep);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 shadow-sm px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs text-gray-400 ml-1">{t('dra_lia.typing')}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-white shrink-0">
        {/* "Novo assunto" reset link — only when topic is selected */}
        {topicSelected && (
          <div className="px-3 pt-2 pb-0 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <span className="text-[10px]">📌</span>
              {TOPIC_OPTIONS.find((o) => o.id === topicContext)?.label || 'Assunto selecionado'}
            </span>
            <button
              onClick={resetTopic}
              className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline transition-colors"
            >
              ↩ Novo assunto
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end p-3 pt-2">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent max-h-24 min-h-[40px]"
            style={{ '--tw-ring-color': '#1e3a5f' } as React.CSSProperties}
            placeholder={t('dra_lia.input_placeholder')}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            aria-label={t('dra_lia.send_aria')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity shrink-0"
            style={{ background: '#1e3a5f' }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return chatContent;
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t('dra_lia.open_aria')}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          style={{ background: '#1e3a5f' }}
        >
          <span className="text-base">🦷</span>
          <span className="text-sm font-semibold">{t('dra_lia.button_label')}</span>
          <MessageCircle size={16} className="opacity-80" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          {chatContent}
        </div>
      )}
    </>
  );
}
