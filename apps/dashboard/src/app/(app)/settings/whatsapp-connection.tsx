'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Power, RefreshCw, Smartphone, CheckCircle2, AlertTriangle } from 'lucide-react';

type State = 'connected' | 'connecting' | 'disconnected' | 'pairing' | 'unknown';

interface StatusDTO {
  state: State;
  qrcode?: string;
  pairCode?: string;
  phone?: string;
  profileName?: string;
}

function toQrImageSrc(qr: string): string {
  if (qr.startsWith('data:image')) return qr;
  if (qr.startsWith('iVBOR') || /^[A-Za-z0-9+/=]+$/.test(qr.slice(0, 40))) {
    return `data:image/png;base64,${qr}`;
  }
  return qr;
}

export function WhatsappConnection() {
  const [status, setStatus] = useState<StatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/instance/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StatusDTO;
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll ativo quando estamos em estado transitório (pairing/connecting)
  useEffect(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    if (!status) return;
    if (status.state === 'pairing' || status.state === 'connecting') {
      pollTimer.current = setInterval(fetchStatus, 3000);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [status, fetchStatus]);

  async function handleConnect() {
    setActioning(true);
    setError(null);
    try {
      const res = await fetch('/api/instance/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phone ? { phone: phone.replace(/\D/g, '') } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StatusDTO;
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar conexão');
    } finally {
      setActioning(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp? A IA vai parar de enviar e receber mensagens.')) return;
    setActioning(true);
    setError(null);
    try {
      const res = await fetch('/api/instance/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desconectar');
    } finally {
      setActioning(false);
    }
  }

  const state = status?.state ?? 'unknown';

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="flex flex-col gap-1 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <Smartphone className="h-3.5 w-3.5" />
          Integração WhatsApp
        </div>
        <h2 className="font-display text-lg font-bold text-slate-900">Conexão com o número da clínica</h2>
        <p className="text-sm text-slate-500">
          Conecte o número uma vez escaneando o QR code. Depois, a IA responde sozinha.
        </p>
      </header>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StateBadge state={state} />
          {status?.phone && (
            <span className="text-xs text-slate-500">
              Número: <span className="font-medium text-slate-700">+{status.phone}</span>
            </span>
          )}
          {status?.profileName && (
            <span className="text-xs text-slate-500">
              Perfil: <span className="font-medium text-slate-700">{status.profileName}</span>
            </span>
          )}
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {state === 'connected' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Tudo certo. A IA está operacional.
            </div>
            <button
              onClick={handleDisconnect}
              disabled={actioning}
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Desconectar
            </button>
          </div>
        ) : (state === 'pairing' || state === 'connecting') && (status?.qrcode || status?.pairCode) ? (
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            {status?.qrcode && (
              <div className="mx-auto flex w-full max-w-[240px] items-center justify-center rounded-2xl border-2 border-dashed border-brand/30 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={toQrImageSrc(status.qrcode)} alt="QR code WhatsApp" className="h-auto w-full" />
              </div>
            )}
            <div className="space-y-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Como conectar:</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                <li>Abra o WhatsApp no celular da clínica.</li>
                <li>Vá em <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b>.</li>
                <li>Aponte a câmera para o QR ao lado.</li>
              </ol>
              {status?.pairCode && (
                <div className="rounded-xl border border-brand/20 bg-brand-soft p-3">
                  <div className="text-xs text-brand-deep">Ou informe este código no app:</div>
                  <div className="mt-1 font-display text-xl font-bold tracking-widest text-brand-deep">
                    {status.pairCode}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aguardando pareamento...
              </div>
              <button
                onClick={handleConnect}
                disabled={actioning}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3" />
                Gerar novo QR
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Telefone (opcional, para código de pareamento)
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511987959188"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand/20 focus:ring-2"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                Deixe em branco para usar apenas QR code.
              </span>
            </label>
            <button
              onClick={handleConnect}
              disabled={actioning}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-deep disabled:opacity-50"
            >
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Conectar WhatsApp
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function StateBadge({ state }: { state: State }) {
  const map: Record<State, { label: string; className: string; dot: string }> = {
    connected: {
      label: 'Conectado',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    connecting: {
      label: 'Conectando...',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500 animate-pulse',
    },
    pairing: {
      label: 'Aguardando pareamento',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500 animate-pulse',
    },
    disconnected: {
      label: 'Desconectado',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    },
    unknown: {
      label: 'Status indisponível',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    },
  };
  const item = map[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${item.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}
