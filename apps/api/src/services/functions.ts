import { prisma } from '@imuniza/db';
import { searchKB } from '@imuniza/kb';
import { PatientProfileSchema } from '@imuniza/shared';
import { addMessage } from './conversation.js';
import { ai } from './openai.js';
import { uazapi } from './uazapi.js';
import { eventBus } from '../events/bus.js';

export interface FunctionContext {
  tenantId: string;
  conversationId: string;
  patientId: string;
  patientPhone: string;
  logger: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void };
}

export interface FunctionResult {
  name: string;
  output: string;
  sideEffects?: { sentToPatient?: boolean; handoffRequested?: boolean };
}

export const functionHandlers: Record<
  string,
  (args: Record<string, unknown>, ctx: FunctionContext) => Promise<FunctionResult>
> = {
  async send_reply(args, ctx) {
    const text = String(args.text ?? '').trim();
    if (!text) return { name: 'send_reply', output: JSON.stringify({ error: 'empty text' }) };

    try {
      const sent = await uazapi.sendText({ number: ctx.patientPhone, text });
      await addMessage({
        conversationId: ctx.conversationId,
        role: 'assistant',
        content: text,
        metadata: { uazapiMessageId: sent.id },
      });
      return {
        name: 'send_reply',
        output: JSON.stringify({ ok: true, messageId: sent.id }),
        sideEffects: { sentToPatient: true },
      };
    } catch (err) {
      ctx.logger.error({ err }, 'send_reply uazapi failed');
      return {
        name: 'send_reply',
        output: JSON.stringify({ ok: false, error: (err as Error).message }),
      };
    }
  },

  async update_patient_profile(args, ctx) {
    const parsed = PatientProfileSchema.safeParse(args);
    if (!parsed.success) {
      return {
        name: 'update_patient_profile',
        output: JSON.stringify({ ok: false, errors: parsed.error.issues }),
      };
    }

    const existing = await prisma.patient.findUnique({ where: { id: ctx.patientId } });
    const current = (existing?.profile as Record<string, unknown>) ?? {};
    const next = { ...current, ...parsed.data };

    await prisma.patient.update({
      where: { id: ctx.patientId },
      data: {
        profile: next,
        name: parsed.data.babyName ?? existing?.name ?? null,
      },
    });

    return { name: 'update_patient_profile', output: JSON.stringify({ ok: true, profile: next }) };
  },

  async search_kb(args, ctx) {
    const query = String(args.query ?? '').trim();
    if (!query) return { name: 'search_kb', output: JSON.stringify({ results: [] }) };

    const topK = Math.min(Math.max(Number(args.topK ?? 4), 1), 10);
    const results = await searchKB({ tenantId: ctx.tenantId, query, topK, ai });
    return {
      name: 'search_kb',
      output: JSON.stringify({
        results: results.map((r) => ({
          title: r.documentTitle,
          content: r.content,
          score: 1 - r.distance,
        })),
      }),
    };
  },

  async list_vaccines(args, ctx) {
    const ageMonths = args.ageMonths != null ? Number(args.ageMonths) : null;
    const vaccines = await prisma.vaccine.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      orderBy: { name: 'asc' },
    });

    const filtered =
      ageMonths != null ? vaccines.filter((v) => v.ageMonths.includes(ageMonths)) : vaccines;

    return {
      name: 'list_vaccines',
      output: JSON.stringify({
        vaccines: filtered.map((v) => ({
          name: v.name,
          slug: v.slug,
          ageMonths: v.ageMonths,
          priceCash: Number(v.priceCash),
          priceInstallment: Number(v.priceInstallment),
          installments: v.installments,
          description: v.description,
        })),
      }),
    };
  },

  async recommend_vaccines(args, ctx) {
    const ageMonths = Number(args.ageMonths);
    if (!Number.isFinite(ageMonths)) {
      return {
        name: 'recommend_vaccines',
        output: JSON.stringify({ ok: false, error: 'ageMonths inválido' }),
      };
    }

    const vaccines = await prisma.vaccine.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      orderBy: { name: 'asc' },
    });

    const recommended = vaccines.filter((v) => v.ageMonths.includes(ageMonths));

    const pkg = await prisma.vaccinePackage.findFirst({
      where: { tenantId: ctx.tenantId, active: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      name: 'recommend_vaccines',
      output: JSON.stringify({
        ageMonths,
        recommended: recommended.map((v) => ({
          name: v.name,
          priceCash: Number(v.priceCash),
          priceInstallment: Number(v.priceInstallment),
          description: v.description,
        })),
        packageAvailable: pkg
          ? {
              name: pkg.name,
              priceCash: Number(pkg.priceCash),
              priceInstallment: Number(pkg.priceInstallment),
              installments: pkg.installments,
            }
          : null,
      }),
    };
  },

  async request_handoff(args, ctx) {
    const reason = String(args.reason ?? 'patient_request');
    const summary = String(args.summary ?? '').trim() || 'Paciente encaminhado ao atendimento humano.';

    await prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: ctx.conversationId },
        data: { status: 'awaiting_handoff' },
      });
      await tx.handoff.create({
        data: {
          tenantId: ctx.tenantId,
          conversationId: ctx.conversationId,
          status: 'pending',
          summary: `[${reason}] ${summary}`,
        },
      });
    });

    ctx.logger.info({ conversationId: ctx.conversationId, reason }, 'handoff requested');

    eventBus.emitDomain({
      type: 'conversation.handoff_requested',
      tenantId: ctx.tenantId,
      conversationId: ctx.conversationId,
      summary: `[${reason}] ${summary}`,
    });

    return {
      name: 'request_handoff',
      output: JSON.stringify({ ok: true, status: 'awaiting_handoff' }),
      sideEffects: { handoffRequested: true },
    };
  },
};
