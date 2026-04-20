import type { createOpenAI } from './openai.js';

/**
 * Transcreve um áudio via Whisper.
 * `mimetype` é usado para escolher a extensão no upload multipart.
 */
export async function transcribeAudio(
  ai: ReturnType<typeof createOpenAI>,
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
  const ext = mimetype.includes('ogg')
    ? 'ogg'
    : mimetype.includes('mp4') || mimetype.includes('m4a')
      ? 'm4a'
      : mimetype.includes('wav')
        ? 'wav'
        : 'mp3';
  const file = new File([new Uint8Array(buffer)], `audio.${ext}`, { type: mimetype });
  const res = await ai.client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'pt',
    response_format: 'text',
  });
  // SDK pode retornar string ou objeto { text }
  if (typeof res === 'string') return res.trim();
  const maybe = res as unknown as { text?: string };
  return (maybe.text ?? '').trim();
}

export interface ExtractedVaccination {
  vaccineName: string;
  dose?: number | null;
  appliedAt?: string | null;
  lot?: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface VaccineCardExtraction {
  vaccinations: ExtractedVaccination[];
  babyName?: string | null;
  birthDate?: string | null;
  generalNotes?: string | null;
}

const VACCINE_CARD_PROMPT = `Você está recebendo uma foto de uma carteira de vacinação brasileira (ou documento similar).
Extraia as informações em JSON estrito com este formato:
{
  "vaccinations": [
    {"vaccineName":"...","dose":1,"appliedAt":"YYYY-MM-DD","lot":"...","confidence":"high|medium|low"}
  ],
  "babyName": "...",
  "birthDate": "YYYY-MM-DD",
  "generalNotes": "observações livres ou null"
}

Regras:
- Inclua somente vacinas com selo/carimbo/registro visível aplicado.
- Se a data estiver ilegível, use null em appliedAt e confidence="low".
- Se for um documento que NÃO é carteira de vacinação, retorne { "vaccinations": [] }.
- Não invente dados. Nunca inclua comentários fora do JSON.`;

/**
 * Usa GPT-4o com visão para extrair vacinas de uma imagem de carteirinha.
 * Retorna null se o modelo indicar que não é uma carteira válida ou em erro.
 */
export async function extractVaccineCard(
  ai: ReturnType<typeof createOpenAI>,
  imageBuffer: Buffer,
  mimetype: string,
): Promise<VaccineCardExtraction | null> {
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimetype || 'image/jpeg'};base64,${base64}`;

  const res = await ai.client.chat.completions.create({
    model: ai.chatModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Você é um extrator de dados de carteira de vacinação. Responda APENAS com JSON válido conforme o esquema.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: VACCINE_CARD_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
    temperature: 0.1,
  });

  const content = res.choices[0]?.message?.content?.trim();
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as VaccineCardExtraction;
    if (!Array.isArray(parsed.vaccinations)) return null;
    return parsed;
  } catch {
    return null;
  }
}
