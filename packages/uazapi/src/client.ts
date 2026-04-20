import type {
  DownloadedMedia,
  InboundMediaKind,
  InboundMessage,
  SendTextInput,
  SendTextResponse,
  UazapiConfig,
} from './types.js';

export class UazapiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: UazapiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  async sendText(input: SendTextInput): Promise<SendTextResponse> {
    const res = await fetch(`${this.baseUrl}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        number: input.number,
        text: input.text,
        delay: input.delayMs ?? 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Uazapi send/text failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { messageid?: string; id?: string; status?: string };
    return {
      id: json.messageid ?? json.id ?? '',
      status: json.status ?? 'sent',
      raw: json,
    };
  }

  /**
   * Baixa a mídia de uma mensagem (áudio/imagem/doc/vídeo).
   * Tenta primeiro a URL direta contida no webhook (quando houver);
   * se falhar, chama o endpoint oficial da Uazapi que recupera + descriptografa.
   */
  async downloadMedia(params: {
    messageId: string;
    url?: string;
  }): Promise<DownloadedMedia> {
    if (params.url) {
      try {
        const res = await fetch(params.url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          return {
            mimetype: res.headers.get('content-type') ?? 'application/octet-stream',
            buffer,
          };
        }
      } catch {
        /* fall through */
      }
    }

    // Fallback para endpoint Uazapi (varia por versão). Tentamos dois formatos comuns.
    const endpoints = [
      `${this.baseUrl}/message/downloadMedia`,
      `${this.baseUrl}/messages/download`,
    ];

    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: this.token },
        body: JSON.stringify({ id: params.messageId, messageid: params.messageId }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as {
        file?: string;
        base64?: string;
        mimetype?: string;
      };
      const b64 = body.file ?? body.base64;
      if (b64) {
        return {
          mimetype: body.mimetype ?? 'application/octet-stream',
          buffer: Buffer.from(b64, 'base64'),
        };
      }
    }

    throw new Error(`Uazapi media download failed for message ${params.messageId}`);
  }

  parseInbound(payload: unknown): InboundMessage | null {
    const envelope = payload as {
      event?: string;
      data?: {
        key?: { remoteJid?: string; fromMe?: boolean; id?: string };
        message?: {
          conversation?: string;
          extendedTextMessage?: { text?: string };
          audioMessage?: { url?: string; mimetype?: string; seconds?: number };
          imageMessage?: { url?: string; mimetype?: string; caption?: string };
          videoMessage?: { url?: string; mimetype?: string; caption?: string };
          documentMessage?: { url?: string; mimetype?: string; fileName?: string };
        };
        pushName?: string;
        messageTimestamp?: number | string;
      };
    };

    const data = envelope?.data;
    if (!data?.key?.remoteJid || data.key.fromMe) return null;
    const msg = data.message ?? {};

    let text = msg.conversation ?? msg.extendedTextMessage?.text ?? '';
    let media: InboundMessage['media'];

    if (msg.audioMessage) {
      media = {
        kind: 'audio' as InboundMediaKind,
        mimetype: msg.audioMessage.mimetype,
        url: msg.audioMessage.url,
        seconds: msg.audioMessage.seconds,
      };
      if (!text) text = '[áudio]';
    } else if (msg.imageMessage) {
      media = {
        kind: 'image' as InboundMediaKind,
        mimetype: msg.imageMessage.mimetype,
        url: msg.imageMessage.url,
        caption: msg.imageMessage.caption,
      };
      if (!text) text = msg.imageMessage.caption ?? '[imagem]';
    } else if (msg.videoMessage) {
      media = {
        kind: 'video' as InboundMediaKind,
        mimetype: msg.videoMessage.mimetype,
        url: msg.videoMessage.url,
        caption: msg.videoMessage.caption,
      };
      if (!text) text = msg.videoMessage.caption ?? '[vídeo]';
    } else if (msg.documentMessage) {
      media = {
        kind: 'document' as InboundMediaKind,
        mimetype: msg.documentMessage.mimetype,
        url: msg.documentMessage.url,
      };
      if (!text) text = msg.documentMessage.fileName ?? '[documento]';
    }

    if (!text && !media) return null;

    const timestamp =
      typeof data.messageTimestamp === 'string'
        ? Number.parseInt(data.messageTimestamp, 10)
        : (data.messageTimestamp ?? Math.floor(Date.now() / 1000));

    return {
      id: data.key.id ?? '',
      from: data.key.remoteJid.replace(/@.*/, ''),
      text,
      pushName: data.pushName,
      timestamp,
      media,
      raw: payload,
    };
  }
}

export function createUazapiClient(config: UazapiConfig): UazapiClient {
  return new UazapiClient(config);
}
