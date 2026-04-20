import {
  Prisma,
  prisma,
  type Conversation,
  type Message,
  type MessageRole,
  type Patient,
} from '@imuniza/db';
import { eventBus } from '../events/bus.js';

export async function upsertPatient(params: {
  tenantId: string;
  phone: string;
  name?: string;
}): Promise<Patient> {
  return prisma.patient.upsert({
    where: { tenantId_phone: { tenantId: params.tenantId, phone: params.phone } },
    create: { tenantId: params.tenantId, phone: params.phone, name: params.name ?? null },
    update: params.name ? { name: params.name } : {},
  });
}

export async function getOrCreateActiveConversation(params: {
  tenantId: string;
  patientId: string;
}): Promise<Conversation> {
  const existing = await prisma.conversation.findFirst({
    where: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      status: { in: ['active', 'awaiting_handoff', 'assigned'] },
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      status: 'active',
    },
  });
}

export async function addMessage(params: {
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<Message> {
  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: params.metadata ?? Prisma.JsonNull,
    },
  });
  const conversation = await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: message.createdAt },
    select: { tenantId: true },
  });

  if (params.role === 'user' || params.role === 'assistant' || params.role === 'human') {
    eventBus.emitDomain({
      type: 'message.created',
      tenantId: conversation.tenantId,
      conversationId: params.conversationId,
      messageId: message.id,
      role: params.role,
      content: params.content,
      createdAt: message.createdAt.toISOString(),
    });
  }

  return message;
}

export async function loadHistory(conversationId: string, limit = 20): Promise<Message[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.reverse();
}
