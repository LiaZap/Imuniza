export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
}

const APPROX_CHARS_PER_TOKEN = 4;

export interface Chunk {
  content: string;
  index: number;
}

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const targetChars = (options.targetTokens ?? 500) * APPROX_CHARS_PER_TOKEN;
  const overlapChars = (options.overlapTokens ?? 60) * APPROX_CHARS_PER_TOKEN;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push({ content: trimmed, index: chunks.length });
    buffer = overlapChars > 0 ? trimmed.slice(-overlapChars) : '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > targetChars) {
      if (buffer) flush();
      for (let i = 0; i < paragraph.length; i += targetChars - overlapChars) {
        const slice = paragraph.slice(i, i + targetChars);
        chunks.push({ content: slice, index: chunks.length });
      }
      buffer = '';
      continue;
    }

    if ((buffer + '\n\n' + paragraph).length > targetChars && buffer) {
      flush();
    }

    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }

  flush();
  return chunks;
}
