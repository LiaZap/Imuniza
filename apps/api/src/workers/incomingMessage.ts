import type { FastifyBaseLogger } from 'fastify';
import type { Job } from 'bullmq';
import { Prisma, prisma } from '@imuniza/db';
import { extractVaccineCard, transcribeAudio } from '@imuniza/ai';
import {
  agentTurnJobId,
  agentTurnQueue,
  registerIncomingMessageWorker,
  type IncomingMessageJob,
} from '../queue/queues.js';
import { env } from '../env.js';
import {
  addMessage,
  getOrCreateActiveConversation,
  upsertPatient,
} from '../services/conversation.js';
import { ai } from '../services/openai.js';
import { uazapi } from '../services/uazapi.js';
import { eventBus } from '../events/bus.js';

async function messageAlreadySaved(
  conversationId: string,
  providerMessageId: string,
): Promise<boolean> {
  if (!providerMessageId) return false;
  const existing = await prisma.message.findFirst({
    where: {
      conversationId,
      role: 'user',
      metadata: { path: ['providerMessageId'], equals: providerMessageId },
    },
    select: { id: true },
  });
  return existing != null;
}

export function startIncomingMessageWorker(logger: FastifyBaseLogger) {
  const worker = registerIncomingMessageWorker(async (job: Job<IncomingMessageJob>) => {
    const { tenantId, from, pushName, text, providerMessageId, media } = job.data;

    const patient = await upsertPatient({ tenantId, phone: from, name: pushName });
    const conversation = await getOrCreateActiveConversation({
      tenantId,
      patientId: patient.id,
    });

    // Deduplicação por providerMessageId
    const alreadySaved = await messageAlreadySaved(conversation.id, providerMessageId);

    let effectiveText = text;
    let transcriptMetadata: Record<string, unknown> = { providerMessageId };

    // 1) ÁUDIO → Whisper
    if (media?.kind === 'audio' && !alreadySaved) {
      try {
        const downloaded = await uazapi.downloadMedia({
          messageId: providerMessageId,
          url: media.url,
        });
        const transcript = await transcribeAudio(ai, downloaded.buffer, downloaded.mimetype);
        effectiveText = transcript || '[áudio sem fala detectada]';
        transcriptMetadata = {
          providerMessageId,
          mediaKind: 'audio',
          transcribed: true,
          seconds: media.seconds,
        };
        logger.info({ conversationId: conversation.id, seconds: media.seconds }, 'audio transcribed');
      } catch (err) {
        logger.error({ err }, 'whisper transcription failed');
        effectiveText = '[áudio recebido, mas não foi possível transcrever]';
      }
    }

    // 2) IMAGEM → Visão computacional (extração de carteira de vacinação)
    if (media?.kind === 'image' && !alreadySaved) {
      await addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: media.caption ?? '[imagem]',
        metadata: { providerMessageId, mediaKind: 'image', hasCaption: !!media.caption },
      });

      try {
        const downloaded = await uazapi.downloadMedia({
          messageId: providerMessageId,
          url: media.url,
        });
        const extraction = await extractVaccineCard(ai, downloaded.buffer, downloaded.mimetype);

        if (extraction && extraction.vaccinations.length > 0) {
          await prisma.vaccineCardExtraction.create({
            data: {
              tenantId,
              patientId: patient.id,
              conversationId: conversation.id,
              sourceMessageId: providerMessageId,
              extracted: extraction as unknown as Prisma.InputJsonValue,
            },
          });

          const summary = `Paciente enviou carteira de vacinação. IA identificou ${extraction.vaccinations.length} vacina(s) aplicada(s). Revisar e confirmar no prontuário.`;
          await prisma.$transaction(async (tx) => {
            await tx.conversation.update({
              where: { id: conversation.id },
              data: { status: 'awaiting_handoff' },
            });
            await tx.handoff.create({
              data: {
                tenantId,
                conversationId: conversation.id,
                status: 'pending',
                summary,
              },
            });
          });

          eventBus.emitDomain({
            type: 'conversation.handoff_requested',
            tenantId,
            conversationId: conversation.id,
            summary,
          });

          const replyText =
            extraction.vaccinations.length > 0
              ? `Recebi sua carteira de vacinação! 💙 Identifiquei ${extraction.vaccinations.length} vacina(s) já aplicada(s). Nossa equipe vai revisar em seguida e confirmar contigo, tudo bem?`
              : 'Recebi sua imagem. Vou encaminhar para nossa equipe revisar, tudo bem?';

          try {
            await uazapi.sendText({ number: from, text: replyText });
            await addMessage({
              conversationId: conversation.id,
              role: 'assistant',
              content: replyText,
              metadata: { vaccineCardExtraction: true, count: extraction.vaccinations.length },
            });
          } catch (err) {
            logger.error({ err }, 'failed to reply after card extraction');
          }

          return;
        }

        // Imagem não é carteira ou sem extração — segue fluxo normal
        effectiveText = media.caption ?? 'O paciente enviou uma imagem (não foi possível identificar como carteira de vacinação).';
      } catch (err) {
        logger.error({ err }, 'vaccine card extraction failed');
        effectiveText =
          media.caption ??
          'O paciente enviou uma imagem. Pedir esclarecimento ou solicitar handoff para análise humana.';
      }
    }

    if (!alreadySaved) {
      if (media?.kind !== 'image') {
        await addMessage({
          conversationId: conversation.id,
          role: 'user',
          content: effectiveText,
          metadata: transcriptMetadata as Prisma.InputJsonValue,
        });
      }
    }

    if (conversation.status === 'assigned' || conversation.status === 'awaiting_handoff') {
      logger.info(
        { conversationId: conversation.id, status: conversation.status },
        'conversation already handled by human or in handoff, skipping agent',
      );
      return;
    }
    if (conversation.aiPausedUntil && conversation.aiPausedUntil.getTime() > Date.now()) {
      logger.info(
        { conversationId: conversation.id, until: conversation.aiPausedUntil.toISOString() },
        'IA pausada, nao agendando agent_turn',
      );
      return;
    }

    // Debounce: remove o job anterior (se houver) e agenda de novo.
    // Dessa forma, se o paciente mandar varias mensagens "picadas",
    // a IA so responde depois de MESSAGE_BUFFER_MS de silencio.
    const jobId = agentTurnJobId(conversation.id);
    try {
      const existing = await agentTurnQueue.getJob(jobId);
      if (existing) {
        await existing.remove().catch(() => undefined);
      }
    } catch {
      /* ignore: job pode ja estar em execucao */
    }

    await agentTurnQueue.add(
      'agent-turn',
      {
        tenantId,
        conversationId: conversation.id,
        patientId: patient.id,
        patientPhone: from,
      },
      { jobId, delay: env.MESSAGE_BUFFER_MS },
    );

    logger.debug(
      { conversationId: conversation.id, delayMs: env.MESSAGE_BUFFER_MS },
      'agent turn debounced',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'incoming_message job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'incoming_message job completed');
  });

  logger.info('incoming_message worker started');
  return worker;
}
