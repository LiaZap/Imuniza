import { createUazapiClient } from '@imuniza/uazapi';
import { env } from '../env.js';

export const uazapi = createUazapiClient({
  baseUrl: env.UAZAPI_URL,
  token: env.UAZAPI_TOKEN,
  instance: env.UAZAPI_INSTANCE || undefined,
});
