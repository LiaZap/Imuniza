'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { Appointment, Vaccine } from '@/lib/types';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const STATUS_STYLE: Record<
  Appointment['status'],
  { dot: string; chip: string; label: string }
> = {
  scheduled: {
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 ring-blue-200',
    label: 'Agendado',
  },
  attended: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    label: 'Compareceu',
  },
  paid: {
    dot: 'bg-brand',
    chip: 'bg-brand-soft text-brand-deep ring-brand/30',
    label: 'Pago',
  },
  no_show: {
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200',
    label: 'Não compareceu',
  },
  cancelled: {
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    label: 'Cancelado',
  },
};

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Retorna 42 dias (6 semanas) começando na segunda da semana do dia 1 do mês. */
function calendarGrid(d: Date): Date[] {
  const first = startOfMonth(d);
  // getDay: 0=dom, 1=seg, ... 6=sáb. Nosso grid começa na segunda.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function vaccineNamesFromSlugs(slugs: string[], vaccines: Vaccine[]): string {
  const names = slugs
    .map((s) => vaccines.find((v) => v.slug === s)?.name ?? s)
    .filter(Boolean);
  if (names.length === 0) return 'Sem vacinas registradas';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

export function CalendarView({
  appointments,
  vaccines,
}: {
  appointments: Appointment[];
  vaccines: Vaccine[];
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthLabel = cursor.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const days = useMemo(() => calendarGrid(cursor), [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const d = new Date(a.scheduledFor);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    // ordena cada dia pelo horário
    for (const arr of map.values()) {
      arr.sort((x, y) => +new Date(x.scheduledFor) - +new Date(y.scheduledFor));
    }
    return map;
  }, [appointments]);

  function getDayAppointments(day: Date): Appointment[] {
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    return byDay.get(key) ?? [];
  }

  // KPIs do mês visível
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const monthAppointments = appointments.filter((a) => {
    const d = new Date(a.scheduledFor);
    return d >= monthStart && d <= monthEnd;
  });
  const totalScheduled = monthAppointments.length;
  const totalAttended = monthAppointments.filter(
    (a) => a.status === 'attended' || a.status === 'paid',
  ).length;
  const noShows = monthAppointments.filter((a) => a.status === 'no_show').length;
  const cancelled = monthAppointments.filter((a) => a.status === 'cancelled').length;
  const upcoming = monthAppointments.filter((a) => a.status === 'scheduled').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isCurrentMonth = (d: Date) => d.getMonth() === cursor.getMonth();

  return (
    <>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(cursor);
              d.setMonth(d.getMonth() - 1);
              setCursor(d);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-brand/30 hover:text-brand"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hoje
          </button>
          <button
            onClick={() => {
              const d = new Date(cursor);
              d.setMonth(d.getMonth() + 1);
              setCursor(d);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-brand/30 hover:text-brand"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-2 font-display text-lg font-bold capitalize text-slate-900">
            {monthLabel}
          </h2>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(STATUS_STYLE) as Appointment['status'][]).map((s) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_STYLE[s].chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLE[s].dot}`} />
              {STATUS_STYLE[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CalendarCheck} label="Agendamentos no mês" value={totalScheduled.toString()} tone="brand" />
        <KpiCard icon={Clock} label="Próximos / a confirmar" value={upcoming.toString()} tone="accent" />
        <KpiCard
          icon={CheckCircle2}
          label="Comparecimentos"
          value={totalScheduled > 0 ? `${totalAttended}/${totalScheduled}` : '0'}
          tone="slate"
          hint={
            totalScheduled > 0
              ? `${Math.round((totalAttended / totalScheduled) * 100)}% de presença`
              : undefined
          }
        />
        <KpiCard
          icon={CalendarX}
          label="No-show / cancelados"
          value={`${noShows + cancelled}`}
          tone="slate"
          hint={noShows + cancelled > 0 ? `${noShows} faltaram · ${cancelled} cancelados` : 'tudo certo'}
        />
      </div>

      {/* Grid de dias da semana */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {w}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {days.map((d) => {
          const list = getDayAppointments(d);
          const isToday = sameDay(d, today);
          const inMonth = isCurrentMonth(d);
          const visible = list.slice(0, 3);
          const overflow = list.length - visible.length;

          return (
            <button
              key={d.toISOString()}
              onClick={() => list.length > 0 && setSelectedDay(d)}
              className={`group relative min-h-[100px] rounded-xl border p-2 text-left transition ${
                inMonth ? 'border-slate-100 bg-white' : 'border-transparent bg-slate-50 text-slate-400'
              } ${list.length > 0 ? 'hover:border-brand/30 hover:shadow-card cursor-pointer' : 'cursor-default'} ${
                isToday ? 'ring-2 ring-brand/40' : ''
              }`}
              disabled={list.length === 0}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    isToday
                      ? 'flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white'
                      : inMonth
                        ? 'text-slate-700'
                        : 'text-slate-400'
                  }`}
                >
                  {d.getDate()}
                </span>
                {list.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {list.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {visible.map((a) => {
                  const time = new Date(a.scheduledFor).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const s = STATUS_STYLE[a.status];
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ${s.chip}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                      <span className="truncate">
                        {time} · {a.patient?.name ?? a.patient?.phone?.slice(-4) ?? '...'}
                      </span>
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div className="px-1 text-[10px] font-semibold text-slate-500">
                    +{overflow} mais
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal do dia */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelectedDay(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white shadow-premium sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Agendamentos
                </div>
                <h3 className="font-display text-lg font-bold capitalize text-slate-900">
                  {selectedDay.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                {getDayAppointments(selectedDay).map((a) => {
                  const time = new Date(a.scheduledFor).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const s = STATUS_STYLE[a.status];
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand/30 hover:shadow-card"
                    >
                      <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 px-3 py-2">
                        <Clock className="mb-1 h-3.5 w-3.5 text-slate-400" />
                        <span className="font-display text-sm font-bold text-slate-900">{time}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold text-slate-900">
                            {a.patient?.name ?? 'Paciente'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${s.chip}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          <Users className="h-3 w-3" />
                          {a.patient?.phone ?? '—'}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {vaccineNamesFromSlugs(a.vaccineSlugs, vaccines)}
                        </div>
                        {a.notes && (
                          <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">
                            “{a.notes}”
                          </p>
                        )}
                      </div>
                      {a.patient?.id && (
                        <Link
                          href={`/patients/${a.patient.id}`}
                          className="text-xs font-semibold text-brand hover:text-brand-deep"
                          onClick={(e) => e.stopPropagation()}
                        >
                          abrir →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'slate',
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: string;
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
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 shadow-card ring-1 ring-black/5 ${tones[tone]}`}
    >
      <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <div
            className={`font-display text-2xl font-extrabold leading-none ${
              isLight ? '' : 'text-slate-900'
            }`}
          >
            {value}
          </div>
          <div
            className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wider ${
              isLight ? 'text-white/80' : 'text-slate-600'
            }`}
          >
            {label}
          </div>
          {hint && (
            <div className={`mt-0.5 text-[10px] ${isLight ? 'text-white/70' : 'text-slate-500'}`}>
              {hint}
            </div>
          )}
        </div>
        <Icon className={`h-4 w-4 ${isLight ? 'text-white/70' : 'text-slate-500'}`} strokeWidth={1.8} />
      </div>
    </div>
  );
}

// (XCircle imported but used in legend variants if needed; keeping for future status)
void XCircle;
