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
