import { z } from 'zod';

export const PhoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Telefone no formato E.164 (ex: +5511999999999)');

export const PatientProfileSchema = z
  .object({
    babyAgeMonths: z.number().int().min(0).max(240).optional(),
    babyName: z.string().optional(),
    medicalConditions: z.array(z.string()).optional(),
    vaccineHistory: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
  .partial();

export type PatientProfile = z.infer<typeof PatientProfileSchema>;

export const VaccinePackageItemSchema = z.object({
  vaccineSlug: z.string(),
  doses: z.number().int().positive(),
});

export type VaccinePackageItem = z.infer<typeof VaccinePackageItemSchema>;

export const UazapiWebhookMessageSchema = z.object({
  event: z.string(),
  instance: z.string().optional(),
  data: z
    .object({
      key: z
        .object({
          remoteJid: z.string().optional(),
          fromMe: z.boolean().optional(),
          id: z.string().optional(),
        })
        .passthrough()
        .optional(),
      message: z
        .object({
          conversation: z.string().optional(),
          extendedTextMessage: z.object({ text: z.string() }).passthrough().optional(),
        })
        .passthrough()
        .optional(),
      pushName: z.string().optional(),
      messageTimestamp: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough()
    .optional(),
});

export type UazapiWebhookMessage = z.infer<typeof UazapiWebhookMessageSchema>;
