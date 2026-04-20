import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-slate-600">
          O endereço que você tentou acessar não existe.
        </p>
        <Link
          href="/queue"
          className="mt-6 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          Voltar à fila
        </Link>
      </div>
    </main>
  );
}
