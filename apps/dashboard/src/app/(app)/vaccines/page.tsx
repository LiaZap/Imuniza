import { Package, Syringe } from 'lucide-react';
import { apiGet } from '@/lib/api-server';
import type { Vaccine, VaccinePackage } from '@/lib/types';
import { VaccinesManager } from './manager';

export default async function VaccinesPage() {
  const [vaccines, packages] = await Promise.all([
    apiGet<Vaccine[]>('/vaccines'),
    apiGet<VaccinePackage[]>('/vaccines/packages'),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <Syringe className="h-3.5 w-3.5" />
            Catálogo clínico
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Vacinas &amp; pacotes</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Preços, idades e descrições que a IA consulta em toda resposta — nada é inventado, tudo
            vem daqui.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
          <Package className="h-4 w-4 text-brand" />
          <span className="text-slate-600">
            <strong className="text-slate-900">{vaccines?.length ?? 0}</strong> vacinas ·{' '}
            <strong className="text-slate-900">{packages?.length ?? 0}</strong> pacotes
          </span>
        </div>
      </header>

      <VaccinesManager initial={vaccines ?? []} packages={packages ?? []} />
    </div>
  );
}
