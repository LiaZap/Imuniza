import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '@imuniza/db';

const queryScheme = z.object({
  year: z.coerce.number().int().min(2000).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
});

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/monthly', async (req, reply) => {
    const tenantId = req.session!.tenantId;
    const { year, month } = queryScheme.parse(req.query);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [tenant, messages, handoffs, patients, closed, vaccinations] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.message.count({
        where: {
          createdAt: { gte: start, lt: end },
          conversation: { tenantId },
        },
      }),
      prisma.handoff.count({ where: { tenantId, createdAt: { gte: start, lt: end } } }),
      prisma.patient.count({ where: { tenantId, createdAt: { gte: start, lt: end } } }),
      prisma.conversation.count({
        where: { tenantId, status: 'closed', updatedAt: { gte: start, lt: end } },
      }),
      prisma.patientVaccination.count({
        where: { tenantId, appliedAt: { gte: start, lt: end } },
      }),
    ]);

    const monthName = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fillColor('#10473b').fontSize(24).text(tenant?.name ?? 'Clínica', { align: 'left' });
    doc.fontSize(12).fillColor('#1f7a66').text('Relatório mensal', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(18).fillColor('#0f172a').text(monthName, { align: 'left' });
    doc.moveDown(1.2);

    doc.fillColor('#64748b').fontSize(10).text('Resumo operacional', { underline: true });
    doc.moveDown(0.5);

    const rows: Array<[string, number]> = [
      ['Mensagens totais', messages],
      ['Encaminhamentos para humano', handoffs],
      ['Pacientes novos', patients],
      ['Conversas encerradas', closed],
      ['Vacinas aplicadas (registradas)', vaccinations],
    ];

    doc.fillColor('#0f172a').fontSize(12);
    for (const [label, value] of rows) {
      doc.text(`${label}:`, { continued: true }).fillColor('#1f7a66').text(`  ${value}`, { align: 'left' });
      doc.fillColor('#0f172a');
      doc.moveDown(0.2);
    }

    doc.moveDown(1);
    doc
      .fontSize(10)
      .fillColor('#64748b')
      .text(
        'Este relatório foi gerado automaticamente pela plataforma Imuniza. ' +
          'Dados pessoais de pacientes não foram incluídos em conformidade com a LGPD.',
        { align: 'left' },
      );

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'right' });

    doc.end();
    const buffer = await done;

    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="imuniza-${year}-${String(month).padStart(2, '0')}.pdf"`,
      )
      .send(buffer);
  });
}
