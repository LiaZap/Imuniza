import { embed, type createOpenAI } from '@imuniza/ai';
import { prisma } from '@imuniza/db';

export interface SearchInput {
  tenantId: string;
  query: string;
  topK?: number;
  ai: ReturnType<typeof createOpenAI>;
}

export interface SearchResult {
  chunkId: string;
  content: string;
  documentTitle: string;
  distance: number;
}

export async function searchKB({
  tenantId,
  query,
  topK = 4,
  ai,
}: SearchInput): Promise<SearchResult[]> {
  const [vector] = await embed(ai, [query]);
  if (!vector) return [];

  const literal = `[${vector.join(',')}]`;

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; content: string; title: string; distance: number }>
  >(
    `SELECT c.id, c.content, d.title, c.embedding <=> $1::vector AS distance
     FROM kb_chunks c
     JOIN kb_documents d ON d.id = c."documentId"
     WHERE d."tenantId" = $2::uuid AND d.active = true AND c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    literal,
    tenantId,
    topK,
  );

  return rows.map((r) => ({
    chunkId: r.id,
    content: r.content,
    documentTitle: r.title,
    distance: Number(r.distance),
  }));
}
