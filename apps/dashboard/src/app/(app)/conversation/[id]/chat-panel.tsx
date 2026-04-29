'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, CalendarCheck, CheckCircle2, RotateCcw, Send, User, UserCheck } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Conversation, Message, Vaccine } from '@/lib/types';
import { AppointmentModal } from './appointment-modal';

function roleMeta(role: Message['role']) {
  switch (role) {
    case 'user':
      return {
        label: 'Paciente',
        icon: User,
        align: 'items-start' as const,
        bubble: 'bg-white border border-slate-200 text-slate-800',
        badge: 'bg-slate-100 text-slate-700',
      };
    case 'assistant':
      return {
        label: 'IA',
        icon: Bot,
        align: 'items-end' as const,
        bubble: 'bg-brand text-white',
        badge: 'bg-brand text-white',
      };
    case 'human':
      return {
        label: 'Atendente',
        icon: UserCheck,
        align: 'items-end' as const,
        bubble: 'bg-accent text-accent-foreground',
        badge: 'bg-accent text-accent-foreground',
      };
    default:
      return {
        label: role,
        icon: Bot,
        align: 'items-start' as const,
        bubble: 'bg-slate-100 text-slate-600',
        badge: 'bg-slate-100 text-slate-600',
      };
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = new Date(d);
  dayStart.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dayStart.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
}

export function ChatPanel({
  conversation,
  currentUserId,
  templates = [],
  vaccines = [],
}: {
  conversation: Conversation;
  currentUserId: string;
  templates?: Array<{ label: string; text: string }>;
  vaccines?: Vaccine[];
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = conversation.messages.filter((m) => m.role !== 'tool' && m.role !== 'system');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [visible.length]);

  useEffect(() => {
    const es = new EventSource('/api/events/conversations');
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.conversationId === conversation.id) router.refresh();
      } catch {
        /* ignore */
      }
    };
    es.addEventListener('message.created', handler);
    es.addEventListener('conversation.assigned', handler);
    es.addEventListener('conversation.closed', handler);
    es.addEventListener('conversation.ai_paused', handler);

    // Polling de seguranca: alguns proxies bufferizam SSE em prod.
    // Garante que a UI nunca fica "presa" mais que 5s sem atualizar.
    const poll = setInterval(() => router.refresh(), 5000);

    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [conversation.id, router]);

  async function handleAssign() {
    try {
      await api(`/conversations/${conversation.id}/assign`, { method: 'POST', body: '{}' });
      router.refresh();
    } catch {
      setError('Falha ao assumir conversa.');
    }
  }

  async function handleClose() {
    if (!confirm('Encerrar esta conversa?')) return;
    try {
      await api(`/conversations/${conversation.id}/close`, { method: 'POST', body: '{}' });
      router.refresh();
    } catch {
      setError('Falha ao encerrar.');
    }
  }

  async function handleReturnToAi() {
    if (!confirm('Devolver esta conversa para a IA? Ela vai voltar a responder.')) return;
    try {
      await api(`/conversations/${conversation.id}/resume-ai`, { method: 'POST', body: '{}' });
      router.refresh();
    } catch {
      setError('Falha ao devolver para a IA.');
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/conversations/${conversation.id}/message`, {
        method: 'POST',
        body: JSON.stringify({ text, userId: currentUserId }),
      });
      setText('');
      router.refresh();
    } catch (err) {
      setError(`Falha ao enviar: ${(err as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  const closed = conversation.status === 'closed';
  const awaitingHandoff = conversation.status === 'awaiting_handoff';
  const humanInControl = conversation.status === 'assigned' || conversation.status === 'awaiting_handoff';

  const groups: Array<{ label: string; messages: Message[] }> = [];
  for (const m of visible) {
    const label = formatDateLabel(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(m);
    else groups.push({ label, messages: [m] });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        {awaitingHandoff && (
          <button
            onClick={handleAssign}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-deep"
          >
            <UserCheck className="h-4 w-4" />
            Assumir conversa
          </button>
        )}
        {!closed && (
          <button
            onClick={() => setApptOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/20"
          >
            <CalendarCheck className="h-4 w-4" />
            Registrar agendamento
          </button>
        )}
        {humanInControl && !closed && (
          <button
            onClick={handleReturnToAi}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-deep hover:bg-brand/10"
            title="A IA volta a responder esta conversa automaticamente"
          >
            <RotateCcw className="h-4 w-4" />
            Devolver para IA
          </button>
        )}
        {!closed && (
          <button
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Encerrar
          </button>
        )}
      </div>

      {apptOpen && (
        <AppointmentModal
          patientId={conversation.patient.id}
          conversationId={conversation.id}
          vaccines={vaccines}
          onClose={() => setApptOpen(false)}
        />
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6"
      >
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Nenhuma mensagem ainda.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="space-y-3">
                  {group.messages.map((m) => {
                    const meta = roleMeta(m.role);
                    const Icon = meta.icon;
                    const isRight = meta.align === 'items-end';
                    return (
                      <div key={m.id} className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[78%] flex-col gap-1 ${meta.align}`}>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${meta.badge}`}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {meta.label}
                            </span>
                            <span>{formatTime(m.createdAt)}</span>
                          </div>
                          <div
                            className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${meta.bubble}`}
                          >
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!closed && (
        <form onSubmit={handleSend} className="flex flex-col gap-2">
          {templates.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText((prev) => (prev ? prev + '\n' + t.text : t.text))}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-brand/30 hover:text-brand-deep"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Digite sua mensagem para o paciente... (Enter envia, Shift+Enter quebra linha)"
              rows={2}
              className="flex-1 resize-none rounded-xl bg-transparent p-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-card transition hover:bg-brand-deep disabled:opacity-40"
              title="Enviar (Enter)"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[11px] text-slate-400">
            Mensagens enviadas aqui vão direto ao paciente pelo WhatsApp.
          </p>
        </form>
      )}
    </div>
  );
}
