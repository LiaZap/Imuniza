import type { FastifyInstance } from 'fastify';
import { prisma } from '@imuniza/db';
import { redisConnection } from '../queue/connection.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/health/db', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  });

  app.get('/health/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch {
      checks.db = 'fail';
    }
    try {
      const pong = await redisConnection.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'fail';
    } catch {
      checks.redis = 'fail';
    }
    const ok = Object.values(checks).every((v) => v === 'ok');
    return reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'degraded', checks });
  });
}
