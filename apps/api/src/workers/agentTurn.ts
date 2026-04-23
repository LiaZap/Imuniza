import type { FastifyBaseLogger } from 'fastify';
import type { Job } from 'bullmq';
import { prisma } from '@imuniza/db';
import { registerAgentTurnWorker, type AgentTurnJob } from '../queue/queues.js';
import { runAgent } from '../services/agent.js';
import { uazapi } from '../services/uazapi.js';
import { addMessage } from '../services/conversation.js';
import {
  DEFAULT_OFFLINE_MESSAGE,
  isInSilentWindow,
  type SilentHoursConfig,
} from '../services/businessHours.js';

/**
 * Processa o "turno" da IA apos o debounce de mensagens do paciente.
 *
 * O webhook salva as mensagens picadas no banco; o agent_turn so dispara
 * quando ha MESSAGE_BUFFER_MS de silencio. Assim, quando runAgent carrega
 * o historico, ele ja enxerga todas as mensagens consolidadas.
 */
export function startAgentTurnWorker(logger: FastifyBaseLogger) {
  const worker = registerAgentTurnWorker(async (job: Job<AgentTurnJob>) => {
    const { tenantId, conversationId, patientId, patientPhone } = job.data;

    // Re-checa status: atendente pode ter assumido durante o buffer
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true, aiPausedUntil: true },
    });
    if (!conv) {
      logger.warn({ conversationId }, 'agent_turn: conversation not found');
      return;
    }
    if (conv.status === 'assigned' || conv.status === 'awaiting_handoff') {
      logger.info(
        { conversationId, status: conv.status },
        'agent_turn: conversation now human-handled, skipping',
      );
      return;
    }
    if (conv.aiPausedUntil && conv.aiPausedUntil.getTime() > Date.now()) {
      logger.info(
        { conversationId, until: conv.aiPausedUntil.toISOString() },
        'agent_turn: IA pausada (humano respondeu pelo numero da clinica), skipping',
      );
      return;
    }

    // Silent hours: em horario silencioso envia offlineMessage uma vez
    // por janela e nao aciona a LLM (evita custo + respostas fora do ar).
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { config: true },
    });
    const silent = (tenant?.config as { silentHours?: SilentHoursConfig } | null)?.silentHours;
    if (isInSilentWindow(silent)) {
      // Ja mandamos mensagem off nesta janela? Evita repetir em cada msg picada.
      const recentOffline = await prisma.message.findFirst({
        where: {
          conversationId,
          role: 'assistant',
          metadata: { path: ['offlineAutoReply'], equals: true },
          createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentOffline) {
        logger.debug({ conversationId }, 'agent_turn: silent window (ja avisou), skipping');
        return;
      }

      const text = silent?.offlineMessage?.trim() || DEFAULT_OFFLINE_MESSAGE;
      try {
        const sent = await uazapi.sendText({ number: patientPhone, text });
        await addMessage({
          conversationId,
          role: 'assistant',
          content: text,
          metadata: {
            offlineAutoReply: true,
            uazapiMessageId: sent.id,
            silentHours: { start: silent?.start, end: silent?.end },
          },
        });
        logger.info({ conversationId }, 'agent_turn: silent window, offline reply sent');
      } catch (err) {
        logger.error({ err, conversationId }, 'agent_turn: silent offline reply failed');
      }
      return;
    }

    await runAgent({
      tenantId,
      conversationId,
      patientId,
      patientPhone,
      logger,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'agent_turn job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'agent_turn job completed');
  });

  logger.info('agent_turn worker started');
  return worker;
}
