import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, ConversationStatus } from '@imuniza/db';
import { addMessage } from '../services/conversation.js';
import { uazapi } from '../services/uazapi.js';
import { eventBus } from '../events/bus.js';

const listQuery = z.object({
  status: z.enum(['active', 'awaiting_handoff', 'assigned', 'closed']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const paramsSchema = z.object({ id: z.string().uuid() });

const assignBody = z.object({
  userId: z.string().uuid().optional(),
});

const humanMessageBody = z.object({
  text: z.string().min(1),
  userId: z.string().uuid().optional(),
});

export async function conversationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (req) => {
    const query = listQuery.parse(req.query);
    return prisma.conversation.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { lastMessageAt: 'desc' },
      take: query.limit,
      include: {
        patient: { select: { id: true, phone: true, name: true, profile: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        patient: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        handoffs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!conversation) return reply.code(404).send({ error: 'not_found' });
    return conversation;
  });

  app.post('/:id/assign', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const { userId } = assignBody.parse(req.body ?? {});

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return reply.code(404).send({ error: 'not_found' });
    if (conversation.status === 'closed') {
      return reply.code(409).send({ error: 'conversation_closed' });
    }

    let assigneeId = userId;
    if (!assigneeId) {
      const admin = await prisma.user.findFirst({
        where: { tenantId: conversation.tenantId, role: 'admin', active: true },
      });
      if (!admin) return reply.code(400).send({ error: 'no_user_to_assign' });
      assigneeId = admin.id;
    }

    const [updated] = await prisma.$transaction([
      prisma.conversation.update({
        where: { id },
        data: { status: 'assigned', assignedToUserId: assigneeId },
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
      }),
      prisma.handoff.updateMany({
        where: { conversationId: id, status: 'pending' },
        data: { status: 'assigned', assignedToUserId: assigneeId },
      }),
    ]);

    eventBus.emitDomain({
      type: 'conversation.assigned',
      tenantId: conversation.tenantId,
      conversationId: id,
      userId: assigneeId,
    });

    return updated;
  });

  app.post('/:id/message', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const { text, userId } = humanMessageBody.parse(req.body);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { patient: { select: { phone: true } } },
    });
    if (!conversation) return reply.code(404).send({ error: 'not_found' });
    if (conversation.status === 'closed') {
      return reply.code(409).send({ error: 'conversation_closed' });
    }

    // Auto-assign if still in queue and userId provided (atendente começa a responder direto)
    if (conversation.status !== 'assigned' && userId) {
      await prisma.conversation.update({
        where: { id },
        data: { status: 'assigned', assignedToUserId: userId },
      });
      await prisma.handoff.updateMany({
        where: { conversationId: id, status: 'pending' },
        data: { status: 'assigned', assignedToUserId: userId },
      });
      eventBus.emitDomain({
        type: 'conversation.assigned',
        tenantId: conversation.tenantId,
        conversationId: id,
        userId,
      });
    }

    try {
      await uazapi.sendText({ number: conversation.patient.phone, text });
    } catch (err) {
      req.log.error({ err }, 'failed to send human message via uazapi');
      return reply.code(502).send({ error: 'uazapi_failed', detail: (err as Error).message });
    }

    const message = await addMessage({
      conversationId: id,
      role: 'human',
      content: text,
      metadata: userId ? { sentBy: userId } : {},
    });

    return { message };
  });

  app.post('/:id/close', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return reply.code(404).send({ error: 'not_found' });
    if (conversation.status === 'closed') return reply.send(conversation);

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.conversation.update({
        where: { id },
        data: { status: ConversationStatus.closed },
      });
      await tx.handoff.updateMany({
        where: { conversationId: id, status: { in: ['pending', 'assigned'] } },
        data: { status: 'resolved' },
      });
      return c;
    });

    eventBus.emitDomain({
      type: 'conversation.closed',
      tenantId: conversation.tenantId,
      conversationId: id,
    });

    return updated;
  });
}
