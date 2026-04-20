'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';

interface Toast {
  id: number;
  title: string;
  body: string;
  conversationId?: string;
}

const soundDataUri =
  // Tom curto (base64 de um WAV simples, ~400ms senoidal 880Hz decay)
  'data:audio/wav;base64,UklGRrwEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZgEAAAA/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wA=';

export function NotificationsListener() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(soundDataUri);
    audioRef.current.volume = 0.5;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }

    const es = new EventSource('/api/events/conversations');

    const dispatch = (title: string, body: string, conversationId?: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [{ id, title, body, conversationId }, ...prev].slice(0, 4));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 7000);

      audioRef.current?.play().catch(() => undefined);

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, { body, tag: conversationId, icon: '/logo.png' });
          if (conversationId) {
            n.onclick = () => {
              window.focus();
              window.location.href = `/conversation/${conversationId}`;
              n.close();
            };
          }
        } catch {
          /* ignore */
        }
      }
    };

    const onHandoff = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        dispatch(
          'Paciente na fila',
          data.summary ?? 'Um paciente pediu encaminhamento para humano.',
          data.conversationId,
        );
      } catch {
        /* ignore */
      }
    };

    es.addEventListener('conversation.handoff_requested', onHandoff);

    return () => {
      es.close();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto overflow-hidden rounded-2xl border border-brand/20 bg-white shadow-premium"
        >
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm font-semibold text-slate-900">{t.title}</div>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{t.body}</p>
              {t.conversationId && (
                <a
                  href={`/conversation/${t.conversationId}`}
                  className="mt-2 inline-flex text-xs font-semibold text-brand hover:text-brand-deep"
                >
                  Abrir conversa →
                </a>
              )}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-1 bg-brand-gradient" />
        </div>
      ))}
    </div>
  );
}
