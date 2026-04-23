import type { FastifyBaseLogger } from 'fastify';
import { uazapi } from '../services/uazapi.js';
import { eventBus } from '../events/bus.js';
import { getDefaultTenantId } from '../services/tenant.js';
import type { InstanceConnectionState } from '@imuniza/uazapi';

/**
 * Polling simples do status da instancia Uazapi. Quando a conexao cai
 * (bateria do celular da clinica, logout, erro de pairing), emite evento
 * SSE para o dashboard e loga warn. Resolve automaticamente ao voltar.
 */

const POLL_INTERVAL_MS = 60_000; // 1 min

export function startInstanceMonitor(logger: FastifyBaseLogger) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  let lastState: InstanceConnectionState | null = null;
  let lastLoggedAlertAt = 0;

  async function tick() {
    try {
      const status = await uazapi.getInstanceStatus();
      const state = status.state;

      // Transicao: toda mudanca de estado gera evento + log
      if (state !== lastState) {
        const tenantId = await getDefaultTenantId().catch(() => '');
        eventBus.emitDomain({
          type: 'instance.state_changed',
          tenantId,
          state,
          phone: status.phone,
          profileName: status.profileName,
        });

        if (state === 'connected') {
          logger.info(
            { state, phone: status.phone },
            'instance_monitor: conexao Uazapi restaurada',
          );
        } else if (state === 'disconnected' || state === 'unknown') {
          logger.warn(
            { state, phone: status.phone },
            'instance_monitor: WhatsApp desconectado — IA nao conseguira responder',
          );
          lastLoggedAlertAt = Date.now();
        } else {
          logger.info({ state }, 'instance_monitor: estado mudou');
        }
        lastState = state;
      } else if (
        (state === 'disconnected' || state === 'unknown') &&
        Date.now() - lastLoggedAlertAt > 15 * 60 * 1000
      ) {
        // Re-alerta a cada 15 min enquanto permanecer desconectado
        logger.warn({ state }, 'instance_monitor: Uazapi segue desconectada ha mais de 15min');
        lastLoggedAlertAt = Date.now();
      }
    } catch (err) {
      if (lastState !== 'unknown') {
        logger.error({ err }, 'instance_monitor: falha ao consultar status');
        lastState = 'unknown';
        try {
          const tenantId = await getDefaultTenantId();
          eventBus.emitDomain({
            type: 'instance.state_changed',
            tenantId,
            state: 'unknown',
          });
        } catch {
          /* ignore */
        }
      }
    } finally {
      if (!stopped) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  }

  timer = setTimeout(tick, 10_000);
  logger.info(`instance_monitor started (poll ${POLL_INTERVAL_MS / 1000}s)`);

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
