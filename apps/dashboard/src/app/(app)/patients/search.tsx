'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

export function PatientsSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('search', q.trim());
    router.push(`/patients${params.toString() ? '?' + params.toString() : ''}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10"
    >
      <Search className="h-4 w-4 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou telefone..."
        className="w-64 bg-transparent text-sm focus:outline-none"
      />
    </form>
  );
}
