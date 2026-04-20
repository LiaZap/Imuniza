'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  BookOpen,
  Check,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import type { KBDocument, KBDocumentSummary } from '@/lib/types';

const emptyForm = { id: '', title: '', content: '', source: 'manual', active: true };

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return d.toLocaleDateString('pt-BR');
}

export function KBManager({ initial }: { initial: KBDocumentSummary[] }) {
  const [docs, setDocs] = useState(initial);
  const [form, setForm] = useState(emptyForm);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  function startNew() {
    setForm(emptyForm);
    setStatus(null);
    setPanelOpen(true);
  }

  async function startEdit(id: string) {
    const doc = await api<KBDocument>(`/kb/documents/${id}`);
    setForm({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      source: doc.source,
      active: doc.active,
    });
    setStatus(null);
    setPanelOpen(true);
  }

  function close() {
    setPanelOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      if (form.id) {
        const updated = await api<KBDocument>(`/kb/documents/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: form.title, content: form.content, active: form.active }),
        });
        setDocs((prev) =>
          prev.map((d) =>
            d.id === updated.id
              ? {
                  ...d,
                  title: updated.title,
                  active: updated.active,
                  updatedAt: updated.updatedAt,
                }
              : d,
          ),
        );
      } else {
        const created = await api<KBDocument>('/kb/documents', {
          method: 'POST',
          body: JSON.stringify({
            title: form.title,
            content: form.content,
            source: form.source,
          }),
        });
        setDocs((prev) => [
          {
            id: created.id,
            title: created.title,
            source: created.source,
            active: created.active,
            updatedAt: created.updatedAt,
            createdAt: created.createdAt,
            _count: { chunks: 0 },
          },
          ...prev,
        ]);
      }
      setStatus({
        kind: 'ok',
        msg: 'Documento salvo. Use "Reindexar" para atualizar a busca semântica.',
      });
      close();
    } catch (err) {
      setStatus({ kind: 'error', msg: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Remover este documento e seus chunks?')) return;
    await api(`/kb/documents/${id}`, { method: 'DELETE' });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  async function onReindex(id: string) {
    setReindexing(id);
    setStatus(null);
    try {
      const res = await api<{ chunks: number }>(`/kb/documents/${id}/reindex`, { method: 'POST' });
      setStatus({ kind: 'ok', msg: `Reindexado: ${res.chunks} chunks gerados.` });
      setDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, _count: { chunks: res.chunks } } : d)),
      );
    } catch (err) {
      setStatus({
        kind: 'error',
        msg: `Falha ao reindexar (confira OPENAI_API_KEY): ${(err as Error).message}`,
      });
    } finally {
      setReindexing(null);
    }
  }

  return (
    <>
      {status && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            status.kind === 'ok'
              ? 'border-brand-soft bg-brand-soft/50 text-brand-deep'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {status.msg}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <BookOpen className="h-4 w-4" />
          Documentos
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {docs.length}
          </span>
        </h2>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand-deep"
        >
          <Plus className="h-4 w-4" />
          Novo documento
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
            <FileText className="h-7 w-7 text-brand" strokeWidth={1.8} />
          </div>
          <div className="mt-4 font-display text-lg font-semibold text-slate-900">
            Nenhum documento na base
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Adicione um texto ou importe um <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.docx</code>{' '}
            via CLI (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">pnpm ingest:docx</code>).
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => {
            const chunks = d._count?.chunks ?? 0;
            const indexed = chunks > 0;
            return (
              <div
                key={d.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-premium"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      indexed ? 'bg-brand-soft text-brand' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <FileText className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      d.active ? 'bg-brand-soft text-brand-deep' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {d.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <h3 className="mt-4 line-clamp-2 font-display text-base font-bold text-slate-900">
                  {d.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {d.source} · atualizado {relativeDate(d.updatedAt)}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                        indexed
                          ? 'bg-brand-soft text-brand-deep'
                          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                      }`}
                    >
                      {indexed ? `${chunks} chunks` : 'não indexado'}
                    </span>
                  </div>

                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(d.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-brand"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onReindex(d.id)}
                      disabled={reindexing === d.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 hover:text-emerald-800 disabled:opacity-60"
                      title="Reindexar"
                    >
                      {reindexing === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => onDelete(d.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-rose-600"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
          onClick={close}
          role="presentation"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 flex h-screen w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-premium"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {form.id ? 'Editar documento' : 'Novo documento'}
                </h3>
                <p className="text-xs text-slate-500">
                  Após salvar, rode <strong>Reindexar</strong> no card para atualizar embeddings.
                </p>
              </div>
              <button
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-6 py-5">
              <Field label="Título">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="input"
                />
              </Field>
              <Field label="Conteúdo (Markdown)">
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  required
                  rows={18}
                  className="input font-mono text-xs"
                />
              </Field>
              {!form.id && (
                <Field label="Origem (tag)">
                  <input
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="input"
                  />
                </Field>
              )}
              {form.id && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span className="text-slate-700">Ativo (usado pela IA)</span>
                </label>
              )}
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={close}
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
                <Check className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar'}
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
