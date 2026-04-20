import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@imuniza/db';
import { indexDocument } from '@imuniza/kb';
import { ai } from '../services/openai.js';

const paramsSchema = z.object({ id: z.string().uuid() });

const createBody = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().default('manual'),
});

const updateBody = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export async function kbRoutes(app: FastifyInstance): Promise<void> {
  app.get('/documents', async (req) => {
    const tenantId = req.session!.tenantId;
    return prisma.kBDocument.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        source: true,
        active: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
    });
  });

  app.get('/documents/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const doc = await prisma.kBDocument.findFirst({ where: { id, tenantId } });
    if (!doc) return reply.code(404).send({ error: 'not_found' });
    return doc;
  });

  app.post('/documents', async (req, reply) => {
    const body = createBody.parse(req.body);
    const tenantId = req.session!.tenantId;
    const doc = await prisma.kBDocument.create({
      data: { tenantId, title: body.title, content: body.content, source: body.source },
    });
    return reply.code(201).send(doc);
  });

  app.patch('/documents/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const body = updateBody.parse(req.body);
    const existing = await prisma.kBDocument.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    return prisma.kBDocument.update({ where: { id }, data: body });
  });

  app.delete('/documents/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const existing = await prisma.kBDocument.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    await prisma.kBDocument.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post('/documents/:id/reindex', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const existing = await prisma.kBDocument.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });

    try {
      const count = await indexDocument({ documentId: id, ai });
      return { ok: true, chunks: count };
    } catch (err) {
      req.log.error({ err }, 'reindex failed');
      return reply.code(502).send({ error: 'reindex_failed', detail: (err as Error).message });
    }
  });
}
