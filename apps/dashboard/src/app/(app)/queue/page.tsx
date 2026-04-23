import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
  Pause,
  Sparkles,
  Users,
} from 'lucide-react';
import { apiGet } from '@/lib/api-server';
import type { Conversation, MetricsOverview } from '@/lib/types';
import { QueueRealtime } from './realtime';

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13)
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  return phone;
}

function relativeMinutes(iso: string): { minutes: number; label: string } {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return { minutes: 0, label: `${diffSec}s` };
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return { minutes, label: `${minutes} min` };
  const h = Math.floor(minutes / 60);
  if (h < 24) return { minutes, label: `${h}h ${minutes % 60}m` };
  return { minutes, label: `${Math.floor(h / 24)}d` };
}

function slaStyle(min: number): { chip: string; dot: string; label: string } {
  if (min < 5)
    return {
      chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      dot: 'bg-emerald-500',
      label: 'no prazo',
    };
  if (min < 15)
    return {
      chip: 'bg-amber-50 text-amber-700 ring-amber-200',
      dot: 'bg-amber-500',
      label: 'atenção',
    };
  return {
    chip: 'bg-rose-50 text-rose-700 ring-rose-200 animate-pulse',
    dot: 'bg-rose-500',
    label: 'urgente',
  };
}

function initials(name: string | null, phone: string): string {
  if (name) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
  return phone.slice(-2);
}

function avatarColor(seed: string): string {
  const palette = [
    'bg-brand-soft text-brand-deep',
    'bg-accent-soft text-accent-foreground',
    'bg-sky-50 text-sky-700',
    'bg-violet-50 text-violet-700',
    'bg-rose-50 text-rose-700',
    'bg-amber-50 text-amber-700',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

function getProfile(p: Conversation['patient']) {
  const profile = p.profile as {
    babyAgeMonths?: number;
    babyName?: string;
    medicalConditions?: string[];
  };
  const parts: string[] = [];
  if (typeof profile.babyAgeMonths === 'number') parts.push(`Bebê ${profile.babyAgeMonths}m`);
  if (profile.babyName) parts.push(profile.babyName);
  if (profile.medicalConditions?.length)
    parts.push(profile.medicalConditions.slice(0, 2).join(', '));
  return parts.join(' · ');
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'brand',
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  hint?: string;
  tone?: 'brand' | 'accent' | 'slate';
}) {
  const tones = {
    brand: 'from-brand/90 via-brand to-brand-deep text-white',
    accent: 'from-accent to-accent/80 text-accent-foreground',
    slate: 'from-slate-50 to-slate-100 text-slate-800 ring-slate-200/60',
  } as const;
  const isLight = tone === 'brand' || tone === 'accent';
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-card ring-1 ring-black/5 ${tones[tone]}`}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <div
            className={`font-display text-4xl font-extrabold leading-none ${
              isLight ? '' : 'text-slate-900'
            }`}
          >
            {value}
          </div>
          <div
            className={`mt-2 text-xs font-semibold uppercase tracking-wider ${
              isLight ? 'text-white/80' : 'text-slate-600'
            }`}
          >
            {label}
          </div>
          {hint && (
            <div className={`mt-1 text-[11px] ${isLight ? 'text-white/70' : 'text-slate-500'}`}>
              {hint}
            </div>
          )}
        </div>
        <Icon
          className={`h-5 w-5 ${isLight ? 'text-white/70' : 'text-slate-500'}`}
          strokeWidth={1.8}
        />
      </div>
    </div>
  );
}

function aiPauseInfo(iso?: string | null): { paused: boolean; untilLabel: string } {
  if (!iso) return { paused: false, untilLabel: '' };
  const until = new Date(iso).getTime();
  if (Number.isNaN(until) || until <= Date.now()) return { paused: false, untilLabel: '' };
  const d = new Date(until);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { paused: true, untilLabel: sameDay ? `até ${time}` : `até ${d.toLocaleDateString('pt-BR')} ${time}` };
}

function ConversationCard({ c, featured }: { c: Conversation; featured?: boolean }) {
  const last = c.messages[0];
  const age = relativeMinutes(c.lastMessageAt);
  const sla = slaStyle(age.minutes);
  const profile = getProfile(c.patient);
  const handoff = c.handoffs?.[0];
  const pause = aiPauseInfo(c.aiPausedUntil);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-premium ${
        featured ? 'border-brand/20 ring-1 ring-brand/10' : 'border-slate-200'
      }`}
    >
      {featured && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
      )}
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-semibold ${avatarColor(
            c.patient.id,
          )}`}
        >
          {initials(c.patient.name, c.patient.phone)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-slate-900">
                  {c.patient.name ?? 'Sem nome'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${sla.chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${sla.dot}`} />
                  {age.label} · {sla.label}
                </span>
                {pause.paused && (
                  <span
                    title="IA pausada porque um humano respondeu pelo WhatsApp"
                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200"
                  >
                    <Pause className="h-2.5 w-2.5" />
                    IA pausada {pause.untilLabel}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {formatPhone(c.patient.phone)}
                {profile && <span className="ml-2 text-slate-400">· {profile}</span>}
              </div>
            </div>
            <Link
              href={`/conversation/${c.id}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-card transition hover:bg-brand-deep"
            >
              Assumir
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          {handoff?.summary && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-900">{handoff.summary}</p>
            </div>
          )}

          {last && (
            <div className="mt-3 flex items-start gap-2">
              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100">
                {last.role === 'assistant' ? (
                  <Bot className="h-3 w-3 text-brand" />
                ) : (
                  <MessageSquare className="h-3 w-3 text-slate-500" />
                )}
              </div>
              <p className="line-clamp-2 text-sm text-slate-600">{last.content}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignedCard({ c }: { c: Conversation }) {
  const age = relativeMinutes(c.lastMessageAt);
  const last = c.messages[0];
  const pause = aiPauseInfo(c.aiPausedUntil);
  return (
    <Link
      href={`/conversation/${c.id}`}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand/30 hover:shadow-card"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${avatarColor(
          c.patient.id,
        )}`}
      >
        {initials(c.patient.name, c.patient.phone)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium text-slate-900">
            {c.patient.name ?? formatPhone(c.patient.phone)}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {pause.paused && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200">
                <Pause className="h-2.5 w-2.5" />
                IA off
              </span>
            )}
            <div className="text-[11px] text-slate-400">{age.label}</div>
          </div>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="truncate">
            {c.assignedTo?.name ?? 'Atendente'} · {last?.content?.slice(0, 50) ?? 'Sem mensagens'}
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
        <CheckCircle2 className="h-7 w-7 text-brand" strokeWidth={1.8} />
      </div>
      <div className="mt-4 font-display text-lg font-semibold text-slate-900">
        Ninguém aguardando
      </div>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        A IA está cuidando das conversas ativas. Quando um paciente pedir agendamento, ele aparece
        aqui em tempo real.
      </p>
    </div>
  );
}

export default async function QueuePage() {
  const [awaiting, assigned, overview] = await Promise.all([
    apiGet<Conversation[]>('/conversations?status=awaiting_handoff'),
    apiGet<Conversation[]>('/conversations?status=assigned'),
    apiGet<MetricsOverview>('/metrics/overview'),
  ]);

  const awaitingList = awaiting ?? [];
  const assignedList = assigned ?? [];
  const stats = overview ?? {
    active: 0,
    awaitingHandoff: 0,
    assignedActive: 0,
    closedToday: 0,
    messagesToday: 0,
  };

  const avgWait =
    awaitingList.length > 0
      ? Math.round(
          awaitingList
            .map((c) => relativeMinutes(c.lastMessageAt).minutes)
            .reduce((a, b) => a + b, 0) / awaitingList.length,
        )
      : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <QueueRealtime />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            Tempo real
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Fila de atendimento</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pacientes encaminhados pela IA e conversas ativas com atendentes.
          </p>
        </div>
        <Link
          href="/metrics"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand/30 hover:text-brand-deep"
        >
          Ver métricas
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Inbox}
          label="Aguardando"
          value={awaitingList.length}
          hint={avgWait > 0 ? `espera média ${avgWait}min` : 'nenhum na fila'}
          tone="brand"
        />
        <KpiCard
          icon={Users}
          label="Em atendimento"
          value={assignedList.length}
          hint="humano respondendo"
          tone="accent"
        />
        <KpiCard
          icon={Bot}
          label="IA conversando"
          value={stats.active}
          hint="sessões ativas agora"
          tone="slate"
        />
        <KpiCard
          icon={MessageSquare}
          label="Mensagens hoje"
          value={stats.messagesToday}
          hint={`${stats.closedToday} conversas encerradas`}
          tone="slate"
        />
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            <Inbox className="h-4 w-4" />
            Aguardando atendimento
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {awaitingList.length}
            </span>
          </h2>
          {awaitingList.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Ordenado por espera
            </span>
          )}
        </div>
        {awaitingList.length === 0 ? (
          <EmptyQueue />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {awaitingList.map((c, i) => (
              <ConversationCard key={c.id} c={c} featured={i === 0} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            <Users className="h-4 w-4" />
            Em atendimento humano
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {assignedList.length}
            </span>
          </h2>
        </div>
        {assignedList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma conversa em atendimento no momento.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {assignedList.map((c) => (
              <AssignedCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
