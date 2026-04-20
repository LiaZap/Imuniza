import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import mammoth from 'mammoth';
import { prisma } from '@imuniza/db';
import { indexDocument } from '@imuniza/kb';
import { ai } from '../services/openai.js';
import { getDefaultTenantId } from '../services/tenant.js';

async function main() {
  const [, , filePath, ...titleParts] = process.argv;
  if (!filePath) {
    console.error('Uso: pnpm --filter @imuniza/api ingest:docx <caminho.docx> [título]');
    process.exit(1);
  }

  const buffer = await readFile(filePath);
  const extracted = await mammoth.extractRawText({ buffer });
  const content = extracted.value.trim();
  if (!content) throw new Error('Arquivo .docx está vazio ou não pôde ser extraído.');

  const tenantId = await getDefaultTenantId();
  const title = titleParts.join(' ').trim() || basename(filePath, '.docx');

  const doc = await prisma.kBDocument.create({
    data: {
      tenantId,
      title,
      source: `docx:${basename(filePath)}`,
      content,
    },
  });

  const count = await indexDocument({ documentId: doc.id, ai });
  console.log(`Documento "${title}" criado (${doc.id}) com ${count} chunks.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
