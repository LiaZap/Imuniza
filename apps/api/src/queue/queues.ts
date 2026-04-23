import { Queue, Worker, type Processor } from 'bullmq';
import { redisConnection } from './connection.js';

export type IncomingMessageJob = {
  tenantId: string;
  from: string;
  pushName?: string;
  text: string;
  providerMessageId: string;
  receivedAt: number;
  media?: {
    kind: 'audio' | 'image' | 'document' | 'video';
    url?: string;
    mimetype?: string;
    caption?: string;
    seconds?: number;
  };
};

export const incomingMessageQueue = new Queue<IncomingMessageJob>('incoming_message', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

export function registerIncomingMessageWorker(
  processor: Processor<IncomingMessageJob>,
): Worker<IncomingMessageJob> {
  return new Worker<IncomingMessageJob>('incoming_message', processor, {
    connection: redisConnection,
    concurrency: 4,
  });
}

/**
 * Job disparado apos o debounce de mensagens "picadas". Cada agendamento
 * substitui o anterior da mesma conversa, entao a IA so responde quando
 * o paciente para de digitar/enviar por X ms.
 */
export type AgentTurnJob = {
  tenantId: string;
  conversationId: string;
  patientId: string;
  patientPhone: string;
};

export const agentTurnQueue = new Queue<AgentTurnJob>('agent_turn', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 24 * 3600 },
  },
});

export function agentTurnJobId(conversationId: string): string {
  return `agent-turn:${conversationId}`;
}

export function registerAgentTurnWorker(
  processor: Processor<AgentTurnJob>,
): Worker<AgentTurnJob> {
  return new Worker<AgentTurnJob>('agent_turn', processor, {
    connection: redisConnection,
    // Serializa: uma conversa por vez, respostas humanizadas sem concorrer
    concurrency: 4,
  });
}
