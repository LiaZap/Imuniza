-- Aplicar APÓS a primeira `prisma migrate dev`.
-- Cria o índice HNSW para busca vetorial (cosine distance) em kb_chunks.
-- Prisma não gera índices de vector nativamente, então rodamos manualmente.

CREATE INDEX IF NOT EXISTS kb_chunks_embedding_hnsw_idx
  ON kb_chunks
  USING hnsw (embedding vector_cosine_ops);
