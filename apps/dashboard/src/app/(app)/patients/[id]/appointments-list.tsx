'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  CheckCircle2,
  DollarSign,
  RotateCcw,
  UserX,
  X,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Appointment, AppointmentStatus } from '@/lib/types';

const statusMap: Record<AppointmentStatus, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  attended: { label: 'Compareceu', cls: 'bg-brand-soft text-brand-deep ring-brand/20' },
  paid: { label: 'Pago', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  no_show: { label: 'Faltou', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AppointmentsList({ initial }: { initial: Appointment[] }) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payValue, setPayValue] = useState('');

  async function patchStatus(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    try {
      const updated = await api<Appointment>(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
      router.refresh();
    } catch (err) {
      alert(`Falha ao atualizar: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover este agendamento?')) return;
    setBusy(id);
    try {
      await api(`/appointments/${id}`, { method: 'DELETE' });
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function confirmPayment(id: string, expected: number | null) {
    const value = Number(payValue);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Informe um valor válido.');
      return;
    }
    await patchStatus(id, { status: 'paid', paidValue: value });
    setPayingId(null);
    setPayValue('');
  }

  if (appointments.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum agendamento registrado. O atendente marca no chat da conversa.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {appointments.map((a) => {
        const status = statusMap[a.status];
        const isPaying = payingId === a.id;
        const loading = busy === a.id;

        return (
          <div
            key={a.id}
            className="rounded-xl border border-slate-100 bg-white p-3 transition hover:border-slate-200"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-brand" />
                  <span className="text-sm font-semibold text-slate-900">
                    {new Date(a.scheduledFor).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${status.cls}`}
                  >
                    {status.label}
                  </span>
                </div>
                {a.vaccineSlugs.length > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    Vacinas: {a.vaccineSlugs.join(', ')}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                  {a.expectedValue != null && (
                    <span>
                      Previsto:{' '}
                      <strong className="text-slate-700">{formatBRL(a.expectedValue)}</strong>
                    </span>
                  )}
                  {a.paidValue != null && (
                    <span>
                      Pago:{' '}
                      <strong className="text-emerald-700">{formatBRL(a.paidValue)}</strong>
                    </span>
                  )}
                </div>
                {a.notes && <div className="mt-1 text-xs text-slate-500">{a.notes}</div>}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {a.status === 'scheduled' && (
                  <>
                    <button
                      disabled={loading}
                      onClick={() => patchStatus(a.id, { status: 'attended' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-deep hover:bg-brand/10 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Compareceu
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => patchStatus(a.id, { status: 'no_show' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <UserX className="h-3.5 w-3.5" /> Faltou
                    </button>
                  </>
                )}
                {(a.status === 'scheduled' || a.status === 'attended') && (
                  <>
                    {!isPaying ? (
                      <button
                        disabled={loading}
                        onClick={() => {
                          setPayingId(a.id);
                          setPayValue(String(a.expectedValue ?? ''));
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <DollarSign className="h-3.5 w-3.5" /> Marcar como pago
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white p-1">
                        <span className="pl-2 text-xs font-semibold text-slate-500">R$</span>
                        <input
                          value={payValue}
                          onChange={(e) => setPayValue(e.target.value)}
                          type="number"
                          step="0.01"
                          min={0}
                          autoFocus
                          className="w-24 bg-transparent text-xs focus:outline-none"
                        />
                        <button
                          onClick={() => confirmPayment(a.id, a.expectedValue)}
                          disabled={loading}
                          className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => {
                            setPayingId(null);
                            setPayValue('');
                          }}
                          className="flex h-5 w-5 items-center justify-center text-slate-400 hover:text-slate-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
                {a.status !== 'scheduled' && (
                  <button
                    disabled={loading}
                    onClick={() => patchStatus(a.id, { status: 'scheduled', paidValue: null })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    title="Voltar para Agendado"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                  </button>
                )}
                {a.status === 'scheduled' && (
                  <button
                    disabled={loading}
                    onClick={() => patchStatus(a.id, { status: 'cancelled' })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  disabled={loading}
                  onClick={() => remove(a.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
