'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-xs font-medium text-slate-600 underline decoration-dotted hover:text-slate-900"
    >
      Sair
    </button>
  );
}
