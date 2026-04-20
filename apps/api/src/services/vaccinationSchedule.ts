import { prisma } from '@imuniza/db';

/**
 * Computa a próxima data de dose com base nas idades indicadas da vacina
 * e na data de nascimento (ou data da aplicação atual se não houver birth).
 *
 * Heurística simples: a próxima idade indicada > idade da última dose aplicada.
 * Se houver data de nascimento no perfil do paciente, calcula a data exata.
 * Caso contrário, assume que a próxima dose acontece depois do intervalo padrão
 * entre idades indicadas (geralmente 2 meses).
 */
export async function computeNextDueDate(params: {
  vaccineSlug: string;
  appliedAt: Date;
  currentDose: number;
  babyAgeMonthsAtApplication?: number;
  babyBirthDate?: Date | null;
  tenantId: string;
}): Promise<Date | null> {
  const vaccine = await prisma.vaccine.findFirst({
    where: { tenantId: params.tenantId, slug: params.vaccineSlug, active: true },
  });
  if (!vaccine || vaccine.ageMonths.length === 0) return null;

  const sortedAges = [...vaccine.ageMonths].sort((a, b) => a - b);
  const nextDoseIndex = params.currentDose; // dose 1 já aplicada → próxima é sortedAges[1]
  if (nextDoseIndex >= sortedAges.length) return null;
  const nextAge = sortedAges[nextDoseIndex]!;

  if (params.babyBirthDate) {
    const next = new Date(params.babyBirthDate);
    next.setMonth(next.getMonth() + nextAge);
    return next;
  }

  // Sem data de nascimento: soma a diferença entre idades aplicadas
  if (typeof params.babyAgeMonthsAtApplication === 'number') {
    const diffMonths = nextAge - params.babyAgeMonthsAtApplication;
    if (diffMonths <= 0) return null;
    const next = new Date(params.appliedAt);
    next.setMonth(next.getMonth() + diffMonths);
    return next;
  }

  // Fallback: próximo intervalo entre idades indicadas (ex: 2m → 4m = 2 meses)
  const previousAge = sortedAges[nextDoseIndex - 1] ?? 0;
  const diff = nextAge - previousAge;
  const next = new Date(params.appliedAt);
  next.setMonth(next.getMonth() + diff);
  return next;
}

/**
 * Cria (ou substitui) o lembrete agendado para uma dose, por padrão 5 dias
 * antes da data prevista.
 */
export async function scheduleReminder(params: {
  tenantId: string;
  patientId: string;
  vaccineSlug: string;
  dose: number;
  nextDueAt: Date;
  vaccineName: string;
  patientName: string | null;
  daysBefore?: number;
}): Promise<void> {
  const daysBefore = params.daysBefore ?? 5;
  const scheduledFor = new Date(params.nextDueAt);
  scheduledFor.setDate(scheduledFor.getDate() - daysBefore);

  // Se já está no passado, agenda pra daqui 1h para não perder
  if (scheduledFor < new Date()) {
    scheduledFor.setTime(Date.now() + 60 * 60 * 1000);
  }

  const namePart = params.patientName ? `, ${params.patientName}` : '';
  const dateStr = params.nextDueAt.toLocaleDateString('pt-BR');
  const message =
    `Oi${namePart}! Passando pra lembrar que a dose ${params.dose} da ` +
    `${params.vaccineName} está prevista para ${dateStr}. Quer que eu te ajude ` +
    `a agendar? 💙`;

  // Remove qualquer reminder anterior ainda agendado para essa mesma dose
  await prisma.vaccinationReminder.deleteMany({
    where: {
      patientId: params.patientId,
      vaccineSlug: params.vaccineSlug,
      dose: params.dose,
      status: 'scheduled',
    },
  });

  await prisma.vaccinationReminder.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      vaccineSlug: params.vaccineSlug,
      dose: params.dose,
      scheduledFor,
      message,
    },
  });
}
