'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Algo deu errado</h2>
          <p className="mt-2 text-sm text-slate-600">
            Tente novamente. Se o problema continuar, avise o administrador.
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
