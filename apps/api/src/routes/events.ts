import type { FastifyInstance } from 'fastify';
import { eventBus, type DomainEvent } from '../events/bus.js';

function writeEvent(raw: NodeJS.WritableStream, event: DomainEvent | { type: string; [k: string]: unknown }): void {
  raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/conversations', (req, reply) => {
    reply.hijack();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    writeEvent(reply.raw, { type: 'connected', ts: Date.now() });

    const unsubscribe = eventBus.onDomain((event) => {
      try {
        writeEvent(reply.raw, event);
      } catch (err) {
        req.log.warn({ err }, 'sse write failed');
      }
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    };

    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
  });
}
