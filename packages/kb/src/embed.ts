import { embed, type createOpenAI } from '@imuniza/ai';
import { prisma } from '@imuniza/db';
import { chunkText } from './chunker.js';

export interface IndexDocumentInput {
  documentId: string;
  ai: ReturnType<typeof createOpenAI>;
}

export async function indexDocument({ documentId, ai }: IndexDocumentInput): Promise<number> {
  const doc = await prisma.kBDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`KBDocument ${documentId} não encontrado`);

  await prisma.kBChunk.deleteMany({ where: { documentId } });

  const chunks = chunkText(doc.content);
  if (chunks.length === 0) return 0;

  const embeddings = await embed(
    ai,
    chunks.map((c) => c.content),
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const vector = embeddings[i];
    if (!vector) continue;

    const created = await prisma.kBChunk.create({
      data: {
        documentId,
        content: chunk.content,
        metadata: { index: chunk.index, documentTitle: doc.title },
      },
    });

    const literal = `[${vector.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE kb_chunks SET embedding = $1::vector WHERE id = $2::uuid`,
      literal,
      created.id,
    );
  }

  return chunks.length;
}
