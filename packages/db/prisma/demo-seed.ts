/**
 * Demo seed — popula o sistema com dados realistas para apresentacao.
 * Roda DEPOIS do seed normal. Idempotente (pode rodar varias vezes).
 *
 * Uso local:      pnpm --filter @imuniza/db exec tsx prisma/demo-seed.ts
 * Em producao:    cd /app/packages/db && pnpm exec tsx prisma/demo-seed.ts
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// UUIDs fixos para idempotencia
const DEMO = {
  patients: {
    mariana: '10000000-0000-0000-0000-000000000001', // mae Theo 2m
    camila: '10000000-0000-0000-0000-000000000002', // mae Helena 4m
    beatriz: '10000000-0000-0000-0000-000000000003', // mae Davi 6m
    juliana: '10000000-0000-0000-0000-000000000004', // mae Lara 3m
    renata: '10000000-0000-0000-0000-000000000005', // gestante 32sem
    carolina: '10000000-0000-0000-0000-000000000006', // mae Sofia 5m
    fernanda: '10000000-0000-0000-0000-000000000007', // mae Miguel 2m
    patricia: '10000000-0000-0000-0000-000000000008', // mae gemeos 4m
    vanessa: '10000000-0000-0000-0000-000000000009', // duvida sobre atrasado
    aline: '10000000-0000-0000-0000-00000000000a', // mae Valentina 6m
  },
  conversations: {
    mariana: '20000000-0000-0000-0000-000000000001',
    camila: '20000000-0000-0000-0000-000000000002',
    beatriz: '20000000-0000-0000-0000-000000000003',
    juliana: '20000000-0000-0000-0000-000000000004',
    renata: '20000000-0000-0000-0000-000000000005',
    carolina: '20000000-0000-0000-0000-000000000006',
    fernanda: '20000000-0000-0000-0000-000000000007',
    patricia: '20000000-0000-0000-0000-000000000008',
  },
};

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}
function hoursAgo(h: number): Date {
  return minutesAgo(h * 60);
}
function daysAgo(d: number): Date {
  return hoursAgo(d * 24);
}

async function main() {
  const tenantSlug = (process.env.DEFAULT_TENANT_NAME ?? 'Clinica Imuniza')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" nao encontrado. Rode o seed principal antes.`);
    process.exit(1);
  }
  const tenantId = tenant.id;

  const admin = await prisma.user.findFirst({ where: { tenantId, role: 'admin' } });
  if (!admin) {
    console.error('Admin nao encontrado. Rode o seed principal antes.');
    process.exit(1);
  }

  console.log(`Demo seed iniciado para tenant ${tenant.name} (${tenant.slug})`);

  // ───────────────────────── PACIENTES ─────────────────────────
  const patients: Array<{
    id: string;
    phone: string;
    name: string;
    profile: Record<string, unknown>;
  }> = [
    {
      id: DEMO.patients.mariana,
      phone: '5511987001001',
      name: 'Mariana Silva',
      profile: { babyName: 'Theo', babyAgeMonths: 2, medicalConditions: [] },
    },
    {
      id: DEMO.patients.camila,
      phone: '5511987001002',
      name: 'Camila Rodrigues',
      profile: { babyName: 'Helena', babyAgeMonths: 4, medicalConditions: [] },
    },
    {
      id: DEMO.patients.beatriz,
      phone: '5511987001003',
      name: 'Beatriz Oliveira',
      profile: {
        babyName: 'Davi',
        babyAgeMonths: 6,
        medicalConditions: ['prematuridade leve'],
      },
    },
    {
      id: DEMO.patients.juliana,
      phone: '5511987001004',
      name: 'Juliana Costa',
      profile: { babyName: 'Lara', babyAgeMonths: 3, medicalConditions: [] },
    },
    {
      id: DEMO.patients.renata,
      phone: '5511987001005',
      name: 'Renata Almeida',
      profile: { pregnant: true, weeksPregnant: 32 },
    },
    {
      id: DEMO.patients.carolina,
      phone: '5511987001006',
      name: 'Carolina Ferreira',
      profile: { babyName: 'Sofia', babyAgeMonths: 5 },
    },
    {
      id: DEMO.patients.fernanda,
      phone: '5511987001007',
      name: 'Fernanda Martins',
      profile: { babyName: 'Miguel', babyAgeMonths: 2 },
    },
    {
      id: DEMO.patients.patricia,
      phone: '5511987001008',
      name: 'Patrícia Souza',
      profile: {
        babyName: 'Alice e Laura (gêmeas)',
        babyAgeMonths: 4,
        notes: 'Gêmeas, atender as duas no mesmo horário',
      },
    },
    {
      id: DEMO.patients.vanessa,
      phone: '5511987001009',
      name: 'Vanessa Lima',
      profile: { babyName: 'Arthur', babyAgeMonths: 9, notes: 'Atrasou hexavalente' },
    },
    {
      id: DEMO.patients.aline,
      phone: '5511987001010',
      name: 'Aline Pereira',
      profile: { babyName: 'Valentina', babyAgeMonths: 6 },
    },
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        tenantId,
        phone: p.phone,
        name: p.name,
        profile: p.profile as Prisma.InputJsonValue,
      },
      update: { name: p.name, profile: p.profile as Prisma.InputJsonValue },
    });
  }
  console.log(`✓ ${patients.length} pacientes`);

  // ───────────────────── CONVERSAS + MENSAGENS ─────────────────
  type Msg = { role: 'user' | 'assistant' | 'human'; content: string; minutesAgo: number };
  const convs: Array<{
    id: string;
    patientId: string;
    status: 'active' | 'awaiting_handoff' | 'assigned' | 'closed';
    assignedToUserId?: string;
    aiPausedUntil?: Date | null;
    handoffSummary?: string;
    messages: Msg[];
  }> = [
    // 1. Aguardando humano — mãe de 2m pedindo agendamento
    {
      id: DEMO.conversations.mariana,
      patientId: DEMO.patients.mariana,
      status: 'awaiting_handoff',
      handoffSummary:
        'Paciente quer agendar vacinas de 2 meses para o Theo. Orçamento aprovado: R$ 1.057 (hexa + pneumo20 + rotavírus, primeira dose).',
      messages: [
        { role: 'user', content: 'oi boa tarde', minutesAgo: 14 },
        { role: 'user', content: 'meu bebê fez 2 meses semana passada', minutesAgo: 13 },
        { role: 'user', content: 'queria saber quais vacinas tomar', minutesAgo: 13 },
        {
          role: 'assistant',
          content:
            'Olá! Que alegria ter você por aqui 💙 Parabéns pelo Theo! Aos 2 meses indicamos:\n\n• Hexavalente acelular — R$ 256\n• Pneumocócica 20 — R$ 489\n• Rotavírus pentavalente — R$ 312\n\nTotal da 1ª dose: R$ 1.057 (à vista). Quer que eu passe para alguém da nossa equipe marcar o horário?',
          minutesAgo: 12,
        },
        { role: 'user', content: 'sim pode marcar por favor', minutesAgo: 8 },
        {
          role: 'assistant',
          content: 'Perfeito! Vou encaminhar para a equipe de agendamento, em instantes eles te chamam por aqui mesmo 💙',
          minutesAgo: 7,
        },
      ],
    },
    // 2. Aguardando humano — URGENTE (>15min)
    {
      id: DEMO.conversations.camila,
      patientId: DEMO.patients.camila,
      status: 'awaiting_handoff',
      handoffSummary:
        'Mãe da Helena (4m) quer agendar 2ª dose de hexa + pneumo20 + rotavírus. Disponibilidade: sábado manhã.',
      messages: [
        { role: 'user', content: 'oi', minutesAgo: 35 },
        { role: 'user', content: 'tem horario sabado de manhã?', minutesAgo: 34 },
        {
          role: 'assistant',
          content: 'Olá Camila! 💙 Para quais vacinas e para qual idade do bebê?',
          minutesAgo: 33,
        },
        {
          role: 'user',
          content: 'helena ta com 4 meses, ja tomou a primeira dose aos 2',
          minutesAgo: 31,
        },
        {
          role: 'assistant',
          content:
            'Ótimo! A 2ª dose inclui as mesmas vacinas: hexavalente, pneumo 20 e rotavírus. Vou pedir para alguém da nossa equipe confirmar sábado de manhã, tudo bem?',
          minutesAgo: 30,
        },
        { role: 'user', content: 'ta otimo obrigada', minutesAgo: 29 },
      ],
    },
    // 3. IA pausada (humano respondeu pelo celular) — pausa até daqui 1h45
    {
      id: DEMO.conversations.beatriz,
      patientId: DEMO.patients.beatriz,
      status: 'active',
      aiPausedUntil: new Date(Date.now() + 1 * 60 * 60 * 1000 + 45 * 60 * 1000),
      messages: [
        { role: 'user', content: 'boa tarde, tenho uma dúvida', minutesAgo: 40 },
        {
          role: 'user',
          content: 'davi nasceu prematuro e já fez 6 meses, ainda posso aplicar as vacinas?',
          minutesAgo: 39,
        },
        {
          role: 'assistant',
          content:
            'Oi Beatriz! 💙 Prematuridade leve não impede a aplicação. Como é um caso que precisa de avaliação individual, nossa enfermeira vai te passar orientações precisas, posso chamar?',
          minutesAgo: 38,
        },
        {
          role: 'human',
          content:
            'Oi Beatriz, aqui é a Dra. Marcela. A prematuridade do Davi é considerada leve e ele já pode seguir o calendário normal dos 6 meses. Traz a carteirinha quando vier 🙏',
          minutesAgo: 15,
        },
      ],
    },
    // 4. Em atendimento (assumida) — atendente já conduzindo
    {
      id: DEMO.conversations.juliana,
      patientId: DEMO.patients.juliana,
      status: 'assigned',
      assignedToUserId: admin.id,
      messages: [
        { role: 'user', content: 'olá, tudo bem?', minutesAgo: 55 },
        { role: 'user', content: 'lara fez 3 meses ontem', minutesAgo: 55 },
        {
          role: 'assistant',
          content:
            'Oi Juliana! Parabéns pela Lara 💙 Aos 3 meses indicamos meningocócica ACWY (R$ 389) e meningocócica B (R$ 689). Quer agendar?',
          minutesAgo: 54,
        },
        { role: 'user', content: 'sim', minutesAgo: 50 },
        {
          role: 'human',
          content:
            'Oi Juliana, aqui é o ' +
            admin.name +
            ' ✋ Temos horário amanhã (terça) às 10h ou quinta às 15h. Qual prefere?',
          minutesAgo: 48,
        },
        { role: 'user', content: 'amanhã 10h perfeito!', minutesAgo: 46 },
        {
          role: 'human',
          content: 'Agendado! Te espero amanhã às 10h. Qualquer coisa é só chamar 💙',
          minutesAgo: 45,
        },
      ],
    },
    // 5. IA atendendo — gestante
    {
      id: DEMO.conversations.renata,
      patientId: DEMO.patients.renata,
      status: 'active',
      messages: [
        { role: 'user', content: 'estou gravida de 32 semanas', minutesAgo: 3 },
        {
          role: 'user',
          content: 'minha obstetra pediu a vacina da coqueluche, vocês aplicam?',
          minutesAgo: 3,
        },
        {
          role: 'assistant',
          content:
            'Oi Renata! Parabéns pela gestação 💙 Sim, aplicamos a dTpa (tríplice bacteriana acelular) recomendada para gestantes. Quer que eu peça para nossa equipe confirmar os horários disponíveis?',
          minutesAgo: 2,
        },
      ],
    },
    // 6. IA atendendo — sobre pacote
    {
      id: DEMO.conversations.carolina,
      patientId: DEMO.patients.carolina,
      status: 'active',
      messages: [
        { role: 'user', content: 'oi, vi no instagram de vocês sobre um pacote', minutesAgo: 9 },
        {
          role: 'user',
          content: 'quanto custa e o que inclui?',
          minutesAgo: 9,
        },
        {
          role: 'assistant',
          content:
            'Oi Carolina! 💙 O pacote 2 a 6 meses cobre todas as vacinas dessa fase:\n\n• Hexavalente — 3 doses\n• Pneumo 20 — 3 doses\n• Rotavírus — 3 doses\n• ACWY — 2 doses\n• Meningo B — 2 doses\n\nÀ vista: R$ 5.067 (economia de ~8% vs avulso). Parcelado em 5x: R$ 5.549,06. Posso te enviar mais detalhes?',
          minutesAgo: 8,
        },
        { role: 'user', content: 'e se eu pegar em 12x?', minutesAgo: 5 },
      ],
    },
    // 7. Encerrada — fluxo completo
    {
      id: DEMO.conversations.fernanda,
      patientId: DEMO.patients.fernanda,
      status: 'closed',
      assignedToUserId: admin.id,
      messages: [
        { role: 'user', content: 'boa tarde, miguel tem 2 meses', minutesAgo: 24 * 60 },
        {
          role: 'assistant',
          content: 'Olá Fernanda! Quais são suas dúvidas sobre as vacinas do Miguel?',
          minutesAgo: 24 * 60 - 1,
        },
        {
          role: 'user',
          content: 'queria saber o valor de todas pra decidir se faço pacote',
          minutesAgo: 24 * 60 - 2,
        },
        {
          role: 'assistant',
          content:
            'Claro! As 3 principais aos 2 meses: hexa R$ 256, pneumo 20 R$ 489 e rotavírus R$ 312 = R$ 1.057. O pacote completo 2-6m fica em R$ 5.067 à vista (cobre todas as doses até os 6 meses).',
          minutesAgo: 24 * 60 - 3,
        },
        { role: 'user', content: 'vou fazer o pacote', minutesAgo: 24 * 60 - 20 },
        {
          role: 'human',
          content: 'Oi Fernanda! Agendei o Miguel para sábado 10h. Qualquer coisa me chama 💙',
          minutesAgo: 23 * 60,
        },
        { role: 'user', content: 'obrigada!', minutesAgo: 23 * 60 - 1 },
      ],
    },
    // 8. IA atendendo — gêmeas
    {
      id: DEMO.conversations.patricia,
      patientId: DEMO.patients.patricia,
      status: 'active',
      messages: [
        { role: 'user', content: 'oi tenho gêmeas de 4 meses', minutesAgo: 6 },
        {
          role: 'user',
          content: 'fazem 2ª dose das vacinas, tem desconto pra duas?',
          minutesAgo: 6,
        },
        {
          role: 'assistant',
          content:
            'Que delícia, parabéns pela Alice e Laura! 💙 Vou pedir para a equipe te passar uma condição especial por serem gêmeas. Um momento!',
          minutesAgo: 5,
        },
      ],
    },
  ];

  for (const c of convs) {
    const lastMsgMin = c.messages[c.messages.length - 1]?.minutesAgo ?? 0;
    await prisma.conversation.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        tenantId,
        patientId: c.patientId,
        status: c.status,
        assignedToUserId: c.assignedToUserId ?? null,
        aiPausedUntil: c.aiPausedUntil ?? null,
        lastMessageAt: minutesAgo(lastMsgMin),
      },
      update: {
        status: c.status,
        assignedToUserId: c.assignedToUserId ?? null,
        aiPausedUntil: c.aiPausedUntil ?? null,
        lastMessageAt: minutesAgo(lastMsgMin),
      },
    });

    // Limpa e recria mensagens (idempotencia)
    await prisma.message.deleteMany({ where: { conversationId: c.id } });
    for (const m of c.messages) {
      await prisma.message.create({
        data: {
          conversationId: c.id,
          role: m.role,
          content: m.content,
          createdAt: minutesAgo(m.minutesAgo),
          metadata: m.role === 'human' ? { source: 'dashboard' } : {},
        },
      });
    }

    // Handoff quando necessario
    if (c.status === 'awaiting_handoff' && c.handoffSummary) {
      const existing = await prisma.handoff.findFirst({
        where: { conversationId: c.id, status: 'pending' },
      });
      if (!existing) {
        await prisma.handoff.create({
          data: {
            tenantId,
            conversationId: c.id,
            status: 'pending',
            summary: c.handoffSummary,
          },
        });
      }
    }
  }
  console.log(`✓ ${convs.length} conversas (fila + ativas + pausada + encerrada)`);

  // ───────────────────────── MÉTRICAS (14 dias) ─────────────────
  for (let d = 13; d >= 0; d--) {
    const date = daysAgo(d);
    date.setHours(0, 0, 0, 0);
    // Variabilidade realista: picos na segunda/quarta, queda no fim de semana
    const weekday = date.getDay();
    const base = weekday === 0 || weekday === 6 ? 8 : 18;
    const noise = Math.floor(Math.sin(d * 0.9) * 6);
    const total = base + noise + (d % 3 === 0 ? 4 : 0);
    const handoffs = Math.floor(total * 0.35);
    const converted = Math.floor(handoffs * 0.72);
    await prisma.metricSnapshot.upsert({
      where: { tenantId_date: { tenantId, date } },
      create: {
        tenantId,
        date,
        payload: {
          conversations: total,
          messagesIn: total * 4 + noise * 2,
          messagesOut: total * 3,
          handoffs,
          converted,
          avgResponseSeconds: 28 + (d % 5) * 3,
        } as Prisma.InputJsonValue,
      },
      update: {
        payload: {
          conversations: total,
          messagesIn: total * 4 + noise * 2,
          messagesOut: total * 3,
          handoffs,
          converted,
          avgResponseSeconds: 28 + (d % 5) * 3,
        } as Prisma.InputJsonValue,
      },
    });
  }
  console.log('✓ 14 dias de métricas');

  // ───────────────────────── CAMPANHAS ─────────────────────────
  const campaignFixtures: Array<{
    id: string;
    name: string;
    message: string;
    status: 'completed' | 'scheduled' | 'draft';
    totalTargets: number;
    sentCount: number;
    failedCount: number;
    scheduledFor?: Date;
    finishedAt?: Date;
  }> = [
    {
      id: '30000000-0000-0000-0000-000000000001',
      name: 'Lembrete mensal — Hexavalente 4m',
      message:
        '💙 Oi! O(a) pequeno(a) está completando 4 meses e já pode tomar a 2ª dose da hexavalente. Quer agendar?',
      status: 'completed',
      totalTargets: 142,
      sentCount: 138,
      failedCount: 4,
      finishedAt: daysAgo(3),
    },
    {
      id: '30000000-0000-0000-0000-000000000002',
      name: 'Campanha gripe 2026',
      message:
        '🍃 Chegou a época da gripe! Sua família já tomou a vacina deste ano? Temos horário na próxima semana.',
      status: 'scheduled',
      totalTargets: 487,
      sentCount: 0,
      failedCount: 0,
      scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: '30000000-0000-0000-0000-000000000003',
      name: 'Volta às aulas — reforço',
      message: '📚 Volta às aulas chegando! Confira se as vacinas do(a) seu(sua) filho(a) estão em dia.',
      status: 'draft',
      totalTargets: 0,
      sentCount: 0,
      failedCount: 0,
    },
  ];

  for (const c of campaignFixtures) {
    await prisma.campaign.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        tenantId,
        name: c.name,
        message: c.message,
        audience: 'all',
        status: c.status,
        totalTargets: c.totalTargets,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        scheduledFor: c.scheduledFor,
        finishedAt: c.finishedAt,
      },
      update: {
        name: c.name,
        message: c.message,
        status: c.status,
        totalTargets: c.totalTargets,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        scheduledFor: c.scheduledFor ?? null,
        finishedAt: c.finishedAt ?? null,
      },
    });
  }
  console.log(`✓ ${campaignFixtures.length} campanhas`);

  // ───────────────────────── AGENDAMENTOS ──────────────────────
  const appointments: Array<{
    id: string;
    patientId: string;
    scheduledFor: Date;
    status: 'scheduled' | 'attended' | 'paid' | 'no_show';
    vaccineSlugs: string[];
    expectedValue: number;
    paidValue?: number;
  }> = [
    {
      id: '40000000-0000-0000-0000-000000000001',
      patientId: DEMO.patients.juliana,
      scheduledFor: new Date(Date.now() + 18 * 60 * 60 * 1000), // amanhã 10h
      status: 'scheduled',
      vaccineSlugs: ['meningococica-acwy', 'meningococica-b'],
      expectedValue: 1078,
    },
    {
      id: '40000000-0000-0000-0000-000000000002',
      patientId: DEMO.patients.fernanda,
      scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // sábado
      status: 'scheduled',
      vaccineSlugs: ['hexavalente-acelular', 'pneumo-20', 'rotavirus-pentavalente'],
      expectedValue: 1057,
    },
    {
      id: '40000000-0000-0000-0000-000000000003',
      patientId: DEMO.patients.aline,
      scheduledFor: daysAgo(1),
      status: 'paid',
      vaccineSlugs: ['hexavalente-acelular', 'pneumo-20', 'rotavirus-pentavalente'],
      expectedValue: 1057,
      paidValue: 1057,
    },
    {
      id: '40000000-0000-0000-0000-000000000004',
      patientId: DEMO.patients.carolina,
      scheduledFor: daysAgo(5),
      status: 'paid',
      vaccineSlugs: ['hexavalente-acelular'],
      expectedValue: 256,
      paidValue: 256,
    },
    {
      id: '40000000-0000-0000-0000-000000000005',
      patientId: DEMO.patients.vanessa,
      scheduledFor: daysAgo(2),
      status: 'no_show',
      vaccineSlugs: ['hexavalente-acelular'],
      expectedValue: 256,
    },
  ];

  for (const a of appointments) {
    await prisma.appointment.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        tenantId,
        patientId: a.patientId,
        scheduledFor: a.scheduledFor,
        status: a.status,
        vaccineSlugs: a.vaccineSlugs,
        expectedValue: a.expectedValue,
        paidValue: a.paidValue,
      },
      update: {
        scheduledFor: a.scheduledFor,
        status: a.status,
        vaccineSlugs: a.vaccineSlugs,
        expectedValue: a.expectedValue,
        paidValue: a.paidValue ?? null,
      },
    });
  }
  console.log(`✓ ${appointments.length} agendamentos`);

  // ─────────────── PRONTUÁRIO (vacinas aplicadas + lembretes) ──
  const vaccs = await prisma.vaccine.findMany({ where: { tenantId } });
  const hexa = vaccs.find((v) => v.slug === 'hexavalente-acelular');
  const pneumo = vaccs.find((v) => v.slug === 'pneumo-20');

  const vaccinations = [
    // Aline: aplicou 1ª dose já
    {
      id: '50000000-0000-0000-0000-000000000001',
      patientId: DEMO.patients.aline,
      vaccineSlug: 'hexavalente-acelular',
      vaccineId: hexa?.id,
      dose: 1,
      appliedAt: daysAgo(120),
      nextDueAt: daysAgo(1),
    },
    {
      id: '50000000-0000-0000-0000-000000000002',
      patientId: DEMO.patients.aline,
      vaccineSlug: 'pneumo-20',
      vaccineId: pneumo?.id,
      dose: 1,
      appliedAt: daysAgo(120),
      nextDueAt: daysAgo(1),
    },
    // Camila: Helena tomou 1ª aos 2m
    {
      id: '50000000-0000-0000-0000-000000000003',
      patientId: DEMO.patients.camila,
      vaccineSlug: 'hexavalente-acelular',
      vaccineId: hexa?.id,
      dose: 1,
      appliedAt: daysAgo(60),
      nextDueAt: daysAgo(1),
    },
  ];

  for (const v of vaccinations) {
    await prisma.patientVaccination.upsert({
      where: { id: v.id },
      create: { ...v, tenantId },
      update: { appliedAt: v.appliedAt, nextDueAt: v.nextDueAt },
    });
  }

  const reminders = [
    {
      id: '60000000-0000-0000-0000-000000000001',
      patientId: DEMO.patients.camila,
      vaccineSlug: 'hexavalente-acelular',
      dose: 2,
      scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      message:
        '💙 Oi Camila! A Helena está pronta para a 2ª dose da hexavalente. Quer que eu confirme um horário?',
      status: 'scheduled' as const,
    },
    {
      id: '60000000-0000-0000-0000-000000000002',
      patientId: DEMO.patients.vanessa,
      vaccineSlug: 'hexavalente-acelular',
      dose: 1,
      scheduledFor: new Date(Date.now() + 6 * 60 * 60 * 1000),
      message:
        '⏰ Oi Vanessa! O Arthur já passou da idade da 1ª dose da hexavalente. Vamos agendar para regularizar?',
      status: 'scheduled' as const,
    },
  ];

  for (const r of reminders) {
    await prisma.vaccinationReminder.upsert({
      where: { id: r.id },
      create: { ...r, tenantId },
      update: { scheduledFor: r.scheduledFor, status: r.status },
    });
  }
  console.log(`✓ ${vaccinations.length} vacinas aplicadas + ${reminders.length} lembretes`);

  console.log('\n✨ Demo seed concluído. Sistema pronto para apresentação.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
