'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  CheckCircle2,
  Loader2,
  Megaphone,
  Play,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Campaign, CampaignAudience } from '@/lib/types';

const audienceLabels: Record<CampaignAudience, string> = {
  all: 'Todos os pacientes',
  baby_below_12m: 'Bebês até 12 meses',
  missing_next_dose: 'Próxima dose em 14 dias',
  custom: 'Lista customizada',
};

const statusMap = {
  draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  scheduled: { label: 'Agendada', cls: 'bg-violet-50 text-violet-700' },
  running: { label: 'Enviando...', cls: 'bg-amber-50 text-amber-700 animate-pulse' },
  completed: { label: 'Concluída', cls: 'bg-brand-soft text-brand-deep' },
  failed: { label: 'Falhou', cls: 'bg-rose-50 text-rose-700' },
} as const;

export function CampaignsManager({ initial }: { initial: Campaign[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initial);
  const [form, setForm] = useState({
    name: '',
    message: '',
    audience: 'all' as CampaignAudience,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ total: number; sample: Array<{ phone: string; name: string | null }> } | null>(
    null,
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api<Campaign>('/campaigns', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setCampaigns((prev) => [created, ...prev]);
      setPanelOpen(false);
      setForm({ name: '', message: '', audience: 'all' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onSend(id: string) {
    const pre = await api<{ total: number; sample: Array<{ phone: string; name: string | null }> }>(
      `/campaigns/${id}/preview`,
      { method: 'POST' },
    ).catch(() => null);

    if (!pre || pre.total === 0) {
      if (!confirm('Nenhum paciente no público selecionado. Enviar mesmo assim?')) return;
    } else if (
      !confirm(
        `Confirmar envio para ${pre.total} paciente${pre.total !== 1 ? 's' : ''}? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    await api(`/campaigns/${id}/send`, { method: 'POST' });
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm('Remover esta campanha?')) return;
    await api(`/campaigns/${id}`, { method: 'DELETE' });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  async function onPreview(audience: CampaignAudience) {
    const dummy = await api<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: '__preview__',
        message: 'preview',
        audience,
      }),
    });
    const pre = await api<{ total: number; sample: Array<{ phone: string; name: string | null }> }>(
      `/campaigns/${dummy.id}/preview`,
      { method: 'POST' },
    );
    await api(`/campaigns/${dummy.id}`, { method: 'DELETE' });
    setPreview(pre);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <Megaphone className="h-4 w-4" />
          Campanhas
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {campaigns.length}
          </span>
        </h2>
        <button
          onClick={() => {
            setPanelOpen(true);
            setPreview(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-deep"
        >
          <Plus className="h-4 w-4" />
          Nova campanha
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
            <Megaphone className="h-7 w-7 text-brand" strokeWidth={1.8} />
          </div>
          <div className="mt-4 font-display text-lg font-semibold text-slate-900">
            Nenhuma campanha criada
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Crie sua primeira campanha para avisar pacientes sobre novas vacinas, promoções sazonais etc.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const status = statusMap[c.status];
            const progress =
              c.totalTargets > 0
                ? Math.round(((c.sentCount + c.failedCount) / c.totalTargets) * 100)
                : 0;
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-base font-bold text-slate-900">
                      {c.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {audienceLabels[c.audience]}
                      </span>
                      <span>· {new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  {c.message}
                </p>

                {c.status === 'running' || c.status === 'completed' || c.status === 'failed' ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {c.sentCount} / {c.totalTargets} enviadas
                        {c.failedCount > 0 && ` · ${c.failedCount} falhas`}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2">
                  {(c.status === 'draft' || c.status === 'failed') && (
                    <button
                      onClick={() => onSend(c.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Enviar agora
                    </button>
                  )}
                  {c.status === 'running' && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Em andamento
                    </span>
                  )}
                  {c.status === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-brand-deep">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Finalizada
                    </span>
                  )}
                  {c.status !== 'running' && (
                    <button
                      onClick={() => onDelete(c.id)}
                      className="ml-auto text-xs text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
          onClick={() => setPanelOpen(false)}
          role="presentation"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 flex h-screen w-full max-w-xl flex-col overflow-y-auto bg-white shadow-premium"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">Nova campanha</h3>
                <p className="text-xs text-slate-500">
                  Mensagens são enviadas com delay de ~800ms entre cada paciente para não saturar a API.
                </p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onCreate} className="flex-1 space-y-4 px-6 py-5">
              <Field label="Nome interno">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="input"
                  placeholder="Ex.: Chegada Influenza 2026"
                />
              </Field>
              <Field label="Público">
                <select
                  value={form.audience}
                  onChange={async (e) => {
                    const value = e.target.value as CampaignAudience;
                    setForm({ ...form, audience: value });
                    onPreview(value).catch(() => undefined);
                  }}
                  className="input"
                >
                  {(Object.entries(audienceLabels) as Array<[CampaignAudience, string]>).map(
                    ([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
                {preview && (
                  <p className="mt-2 text-xs text-slate-500">
                    <strong className="text-slate-700">{preview.total}</strong> paciente(s) no público.
                    {preview.sample.length > 0 && (
                      <>
                        {' '}
                        Exemplos: {preview.sample.map((s) => s.name ?? s.phone).join(', ')}
                      </>
                    )}
                  </p>
                )}
              </Field>
              <Field label="Mensagem (use {{nome}} para personalizar)">
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  rows={8}
                  className="input"
                  placeholder="Oi {{nome}}! A vacina da gripe 2026 chegou na clínica. Posso te ajudar a agendar? 💙"
                />
              </Field>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={onCreate}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-deep disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {saving ? 'Criando...' : 'Criar rascunho'}
              </button>
            </div>
          </aside>
        </div>
      )}

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
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
