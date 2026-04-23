'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type State = 'connected' | 'connecting' | 'disconnected' | 'pairing' | 'unknown';

interface StatusEvent {
  type: 'instance.state_changed';
  state: State;
  phone?: string;
}

export function InstanceStatusBanner({ show }: { show: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [briefSuccess, setBriefSuccess] = useState(false);

  // Busca status inicial
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetch('/api/instance/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { state?: State } | null) => {
        if (!cancelled && data?.state) setState(data.state);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [show]);

  // Escuta mudanças em tempo real via SSE
  useEffect(() => {
    if (!show) return;
    const es = new EventSource('/api/events/conversations');

    const onChange = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as StatusEvent;
        setState((prev) => {
          if (prev !== 'connected' && data.state === 'connected') {
            setBriefSuccess(true);
            setTimeout(() => setBriefSuccess(false), 4000);
          }
          return data.state;
        });
      } catch {
        /* ignore */
      }
    };

    es.addEventListener('instance.state_changed', onChange);
    return () => {
      es.removeEventListener('instance.state_changed', onChange);
      es.close();
    };
  }, [show]);

  if (!show) return null;

  if (briefSuccess) {
    return (
      <div className="sticky top-0 z-40 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-800">
        <CheckCircle2 className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom" />
        WhatsApp reconectado. A IA voltou a operar.
      </div>
    );
  }

  if (state === 'disconnected' || state === 'unknown') {
    return (
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>
          WhatsApp desconectado — a IA não está recebendo nem enviando mensagens.
        </span>
        <a
          href="/settings"
          className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700"
        >
          Reconectar agora
        </a>
      </div>
    );
  }

  if (state === 'pairing' || state === 'connecting') {
    return (
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        WhatsApp em processo de conexão — finalize o pareamento em Configurações.
      </div>
    );
  }

  return null;
}
