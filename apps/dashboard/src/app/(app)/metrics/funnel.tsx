import { TrendingUp, ArrowDown } from 'lucide-react';
import type { FunnelData } from '@/lib/types';

export function FunnelSection({ data }: { data: FunnelData }) {
  if (!data) return null;
  const max = Math.max(1, ...data.steps.map((s) => s.value));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
            <TrendingUp className="h-4 w-4 text-brand" />
            Funil de conversão
          </h2>
          <p className="text-xs text-slate-500">
            Últimos {data.days} dias — do primeiro contato até o atendimento.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Conversão</div>
          <div className="font-display text-3xl font-extrabold text-brand-deep">
            {data.conversion}%
          </div>
          <div className="text-[11px] text-slate-500">contato → agendamento concretizado</div>
        </div>
      </div>

      <div className="space-y-3">
        {data.steps.map((step, i) => {
          const pct = Math.round((step.value / max) * 100);
          const prev = data.steps[i - 1];
          const dropPct =
            prev && prev.value > 0
              ? Math.round(((prev.value - step.value) / prev.value) * 100)
              : null;
          const toColor = [
            'from-brand/90 to-brand',
            'from-brand to-brand-deep',
            'from-accent to-accent-foreground/70',
            'from-violet-500 to-violet-700',
            'from-emerald-500 to-emerald-700',
          ][i] ?? 'from-slate-500 to-slate-700';

          return (
            <div key={step.key}>
              {i > 0 && dropPct !== null && (
                <div className="my-2 flex items-center gap-2 pl-4 text-[11px] text-slate-400">
                  <ArrowDown className="h-3 w-3" />
                  {dropPct > 0 ? `−${dropPct}%` : 'Estável'} em relação à etapa anterior
                </div>
              )}
              <div className="group">
                <div className="mb-1 flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-slate-700">{step.label}</div>
                  <div>
                    <span className="font-display text-lg font-bold text-slate-900">
                      {step.value}
                    </span>
                    {i === 0 && step.value > 0 && (
                      <span className="ml-2 text-[11px] text-slate-500">= 100%</span>
                    )}
                    {i > 0 && data.steps[0] && data.steps[0].value > 0 && (
                      <span className="ml-2 text-[11px] text-slate-500">
                        {Math.round((step.value / data.steps[0].value) * 100)}% do topo
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-9 overflow-hidden rounded-xl bg-slate-100">
                  <div
                    className={`flex h-full items-center justify-end bg-gradient-to-r ${toColor} px-3 text-xs font-semibold text-white transition-all`}
                    style={{ width: `${Math.max(pct, 6)}%` }}
                  >
                    {step.value > 0 && <span>{step.value}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[11px] text-slate-400">
        Agendamentos são registrados pelo atendente a partir do chat. Comparecimentos atualizam a etapa final do funil.
      </p>
    </section>
  );
}
