'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Vaccine } from '@/lib/types';

export function VaccinationForm({
  patientId,
  vaccines,
}: {
  patientId: string;
  vaccines: Vaccine[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(vaccines[0]?.slug ?? '');
  const [dose, setDose] = useState('1');
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/patients/${patientId}/vaccinations`, {
        method: 'POST',
        body: JSON.stringify({
          vaccineSlug: slug,
          dose: Number(dose),
          appliedAt: new Date(appliedAt + 'T12:00:00').toISOString(),
          notes: notes || undefined,
        }),
      });
      setOpen(false);
      setNotes('');
      setDose('1');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-deep"
      >
        <Plus className="h-4 w-4" />
        Registrar dose aplicada
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-brand/20 bg-brand-soft/30 p-4"
    >
      <h3 className="mb-3 text-sm font-semibold text-brand-deep">Registrar dose aplicada</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">
          <span className="mb-1 block font-semibold uppercase tracking-wider text-slate-600">
            Vacina
          </span>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
          >
            {vaccines.map((v) => (
              <option key={v.id} value={v.slug}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold uppercase tracking-wider text-slate-600">
            Dose número
          </span>
          <input
            type="number"
            min={1}
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
          />
        </label>
        <label className="col-span-2 text-xs">
          <span className="mb-1 block font-semibold uppercase tracking-wider text-slate-600">
            Data da aplicação
          </span>
          <input
            type="date"
            value={appliedAt}
            onChange={(e) => setAppliedAt(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
          />
        </label>
        <label className="col-span-2 text-xs">
          <span className="mb-1 block font-semibold uppercase tracking-wider text-slate-600">
            Notas (opcional)
          </span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lote, reações, observações..."
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Registrar'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-white"
        >
          Cancelar
        </button>
        <p className="ml-auto text-[11px] text-slate-500">
          Próxima dose é agendada automaticamente.
        </p>
      </div>
    </form>
  );
}
