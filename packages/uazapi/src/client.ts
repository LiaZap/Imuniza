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
      EventType?: string;
      event?: string;
      chat?: {
        name?: string;
        wa_name?: string;
        wa_contactName?: string;
        lead_fullName?: string;
        lead_name?: string;
        wa_isGroup?: boolean;
      };
      message?: {
        id?: string;
        messageid?: string;
        chatid?: string;
        sender_pn?: string;
        senderName?: string;
        fromMe?: boolean;
        isGroup?: boolean;
        type?: string;
        messageType?: string;
        mediaType?: string;
        content?: string;
        text?: string;
        caption?: string;
        fileName?: string;
        mimeType?: string;
        mimetype?: string;
        fileURL?: string;
        mediaURL?: string;
        url?: string;
        seconds?: number;
        messageTimestamp?: number | string;
      };
    };

    const msg = envelope?.message;
    if (!msg) return null;

    // Ignorar ecos da própria instância
    if (msg.fromMe) return null;

    // Ignorar mensagens de grupo (o bot é 1:1 por enquanto)
    if (msg.isGroup || envelope.chat?.wa_isGroup) return null;

    // Extrair telefone: chatid = "5511xxx@s.whatsapp.net" → "5511xxx"
    const rawFrom = msg.sender_pn ?? msg.chatid ?? '';
    const from = rawFrom.replace(/@.*/, '').replace(/:\d+$/, '');
    if (!from) return null;

    // Tipo de mídia — Uazapi usa 'type' (text/image/audio/video/document)
    // ou 'messageType' (Conversation/ImageMessage/AudioMessage/...)
    const rawType = (msg.type ?? '').toLowerCase();
    const rawMessageType = (msg.messageType ?? '').toLowerCase();
    const mediaTypeLower = (msg.mediaType ?? '').toLowerCase();

    const isText =
      rawType === 'text' ||
      rawMessageType === 'conversation' ||
      rawMessageType === 'extendedtextmessage';
    const isAudio =
      rawType === 'audio' ||
      rawType === 'ptt' ||
      rawMessageType.includes('audio') ||
      mediaTypeLower === 'audio';
    const isImage =
      rawType === 'image' || rawMessageType.includes('image') || mediaTypeLower === 'image';
    const isVideo =
      rawType === 'video' || rawMessageType.includes('video') || mediaTypeLower === 'video';
    const isDocument =
      rawType === 'document' ||
      rawMessageType.includes('document') ||
      mediaTypeLower === 'document';

    let text = msg.text ?? (isText ? msg.content : '') ?? '';
    let media: InboundMessage['media'];

    const mediaUrl = msg.fileURL ?? msg.mediaURL ?? msg.url;
    const mime = msg.mimeType ?? msg.mimetype;

    if (isAudio) {
      media = { kind: 'audio' as InboundMediaKind, mimetype: mime, url: mediaUrl, seconds: msg.seconds };
      if (!text) text = '[áudio]';
    } else if (isImage) {
      media = { kind: 'image' as InboundMediaKind, mimetype: mime, url: mediaUrl, caption: msg.caption };
      if (!text) text = msg.caption ?? '[imagem]';
    } else if (isVideo) {
      media = { kind: 'video' as InboundMediaKind, mimetype: mime, url: mediaUrl, caption: msg.caption };
      if (!text) text = msg.caption ?? '[vídeo]';
    } else if (isDocument) {
      media = { kind: 'document' as InboundMediaKind, mimetype: mime, url: mediaUrl };
      if (!text) text = msg.fileName ?? '[documento]';
    }

    if (!text && !media) return null;

    // Uazapi manda timestamp em ms. InboundMessage usa segundos.
    const rawTs =
      typeof msg.messageTimestamp === 'string'
        ? Number.parseInt(msg.messageTimestamp, 10)
        : (msg.messageTimestamp ?? Date.now());
    const timestamp = rawTs > 1e12 ? Math.floor(rawTs / 1000) : rawTs;

    const pushName =
      msg.senderName ||
      envelope.chat?.lead_fullName ||
      envelope.chat?.lead_name ||
      envelope.chat?.wa_contactName ||
      envelope.chat?.wa_name ||
      envelope.chat?.name;

    return {
      id: msg.messageid ?? msg.id ?? '',
      from,
      text,
      pushName: pushName || undefined,
      timestamp,
      media,
      raw: payload,
    };
  }
}

export function createUazapiClient(config: UazapiConfig): UazapiClient {
  return new UazapiClient(config);
}
