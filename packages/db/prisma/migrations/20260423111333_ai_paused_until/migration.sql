-- AlterTable: pausa da IA quando humano responde pelo numero real da clinica
ALTER TABLE "conversations" ADD COLUMN "aiPausedUntil" TIMESTAMP(3);

CREATE INDEX "conversations_aiPausedUntil_idx" ON "conversations"("aiPausedUntil");
