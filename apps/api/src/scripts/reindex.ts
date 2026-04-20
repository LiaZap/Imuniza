import { prisma } from '@imuniza/db';
import { indexDocument } from '@imuniza/kb';
import { ai } from '../services/openai.js';

async function main() {
  const docs = await prisma.kBDocument.findMany({ where: { active: true } });
  console.log(`Reindexing ${docs.length} documents...`);

  for (const doc of docs) {
    const count = await indexDocument({ documentId: doc.id, ai });
    console.log(`  ${doc.title}: ${count} chunks`);
  }

  console.log('Done.');
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
