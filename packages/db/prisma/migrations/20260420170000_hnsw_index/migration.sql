-- HNSW index for vector similarity search (cosine) on KB chunk embeddings.
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_hnsw_idx
  ON kb_chunks
  USING hnsw (embedding vector_cosine_ops);
