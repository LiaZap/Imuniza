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

export type SendMediaKind = 'image' | 'audio' | 'video' | 'document';

export interface SendMediaInput {
  number: string;
  kind: SendMediaKind;
  /** URL pública, caminho do arquivo ou base64 aceito pela Uazapi. */
  file: string;
  /** Texto acompanhante (caption para imagem/vídeo, corpo para documento). */
  text?: string;
  /** Nome exibido quando kind === 'document'. */
  filename?: string;
  delayMs?: number;
}

export type SendMediaResponse = SendTextResponse;

export type InstanceConnectionState =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'pairing'
  | 'unknown';

export interface InstanceStatus {
  state: InstanceConnectionState;
  /** QR code em data URL ou base64 puro, quando disponível. */
  qrcode?: string;
  /** Código de pareamento curto (8 chars), quando disponível. */
  pairCode?: string;
  /** Telefone conectado (E.164 sem +). */
  phone?: string;
  profileName?: string;
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
