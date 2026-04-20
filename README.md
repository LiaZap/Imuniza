# Imuniza

Plataforma de IA para atendimento humanizado de vacinação via WhatsApp, com dashboard de gestão, base de conhecimento e fila de agendamentos.

## Stack

- **Backend:** Node.js + TypeScript + Fastify + BullMQ (Redis)
- **Frontend:** Next.js 15 + Tailwind + shadcn/ui + Recharts
- **Banco:** PostgreSQL 16 + pgvector (RAG) + Prisma ORM
- **IA:** OpenAI (gpt-4o + text-embedding-3-small)
- **WhatsApp:** Uazapi API (webhook)
- **Monorepo:** pnpm workspaces + Turborepo
- **Deploy:** Easypanel (Docker)

## Estrutura

```
imuniza/
├── apps/
│   ├── api/          # Fastify backend (webhook, workers, API admin)
│   └── dashboard/    # Next.js (fila, métricas, KB, vacinas)
├── packages/
│   ├── db/           # Prisma schema + client + seed
│   ├── shared/       # Env loader + zod schemas
│   ├── uazapi/       # Cliente Uazapi
│   ├── ai/           # OpenAI wrapper, prompts, function defs
│   └── kb/           # Chunker, embeddings, busca vetorial
├── docker-compose.yml
└── .env.example
```

## Setup inicial

### 1. Pré-requisitos

- Node.js 20+ (testado com 24)
- pnpm 10+
- Docker + Docker Compose
- Conta OpenAI e Uazapi com credenciais

### 2. Variáveis de ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais reais (OPENAI_API_KEY, UAZAPI_*, AUTH_SECRET).
```

### 3. Instalar dependências

```bash
pnpm install
```

### 4. Subir infraestrutura (Postgres + Redis)

```bash
pnpm docker:up
```

### 5. Gerar client Prisma e rodar migrações

```bash
pnpm db:generate
pnpm db:migrate          # primeira vez: crie uma migração chamada "init"
```

### 6. Aplicar índice HNSW (pgvector)

Após a primeira migração, rode o SQL que cria o índice vetorial:

```bash
docker exec -i imuniza-postgres psql -U imuniza -d imuniza \
  < packages/db/prisma/migrations/post-migrate.sql
```

### 7. Seed inicial (tenant, admin, vacinas do pacote 2–6 meses)

```bash
pnpm db:seed
```

### 8. Rodar em dev

```bash
pnpm dev
```

- API: http://localhost:3001/health
- Dashboard: http://localhost:3000

## Scripts úteis

| Comando | Ação |
|---------|------|
| `pnpm dev` | Sobe api + dashboard em watch |
| `pnpm build` | Build de todos os pacotes |
| `pnpm typecheck` | Checa tipos |
| `pnpm db:studio` | Abre Prisma Studio |
| `pnpm db:seed` | Re-executa o seed |
| `pnpm docker:up/down/logs` | Gerencia containers dev |

## Roadmap (25 dias — ver `C:\Users\Paulo\.claude\plans\foamy-forging-orbit.md`)

- [x] **Sprint 1 (dias 1–5):** Fundação — monorepo, infra, Prisma, seed, API+Dashboard boilerplate
- [x] **Sprint 2 (dias 6–10):** Webhook Uazapi + worker OpenAI + RAG (pgvector) + ingestão do docx
- [x] **Sprint 3 (dias 11–15):** Perfil do paciente, recomendação, handoff para fila humana, SSE
- [x] **Sprint 4 (dias 16–20):** Dashboard completo — auth, fila, chat, métricas, CRUD de KB e vacinas
- [x] **Sprint 5 (dias 21–25):** Dockerfiles prod, docker-compose.prod, deploy Easypanel, LGPD, CI, docs

## Ingestão da base de conhecimento

### Reindexar documentos existentes (gera embeddings)

Requer `OPENAI_API_KEY` válida no `.env`.

```bash
pnpm --filter @imuniza/api reindex
```

### Importar um novo .docx para a KB

```bash
pnpm --filter @imuniza/api ingest:docx "C:/caminho/para/IA (6M).docx" "Vacinas 2 a 6 meses"
```

Cria um `KBDocument`, faz chunking (~500 tokens/ chunk), gera embeddings e indexa no pgvector.

## Simulando um webhook de mensagem (teste local)

```bash
curl -X POST http://localhost:3001/webhook/uazapi \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: change-me" \
  -d '{
    "event": "messages.upsert",
    "data": {
      "key": { "remoteJid": "5511999998888@s.whatsapp.net", "fromMe": false, "id": "TEST1" },
      "message": { "conversation": "Quais vacinas meu bebe de 2 meses precisa tomar?" },
      "pushName": "Teste",
      "messageTimestamp": 1700000000
    }
  }'
```

Com credenciais reais (OpenAI + Uazapi), isso dispara o worker que processa a mensagem, roda o agent loop e envia resposta via WhatsApp.

## API do atendente (Sprint 3)

| Método | Rota | Função |
|--------|------|--------|
| `GET` | `/conversations?status=awaiting_handoff` | Lista conversas (filtro opcional), inclui paciente e última mensagem |
| `GET` | `/conversations/:id` | Detalhe com todas as mensagens, paciente e handoffs |
| `POST` | `/conversations/:id/assign` | Atendente assume a conversa (IA silencia). Body opcional: `{ "userId": "<uuid>" }`; sem userId usa o admin padrão |
| `POST` | `/conversations/:id/message` | Atendente envia mensagem via WhatsApp (role `human`). Body: `{ "text": "...", "userId": "<uuid>" }` |
| `POST` | `/conversations/:id/close` | Encerra a conversa e resolve handoff pendente |
| `GET` | `/events/conversations` | Stream SSE com eventos de domínio: `message.created`, `conversation.handoff_requested`, `conversation.assigned`, `conversation.closed` |
| `GET` | `/metrics/overview` | Contadores em tempo real (ativas, fila, atribuídas, fechadas hoje, msgs hoje) |
| `GET` | `/metrics/weekly` | Série de 7 dias `[ { date, messages, handoffs } ]` para Recharts |

### Testar o SSE

```bash
curl -N http://localhost:3001/events/conversations
```

## Documentação

- [docs/deploy-easypanel.md](docs/deploy-easypanel.md) — passo a passo de deploy em produção via Easypanel
- [docs/ops.md](docs/ops.md) — manual operacional (trocar persona, adicionar vacina, reindexar KB, criar atendente, backup, LGPD delete)
- [docs/lgpd.md](docs/lgpd.md) — base legal, dados tratados, consentimento, direitos do titular

## Observações

- **Preços e esquemas vacinais** ficam no banco (tabela `vaccines`), não no RAG, para evitar alucinação. A IA consulta via function calling `list_vaccines` / `recommend_vaccines`.
- **Multi-tenant-ready:** todas as tabelas de domínio têm `tenantId`. O MVP roda single-tenant com o tenant seedado.
- **LGPD:** consentimento é solicitado pela IA no primeiro contato; logs têm redaction de campos sensíveis; políticas de retenção em `docs/lgpd.md`.
- **Rodar em produção:** `docker compose -f docker-compose.prod.yml up -d --build` (ou usar Easypanel — ver guia).
