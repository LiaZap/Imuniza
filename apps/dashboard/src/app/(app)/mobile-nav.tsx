'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { Menu, X } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export function MobileNav({
  items,
  userName,
  userEmail,
  userRole,
  logoutSlot,
}: {
  items: NavItem[];
  userName: string;
  userEmail: string;
  userRole: 'admin' | 'attendant';
  logoutSlot: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer ao navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trava scroll do body quando o drawer está aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  return (
    <>
      {/* Top bar fixa apenas no mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Imuniza" className="h-8 w-auto object-contain" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-deep">
          {userName.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          role="presentation"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] transform flex-col bg-white shadow-premium transition-transform duration-200 lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative overflow-hidden bg-brand-gradient px-4 py-4">
          <div className="pointer-events-none absolute inset-0 bg-brand-radial" />
          <div className="relative flex items-center justify-between">
            <div className="relative flex h-16 items-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Clínica Imuniza"
                className="h-40 w-auto max-w-none object-contain"
              />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-soft text-brand-deep'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon
                  className={`h-5 w-5 ${active ? 'text-brand' : 'text-slate-400 group-hover:text-brand'}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-deep">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{userName}</div>
              <div className="truncate text-xs text-slate-500">{userEmail}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              {userRole === 'admin' ? 'Administrador' : 'Atendente'}
            </span>
            {logoutSlot}
          </div>
        </div>
      </aside>
    </>
  );
}
