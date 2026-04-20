export interface UazapiConfig {
  baseUrl: string;
  token: string;
  instance?: string;
}

export interface SendTextInput {
  number: string;
  text: string;
  delayMs?: number;
}

export interface SendTextResponse {
  id: string;
  status: string;
  raw?: unknown;
}

export type InboundMediaKind = 'audio' | 'image' | 'document' | 'video';

export interface InboundMessage {
  id: string;
  from: string;
  text: string;
  pushName?: string;
  timestamp: number;
  media?: {
    kind: InboundMediaKind;
    mimetype?: string;
    url?: string;
    caption?: string;
    seconds?: number;
  };
  raw: unknown;
}

export interface DownloadedMedia {
  mimetype: string;
  buffer: Buffer;
}
