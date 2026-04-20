import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  LineChart,
  ListTodo,
  Megaphone,
  Settings,
  Syringe,
  Users,
  UserRound,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { LogoutButton } from './logout-button';
import { NotificationsListener } from './notifications-listener';

const navItems = [
  { href: '/queue', label: 'Fila', icon: ListTodo },
  { href: '/patients', label: 'Pacientes', icon: UserRound },
  { href: '/metrics', label: 'Métricas', icon: LineChart },
  { href: '/campaigns', label: 'Campanhas', icon: Megaphone, adminOnly: true },
  { href: '/vaccines', label: 'Vacinas', icon: Syringe },
  { href: '/kb', label: 'Base de conhecimento', icon: BookOpen },
  { href: '/users', label: 'Usuários', icon: Users, adminOnly: true },
  { href: '/settings', label: 'Configurações', icon: Settings, adminOnly: true },
] satisfies Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}>;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <NotificationsListener />
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="relative overflow-hidden bg-brand-gradient px-4 py-3">
          <div className="pointer-events-none absolute inset-0 bg-brand-radial" />
          <div className="relative flex h-20 items-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Clínica Imuniza"
              className="h-48 w-auto max-w-none object-contain"
            />
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems
            .filter((i) => !i.adminOnly || user.role === 'admin')
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-brand-soft hover:text-brand-deep"
              >
                <item.icon className="h-4 w-4 text-slate-400 transition group-hover:text-brand" />
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-deep">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              {user.role === 'admin' ? 'Administrador' : 'Atendente'}
            </span>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
