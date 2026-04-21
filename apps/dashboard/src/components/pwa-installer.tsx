'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

// Evento do Chrome/Edge/Samsung Internet
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'imuniza_pwa_dismissed_at';
const DISMISS_TTL_DAYS = 7;

export function PwaInstaller() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Registra o SW (tolera falhas)
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('SW registration failed', err));
  }, []);

  useEffect(() => {
    // Detecta já instalado (standalone)
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // Se já foi dispensado recentemente, não mostra
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissed && Date.now() - dismissed < DISMISS_TTL_DAYS * 86400000) {
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari não dispara beforeinstallprompt — detecta por UA
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    if (iOS) setIsIos(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome !== 'accepted') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setPromptEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setPromptEvent(null);
    setIosHintOpen(false);
    setDismissed(true);
  }

  if (installed || dismissed) return null;
  if (!promptEvent && !isIos) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center lg:bottom-6 lg:left-auto lg:right-6 lg:justify-end">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-brand/20 bg-white p-3 shadow-premium ring-1 ring-black/5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Instalar Imuniza</div>
          <div className="text-xs text-slate-500">
            {isIos
              ? 'Toque em Compartilhar → "Adicionar à Tela de Início".'
              : 'Acesse o dashboard mais rápido direto do seu celular.'}
          </div>
        </div>
        {promptEvent && !isIos && (
          <button
            onClick={install}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-brand-deep"
          >
            Instalar
          </button>
        )}
        {isIos && !iosHintOpen && (
          <button
            onClick={() => setIosHintOpen(true)}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-brand-deep"
          >
            Como
          </button>
        )}
        <button
          onClick={dismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dispensar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
