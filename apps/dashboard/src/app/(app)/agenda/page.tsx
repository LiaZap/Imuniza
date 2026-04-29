import { CalendarDays } from 'lucide-react';
import { apiGet } from '@/lib/api-server';
import type { Appointment, Vaccine } from '@/lib/types';
import { CalendarView } from './calendar';

export default async function AgendaPage() {
  const [appointments, vaccines] = await Promise.all([
    apiGet<Appointment[]>('/appointments'),
    apiGet<Vaccine[]>('/vaccines'),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <CalendarDays className="h-3.5 w-3.5" />
          Agenda
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
          Calendário de agendamentos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Visualize, navegue por meses e acompanhe os agendamentos da clínica em um só lugar.
        </p>
      </header>

      <CalendarView appointments={appointments ?? []} vaccines={vaccines ?? []} />
    </div>
  );
}
