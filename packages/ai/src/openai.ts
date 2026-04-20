import OpenAI from 'openai';

export interface OpenAIConfig {
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
}

export function createOpenAI(config: OpenAIConfig) {
  const client = new OpenAI({ apiKey: config.apiKey });
  return {
    client,
    chatModel: config.chatModel,
    embeddingModel: config.embeddingModel,
  };
}

export async function embed(
  ai: ReturnType<typeof createOpenAI>,
  inputs: string[],
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const res = await ai.client.embeddings.create({
    model: ai.embeddingModel,
    input: inputs,
  });
  return res.data.map((d) => d.embedding);
}
