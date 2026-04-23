/**
 * Helpers para respeitar silentHours / businessHours do tenant ao decidir
 * se a IA responde ou nao.
 */

export interface SilentHoursConfig {
  enabled?: boolean;
  start?: string; // HH:mm
  end?: string; // HH:mm
  offlineMessage?: string;
}

/** Retorna true se o horario atual (local do servidor) esta dentro da janela silenciosa. */
export function isInSilentWindow(
  silent: SilentHoursConfig | undefined,
  now: Date = new Date(),
): boolean {
  if (!silent?.enabled || !silent.start || !silent.end) return false;
  const [startH = 0, startM = 0] = silent.start.split(':').map((v) => Number(v));
  const [endH = 0, endM = 0] = silent.end.split(':').map((v) => Number(v));
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const minutesStart = startH * 60 + startM;
  const minutesEnd = endH * 60 + endM;
  // Janela que cruza meia-noite (ex.: 22:00 a 07:00)
  if (minutesStart > minutesEnd) {
    return minutesNow >= minutesStart || minutesNow < minutesEnd;
  }
  return minutesNow >= minutesStart && minutesNow < minutesEnd;
}

/** Mensagem padrao quando o tenant nao configurou offlineMessage. */
export const DEFAULT_OFFLINE_MESSAGE =
  'Oi! No momento estamos fora do horário de atendimento. ' +
  'Assim que a equipe estiver disponível voltamos a conversar com você 💙';
