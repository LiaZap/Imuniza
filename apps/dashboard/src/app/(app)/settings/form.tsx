'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Building2,
  Check,
  Clock,
  MessageCircle,
  Moon,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import type { TenantSettings } from '@/lib/types';

export function SettingsForm({ initial }: { initial: TenantSettings }) {
  const [persona, setPersona] = useState(initial.config.persona ?? '');
  const [greeting, setGreeting] = useState(initial.config.greeting ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [hoursStart, setHoursStart] = useState(initial.config.businessHours?.start ?? '08:00');
  const [hoursEnd, setHoursEnd] = useState(initial.config.businessHours?.end ?? '18:00');
  const [timezone, setTimezone] = useState(
    initial.config.businessHours?.timezone ?? 'America/Sao_Paulo',
  );
  const [silentEnabled, setSilentEnabled] = useState(
    initial.config.silentHours?.enabled ?? false,
  );
  const [silentStart, setSilentStart] = useState(initial.config.silentHours?.start ?? '22:00');
  const [silentEnd, setSilentEnd] = useState(initial.config.silentHours?.end ?? '07:00');
  const [templates, setTemplates] = useState(initial.config.quickTemplates ?? []);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          persona,
          greeting,
          phone: phone || undefined,
          businessHours: { start: hoursStart, end: hoursEnd, timezone },
          silentHours: { enabled: silentEnabled, start: silentStart, end: silentEnd },
          quickTemplates: templates.filter((t) => t.label.trim() && t.text.trim()),
        }),
      });
      setStatus({ kind: 'ok', msg: 'Configurações salvas.' });
    } catch (err) {
      setStatus({ kind: 'error', msg: `Erro: ${(err as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section
        icon={Building2}
        title="Identidade da clínica"
        description="Nome e contato exibidos nos atendimentos."
      >
        <Field label="Nome da clínica">
          <input value={initial.name} disabled className="input bg-slate-50 text-slate-500" />
        </Field>
        <Field label="Telefone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            className="input"
          />
        </Field>
      </Section>

      <Section
        icon={Sparkles}
        title="Persona da IA"
        description="Tom de voz e instruções gerais. Mudanças afetam a próxima resposta."
      >
        <Field label="Instruções de persona">
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={5}
            required
            className="input"
            placeholder="Ex.: Seja acolhedora, clara e breve. Use tom próximo, evite termos técnicos."
          />
        </Field>
      </Section>

      <Section
        icon={MessageCircle}
        title="Saudação do primeiro contato"
        description="Primeira mensagem enviada quando um paciente inicia a conversa."
      >
        <Field label="Mensagem de saudação">
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={3}
            className="input"
            placeholder="Olá! Sou a assistente virtual da clínica..."
          />
        </Field>
      </Section>

      <Section
        icon={Clock}
        title="Horário de atendimento"
        description="A IA menciona esses horários quando relevante."
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Abertura">
            <input
              type="time"
              value={hoursStart}
              onChange={(e) => setHoursStart(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Fechamento">
            <input
              type="time"
              value={hoursEnd}
              onChange={(e) => setHoursEnd(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Timezone">
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={Moon}
        title="Horário de silêncio (lembretes)"
        description="Lembretes automáticos não serão enviados nesse intervalo — ficam agendados para depois."
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={silentEnabled}
            onChange={(e) => setSilentEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span className="text-slate-700">Ativar horário de silêncio</span>
        </label>
        {silentEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <input
                type="time"
                value={silentStart}
                onChange={(e) => setSilentStart(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Fim">
              <input
                type="time"
                value={silentEnd}
                onChange={(e) => setSilentEnd(e.target.value)}
                className="input"
              />
            </Field>
          </div>
        )}
      </Section>

      <Section
        icon={Zap}
        title="Respostas rápidas do atendente"
        description="Atalhos com textos pré-definidos que aparecem no chat. Ótimos para respostas recorrentes."
      >
        <div className="space-y-2">
          {templates.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                value={t.label}
                onChange={(e) => {
                  const next = [...templates];
                  next[i] = { ...next[i]!, label: e.target.value };
                  setTemplates(next);
                }}
                placeholder="Rótulo"
                className="input w-40"
              />
              <textarea
                value={t.text}
                onChange={(e) => {
                  const next = [...templates];
                  next[i] = { ...next[i]!, text: e.target.value };
                  setTemplates(next);
                }}
                placeholder="Texto da resposta rápida"
                rows={2}
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => setTemplates(templates.filter((_, j) => j !== i))}
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTemplates([...templates, { label: '', text: '' }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-brand/30 hover:text-brand"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar resposta rápida
          </button>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-8 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/80 px-8 py-4 backdrop-blur">
        {status ? (
          <p className={`text-sm ${status.kind === 'ok' ? 'text-brand-deep' : 'text-red-600'}`}>
            {status.msg}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            As mudanças valem imediatamente para novas conversas da IA.
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-deep disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
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
    </form>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
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
