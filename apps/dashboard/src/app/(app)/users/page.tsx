import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';
import { apiGet } from '@/lib/api-server';
import { requireUser } from '@/lib/auth';
import type { UserRecord } from '@/lib/types';
import { UsersManager } from './manager';

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== 'admin') notFound();
  const users = (await apiGet<UserRecord[]>('/users')) ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <Users className="h-3.5 w-3.5" />
          Time &amp; permissões
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Usuários</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Admins configuram o sistema; atendentes veem fila, chat e métricas.
        </p>
      </header>

      <UsersManager initial={users} currentUserId={user.id} />
    </div>
  );
}
