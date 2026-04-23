import type { FastifyInstance } from 'fastify';
import { UazapiWebhookMessageSchema } from '@imuniza/shared';
import { uazapi } from '../services/uazapi.js';
import { getDefaultTenantId } from '../services/tenant.js';
import { incomingMessageQueue } from '../queue/queues.js';
import { env } from '../env.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/uazapi', async (req, reply) => {
    // Autenticação aceita uma das duas formas:
    // 1) body.token === UAZAPI_TOKEN (formato padrão que a Uazapi envia)
    // 2) header x-webhook-secret === UAZAPI_WEBHOOK_SECRET (alternativa)
    const body = req.body as { token?: string } | undefined;
    const headerSecret = req.headers['x-webhook-secret'];
    const bodyTokenOk = !!body?.token && body.token === env.UAZAPI_TOKEN;
    const headerSecretOk = !!headerSecret && headerSecret === env.UAZAPI_WEBHOOK_SECRET;
    if (!bodyTokenOk && !headerSecretOk) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const parsed = UazapiWebhookMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues }, 'webhook payload did not match schema');
      return reply.code(202).send({ status: 'ignored', reason: 'schema' });
    }

    // Processamos apenas evento de mensagens
    const eventType = parsed.data.EventType ?? parsed.data.event;
    if (eventType && !/message/i.test(eventType)) {
      return reply.code(202).send({ status: 'ignored', reason: `event:${eventType}` });
    }

    const inbound = uazapi.parseInbound(parsed.data);
    if (!inbound) {
      return reply.code(202).send({ status: 'ignored', reason: 'not-an-inbound-text' });
    }

    const tenantId = await getDefaultTenantId();

    await incomingMessageQueue.add('process', {
      tenantId,
      from: inbound.from,
      pushName: inbound.pushName,
      text: inbound.text,
      providerMessageId: inbound.id,
      receivedAt: inbound.timestamp * 1000,
      media: inbound.media,
    });

    return reply.code(202).send({ status: 'queued' });
  });
}
