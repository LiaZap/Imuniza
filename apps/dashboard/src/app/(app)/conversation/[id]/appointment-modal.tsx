'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Vaccine } from '@/lib/types';

export function AppointmentModal({
  patientId,
  conversationId,
  vaccines,
  onClose,
}: {
  patientId: string;
  conversationId: string;
  vaccines: Vaccine[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [expectedValue, setExpectedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleVaccine(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  // Calcula soma automática dos preços selecionados
  const computedValue = selectedSlugs.reduce((sum, slug) => {
    const v = vaccines.find((x) => x.slug === slug);
    return sum + (v?.priceCash ?? 0);
  }, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          conversationId,
          scheduledFor: new Date(scheduledFor).toISOString(),
          vaccineSlugs: selectedSlugs,
          expectedValue: expectedValue ? Number(expectedValue) : computedValue || undefined,
          notes: notes || undefined,
        }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-screen w-full max-w-md flex-col overflow-y-auto bg-white shadow-premium"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              Registrar agendamento
            </h3>
            <p className="text-xs text-slate-500">
              Marcado no funil de conversão e aparece no prontuário do paciente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 space-y-4 px-6 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Data e hora
            </span>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              required
              className="input"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Vacinas a aplicar
            </span>
            <div className="flex flex-wrap gap-1.5">
              {vaccines.map((v) => {
                const selected = selectedSlugs.includes(v.slug);
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => toggleVaccine(v.slug)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selected
                        ? 'border-brand bg-brand text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30'
                    }`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Valor previsto (R$)
            </span>
            <input
              type="number"
              step="0.01"
              value={expectedValue}
              onChange={(e) => setExpectedValue(e.target.value)}
              placeholder={computedValue > 0 ? `${computedValue.toFixed(2)} (soma das vacinas)` : 'ex: 256.00'}
              className="input"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Notas
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Alguma observação sobre o agendamento..."
              className="input"
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-deep disabled:opacity-60"
          >
            <CalendarCheck className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Registrar agendamento'}
          </button>
        </div>

        <style jsx>{`
          .input {
            width: 100%;
            border-radius: 0.75rem;
            border: 1px solid rgb(226 232 240);
            background: white;
            padding: 0.6rem 0.8rem;
            font-size: 0.875rem;
            color: rgb(15 23 42);
            outline: none;
            transition: all 0.15s;
          }
          .input:focus {
            border-color: #1f7a66;
            box-shadow: 0 0 0 4px rgba(31, 122, 102, 0.12);
          }
        `}</style>
      </aside>
    </div>
  );
}
