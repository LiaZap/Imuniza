import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@imuniza/db';
import { uazapi } from '../services/uazapi.js';

const POLL_INTERVAL_MS = 60 * 1000; // 1 minuto

/**
 * Worker simples que verifica lembretes vencidos e dispara via Uazapi.
 * Para cada tenant respeita silentHours (se configurado) — adia para próxima janela.
 */
export function startReminderDispatcher(logger: FastifyBaseLogger): { stop: () => void } {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  async function tick() {
    if (stopped) return;
    try {
      const now = new Date();
      const due = await prisma.vaccinationReminder.findMany({
        where: { status: 'scheduled', scheduledFor: { lte: now } },
        include: {
          patient: { select: { phone: true } },
          tenant: { select: { config: true } },
        },
        take: 50,
      });

      for (const reminder of due) {
        const config = (reminder.tenant.config as {
          silentHours?: { enabled?: boolean; start?: string; end?: string };
        }) ?? {};
        const silent = config.silentHours;
        if (silent?.enabled && silent.start && silent.end) {
          const [startH] = silent.start.split(':').map(Number);
          const [endH] = silent.end.split(':').map(Number);
          const hour = new Date().getHours();
          const inSilent = startH! > endH!
            ? hour >= startH! || hour < endH!
            : hour >= startH! && hour < endH!;
          if (inSilent) {
            // adia para o próximo "endH" de hoje/amanhã
            const next = new Date();
            next.setHours(endH!, 0, 0, 0);
            if (next <= new Date()) next.setDate(next.getDate() + 1);
            await prisma.vaccinationReminder.update({
              where: { id: reminder.id },
              data: { scheduledFor: next },
            });
            continue;
          }
        }

        try {
          await uazapi.sendText({
            number: reminder.patient.phone,
            text: reminder.message,
          });
          await prisma.vaccinationReminder.update({
            where: { id: reminder.id },
            data: { status: 'sent', sentAt: new Date() },
          });
          logger.info({ reminderId: reminder.id }, 'reminder sent');
        } catch (err) {
          await prisma.vaccinationReminder.update({
            where: { id: reminder.id },
            data: { status: 'failed', errorMessage: (err as Error).message },
          });
          logger.error({ err, reminderId: reminder.id }, 'reminder dispatch failed');
        }
      }
    } catch (err) {
      logger.error({ err }, 'reminder dispatcher tick failed');
    } finally {
      if (!stopped) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  }

  timer = setTimeout(tick, 5000);
  logger.info('reminder dispatcher started (poll 60s)');

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
