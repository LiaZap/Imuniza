import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma, prisma, CampaignStatus } from '@imuniza/db';

const paramsSchema = z.object({ id: z.string().uuid() });

const createBody = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  audience: z.enum(['all', 'baby_below_12m', 'missing_next_dose', 'custom']).default('all'),
  audienceFilter: z.record(z.unknown()).optional(),
});

export async function campaignsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (req) => {
    const tenantId = req.session!.tenantId;
    return prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/:id', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const { id } = paramsSchema.parse(req.params);
    const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) return reply.code(404).send({ error: 'not_found' });
    return campaign;
  });

  app.post('/', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const body = createBody.parse(req.body);
    const created = await prisma.campaign.create({
      data: {
        tenantId,
        name: body.name,
        message: body.message,
        audience: body.audience,
        audienceFilter: (body.audienceFilter ?? {}) as Prisma.InputJsonValue,
        status: 'draft',
      },
    });
    return reply.code(201).send(created);
  });

  app.delete('/:id', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const { id } = paramsSchema.parse(req.params);
    const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    await prisma.campaign.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post('/:id/preview', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const { id } = paramsSchema.parse(req.params);
    const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) return reply.code(404).send({ error: 'not_found' });
    const targets = await resolveAudience(tenantId, campaign.audience, campaign.audienceFilter as Record<string, unknown>);
    return { total: targets.length, sample: targets.slice(0, 5).map((p) => ({ phone: p.phone, name: p.name })) };
  });

  app.post('/:id/send', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const { id } = paramsSchema.parse(req.params);
    const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) return reply.code(404).send({ error: 'not_found' });
    if (campaign.status !== 'draft' && campaign.status !== 'failed')
      return reply.code(409).send({ error: 'already_running_or_done' });

    const targets = await resolveAudience(tenantId, campaign.audience, campaign.audienceFilter as Record<string, unknown>);
    await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.running,
        startedAt: new Date(),
        totalTargets: targets.length,
        sentCount: 0,
        failedCount: 0,
      },
    });

    // Dispara em background (fire-and-forget) — o worker externo verá
    process.nextTick(() => runCampaign(id, tenantId, req.log));

    return { ok: true, totalTargets: targets.length };
  });
}

async function resolveAudience(
  tenantId: string,
  audience: string,
  filter: Record<string, unknown>,
) {
  const base = { tenantId };
  if (audience === 'baby_below_12m') {
    return prisma.patient.findMany({
      where: {
        ...base,
        profile: { path: ['babyAgeMonths'], lte: 12 } as never,
      },
    });
  }
  if (audience === 'missing_next_dose') {
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 14);
    const upcoming = await prisma.patientVaccination.findMany({
      where: {
        tenantId,
        nextDueAt: { gte: now, lte: soon },
      },
      select: { patientId: true },
    });
    const ids = [...new Set(upcoming.map((v) => v.patientId))];
    return prisma.patient.findMany({ where: { ...base, id: { in: ids } } });
  }
  if (audience === 'custom' && filter.phones && Array.isArray(filter.phones)) {
    return prisma.patient.findMany({
      where: { ...base, phone: { in: filter.phones as string[] } },
    });
  }
  return prisma.patient.findMany({ where: base });
}

async function runCampaign(
  campaignId: string,
  tenantId: string,
  logger: { error: (obj: unknown, msg?: string) => void; info: (obj: unknown, msg?: string) => void },
) {
  const { uazapi } = await import('../services/uazapi.js');
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;
  const targets = await resolveAudience(tenantId, campaign.audience, campaign.audienceFilter as Record<string, unknown>);

  let sent = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      const msg = campaign.message.replace('{{nome}}', t.name ?? '').trim();
      await uazapi.sendText({ number: t.phone, text: msg, delayMs: 800 });
      sent++;
    } catch (err) {
      failed++;
      logger.error({ err, patientId: t.id }, 'campaign send failed');
    }
    if ((sent + failed) % 10 === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: sent, failedCount: failed },
      });
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: failed > 0 && sent === 0 ? CampaignStatus.failed : CampaignStatus.completed,
      sentCount: sent,
      failedCount: failed,
      finishedAt: new Date(),
    },
  });
  logger.info({ campaignId, sent, failed }, 'campaign finished');
}
