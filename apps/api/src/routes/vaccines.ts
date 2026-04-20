import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@imuniza/db';

const paramsSchema = z.object({ id: z.string().uuid() });

const vaccineBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  ageMonths: z.array(z.number().int().nonnegative()),
  priceCash: z.number().nonnegative(),
  priceInstallment: z.number().nonnegative(),
  installments: z.number().int().positive().default(3),
  active: z.boolean().default(true),
});

const vaccineUpdate = vaccineBody.partial();

const packageBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  items: z.array(z.object({ vaccineSlug: z.string(), doses: z.number().int().positive() })),
  priceCash: z.number().nonnegative(),
  priceInstallment: z.number().nonnegative(),
  installments: z.number().int().positive().default(5),
  active: z.boolean().default(true),
});

const packageUpdate = packageBody.partial();

function serializeVaccine<T extends { priceCash: unknown; priceInstallment: unknown }>(v: T) {
  return {
    ...v,
    priceCash: Number(v.priceCash),
    priceInstallment: Number(v.priceInstallment),
  };
}

export async function vaccinesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (req) => {
    const tenantId = req.session!.tenantId;
    const vaccines = await prisma.vaccine.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return vaccines.map(serializeVaccine);
  });

  app.post('/', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const body = vaccineBody.parse(req.body);
    const vaccine = await prisma.vaccine.create({ data: { tenantId, ...body } });
    return reply.code(201).send(serializeVaccine(vaccine));
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const existing = await prisma.vaccine.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    const body = vaccineUpdate.parse(req.body);
    const updated = await prisma.vaccine.update({ where: { id }, data: body });
    return serializeVaccine(updated);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const existing = await prisma.vaccine.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    await prisma.vaccine.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.get('/packages', async (req) => {
    const tenantId = req.session!.tenantId;
    const packages = await prisma.vaccinePackage.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return packages.map(serializeVaccine);
  });

  app.post('/packages', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const body = packageBody.parse(req.body);
    const pkg = await prisma.vaccinePackage.create({ data: { tenantId, ...body } });
    return reply.code(201).send(serializeVaccine(pkg));
  });

  app.patch('/packages/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const existing = await prisma.vaccinePackage.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    const body = packageUpdate.parse(req.body);
    const updated = await prisma.vaccinePackage.update({ where: { id }, data: body });
    return serializeVaccine(updated);
  });

  app.delete('/packages/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const tenantId = req.session!.tenantId;
    const existing = await prisma.vaccinePackage.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    await prisma.vaccinePackage.delete({ where: { id } });
    return reply.code(204).send();
  });
}
