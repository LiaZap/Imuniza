'use client';

import { useEffect, useState } from 'react';
import { Bot, MessageSquare, Users, ArrowUpRight } from 'lucide-react';

interface BreakdownData {
  user: number;
  assistant: number;
  human: number;
  escalations: number;
  conversations: number;
  escalationRate: number;
  from: string;
  to: string;
}

type Preset = '7' | '14' | '30' | 'custom';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(d: number): string {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString().slice(0, 10);
}

export function BreakdownCard({ initial }: { initial: BreakdownData | null }) {
  const [preset, setPreset] = useState<Preset>('7');
  const [from, setFrom] = useState(daysAgoIso(6));
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<BreakdownData | null>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        let url = '/api/metrics/breakdown?';
        if (preset === 'custom') {
          url += `from=${from}&to=${to}`;
        } else {
          url += `days=${preset}`;
        }
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('falha');
        const json = (await res.json()) as BreakdownData;
        if (!cancelled) setData(json);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [preset, from, to]);

  const total = data ? data.user + data.assistant + data.human : 0;
  const empty = total === 0;
  const pctAssistant = !empty && data ? (data.assistant / total) * 100 : 0;
  const pctHuman = !empty && data ? (data.human / total) * 100 : 0;
  const pctUser = !empty && data ? (data.user / total) * 100 : 0;
  const aiResolveRate =
    data && data.user > 0 ? Math.round((data.assistant / data.user) * 100) : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
            <Bot className="h-4 w-4 text-brand" />
            IA × Humano
          </h2>
          {loading && (
            <span className="text-[11px] text-slate-400">atualizando...</span>
          )}
        </div>
        <p className="text-xs text-slate-500">Distribuição das mensagens no período selecionado.</p>
      </div>

      {/* Filtros de data */}
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(['7', '14', '30', 'custom'] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                preset === p
                  ? 'bg-brand text-white shadow-card'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-brand/30'
              }`}
            >
              {p === 'custom' ? 'Personalizado' : `${p} dias`}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-brand/40"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={to}
              min={from}
              max={todayIso()}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-brand/40"
            />
          </div>
        )}
      </div>

      {empty ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/50 text-sm text-slate-400">
          Sem mensagens neste período.
        </div>
      ) : (
        <div className="space-y-4">
          <Row
            icon={Bot}
            iconClass="text-brand"
            label="Respondido pela IA"
            value={data!.assistant}
            pct={pctAssistant}
            barClass="bg-brand"
          />
          <Row
            icon={Users}
            iconClass="text-accent-foreground"
            label="Respondido por humano"
            value={data!.human}
            pct={pctHuman}
            barClass="bg-accent"
          />
          <Row
            icon={MessageSquare}
            iconClass="text-slate-500"
            label="Mensagens de pacientes"
            value={data!.user}
            pct={pctUser}
            barClass="bg-slate-400"
          />
        </div>
      )}

      {/* KPIs derivados */}
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
        <div className="rounded-xl bg-brand-soft px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-deep/70">
            IA autoresolve
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-deep">
            {aiResolveRate}%
          </div>
          <div className="text-[11px] text-brand-deep/70">resposta da IA / paciente</div>
        </div>
        <div className="rounded-xl bg-violet-50 px-3 py-2.5 ring-1 ring-violet-100">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-800/80">
              Escalonamento
            </div>
            <ArrowUpRight className="h-3 w-3 text-violet-500" />
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-violet-800">
            {data?.escalationRate ?? 0}%
          </div>
          <div className="text-[11px] text-violet-700/70">
            {data?.escalations ?? 0} encaminhadas / {data?.conversations ?? 0} conversas
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  iconClass,
  label,
  value,
  pct,
  barClass,
}: {
  icon: typeof Bot;
  iconClass: string;
  label: string;
  value: number;
  pct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-slate-700">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          {label}
        </span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${barClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
