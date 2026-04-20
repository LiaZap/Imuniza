import 'dotenv/config';
import { loadEnv } from '@imuniza/shared/env';

export const env = loadEnv(process.env);
