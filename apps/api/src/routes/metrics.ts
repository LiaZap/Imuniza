import type { FastifyInstance } from 'fastify';
import { prisma } from '@imuniza/db';

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/overview', async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      active,
      awaitingHandoff,
      assignedActive,
      closedToday,
      messagesToday,
      handoffsToday,
      patientsToday,
      aiMessagesToday,
    ] = await Promise.all([
      prisma.conversation.count({ where: { status: 'active' } }),
      prisma.conversation.count({ where: { status: 'awaiting_handoff' } }),
      prisma.conversation.count({ where: { status: 'assigned' } }),
      prisma.conversation.count({ where: { status: 'closed', updatedAt: { gte: startOfToday } } }),
      prisma.message.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.handoff.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.patient.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.message.count({
        where: { createdAt: { gte: startOfToday }, role: 'assistant' },
      }),
    ]);

    return {
      active,
      awaitingHandoff,
      assignedActive,
      closedToday,
      messagesToday,
      handoffsToday,
      patientsToday,
      aiMessagesToday,
    };
  });

  app.get('/hourly', async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRawUnsafe<Array<{ hour: number; messages: bigint }>>(
      `WITH hours AS (SELECT generate_series(0, 23) AS hour)
       SELECT h.hour, COALESCE(m.c, 0)::bigint AS messages
       FROM hours h
       LEFT JOIN (
         SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS c
         FROM messages
         WHERE "createdAt" >= $1
         GROUP BY 1
       ) m ON m.hour = h.hour
       ORDER BY h.hour`,
      startOfToday,
    );

    return rows.map((r) => ({ hour: Number(r.hour), messages: Number(r.messages) }));
  });

  app.get('/breakdown', async (req) => {
    const q = req.query as { from?: string; to?: string; days?: string };

    let from: Date;
    let to: Date;
    if (q.from && q.to) {
      from = new Date(q.from);
      to = new Date(q.to);
    } else {
      const days = Number(q.days ?? 7);
      const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, 365)) : 7;
      to = new Date();
      to.setHours(23, 59, 59, 999);
      from = new Date(to);
      from.setDate(from.getDate() - (safeDays - 1));
      from.setHours(0, 0, 0, 0);
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ role: string; c: bigint }>>(
      `SELECT role::text AS role, COUNT(*)::bigint AS c
       FROM messages
       WHERE "createdAt" >= $1 AND "createdAt" <= $2
       GROUP BY role`,
      from,
      to,
    );

    const byRole: Record<string, number> = {};
    for (const r of rows) byRole[r.role] = Number(r.c);

    // Escalonamento = handoffs no periodo (vezes que a IA pediu humano)
    const escalations = await prisma.handoff.count({
      where: { createdAt: { gte: from, lte: to } },
    });
    const conversationsPeriod = await prisma.conversation.count({
      where: { createdAt: { gte: from, lte: to } },
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      user: byRole.user ?? 0,
      assistant: byRole.assistant ?? 0,
      human: byRole.human ?? 0,
      escalations,
      conversations: conversationsPeriod,
      escalationRate:
        conversationsPeriod > 0 ? Math.round((escalations / conversationsPeriod) * 100) : 0,
    };
  });

  app.get('/weekly', async () => {
    const days = 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setDate(from.getDate() - (days - 1));

    const rows = await prisma.$queryRawUnsafe<
      Array<{ day: Date; messages: bigint; handoffs: bigint }>
    >(
      `WITH days AS (
         SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
       )
       SELECT
         d.day,
         COALESCE(m.c, 0)::bigint AS messages,
         COALESCE(h.c, 0)::bigint AS handoffs
       FROM days d
       LEFT JOIN (
         SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS c
         FROM messages
         WHERE "createdAt" >= $1 AND "createdAt" < ($2::date + interval '1 day')
         GROUP BY 1
       ) m ON m.day = d.day
       LEFT JOIN (
         SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS c
         FROM handoffs
         WHERE "createdAt" >= $1 AND "createdAt" < ($2::date + interval '1 day')
         GROUP BY 1
       ) h ON h.day = d.day
       ORDER BY d.day`,
      from,
      today,
    );

    return rows.map((r) => ({
      date: new Date(r.day).toISOString().slice(0, 10),
      messages: Number(r.messages),
      handoffs: Number(r.handoffs),
    }));
  });

  app.get('/funnel', async (req) => {
    const query = req.query as { days?: string };
    const daysParam = Number(query.days ?? 30);
    const days = Number.isFinite(daysParam) ? Math.max(1, Math.min(daysParam, 365)) : 30;
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const [contacts, handoffs, appointments, attended, paid, revenue] = await Promise.all([
      prisma.patient.count({ where: { createdAt: { gte: from } } }),
      prisma.handoff.count({ where: { createdAt: { gte: from } } }),
      prisma.appointment.count({ where: { createdAt: { gte: from } } }),
      prisma.appointment.count({
        where: { createdAt: { gte: from }, status: { in: ['attended', 'paid'] } },
      }),
      prisma.appointment.count({ where: { createdAt: { gte: from }, status: 'paid' } }),
      prisma.appointment.aggregate({
        where: { createdAt: { gte: from }, status: 'paid' },
        _sum: { paidValue: true },
      }),
    ]);

    const steps = [
      { key: 'contacts', label: 'Pacientes que falaram com a IA', value: contacts },
      { key: 'handoffs', label: 'Encaminhados para a equipe', value: handoffs },
      { key: 'appointments', label: 'Agendados', value: appointments },
      { key: 'attended', label: 'Atendidos / aplicaram', value: attended },
    ];

    // Revenue ainda fica no payload pra eventual uso interno (admin),
    // mas a UI principal nao exibe mais.
    const revenueTotal = revenue._sum.paidValue ? Number(revenue._sum.paidValue) : 0;

    return {
      days,
      steps,
      revenue: revenueTotal,
      conversion: contacts > 0 ? Math.round((attended / contacts) * 100) : 0,
    };
  });
}
