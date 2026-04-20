import { createOpenAI } from '@imuniza/ai';
import { env } from '../env.js';

export const ai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  chatModel: env.OPENAI_CHAT_MODEL,
  embeddingModel: env.OPENAI_EMBEDDING_MODEL,
});
