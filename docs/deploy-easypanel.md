# Deploy no Easypanel

Guia passo-a-passo para subir o Imuniza em produção usando Easypanel (VPS com Docker).

## Pré-requisitos

- VPS com Docker + Easypanel instalado (Hetzner, DigitalOcean, Contabo...)
- Domínio com DNS apontando para a VPS (ex: `imuniza.suaclinica.com.br` e `api.imuniza.suaclinica.com.br`)
- Conta OpenAI com API key (billing ativo)
- Conta Uazapi com instância criada e token

## Visão geral

Serão 4 serviços no mesmo projeto Easypanel:

| Serviço | Origem | Domínio | Porta |
|---------|--------|---------|-------|
| `postgres` | imagem `pgvector/pgvector:pg16` | interno | 5432 |
| `redis` | imagem `redis:7-alpine` | interno | 6379 |
| `api` | build do `apps/api/Dockerfile` | `api.imuniza...` | 3001 |
| `dashboard` | build do `apps/dashboard/Dockerfile` | `imuniza...` | 3000 |

## Passo 1 — Preparar o repositório no GitHub

```bash
cd C:/Users/Paulo/Documents/imuniza
git add -A
git commit -m "Prepare production deploy"
git remote add origin git@github.com:seu-usuario/imuniza.git
git push -u origin master
```

## Passo 2 — Criar o projeto no Easypanel

1. No Easypanel, clique em **"Create Project"** e nomeie como `imuniza`.
2. Dentro do projeto, adicione os 4 serviços abaixo.

## Passo 3 — Serviço `postgres`

- **Type:** App → **Source:** Docker Image
- **Image:** `pgvector/pgvector:pg16`
- **Environment:**
  ```
  POSTGRES_USER=imuniza
  POSTGRES_PASSWORD=<gerar-senha-forte>
  POSTGRES_DB=imuniza
  ```
- **Volumes:** `/var/lib/postgresql/data` → `postgres_data`
- **Expose Port:** nenhum (acesso interno apenas via rede do projeto)

Anote a senha — será usada pela API.

## Passo 4 — Serviço `redis`

- **Type:** App → **Source:** Docker Image
- **Image:** `redis:7-alpine`
- **Volumes:** `/data` → `redis_data`
- **Expose Port:** nenhum

## Passo 5 — Serviço `api`

- **Type:** App → **Source:** GitHub
- **Repository:** `seu-usuario/imuniza`
- **Branch:** `master`
- **Build Method:** Dockerfile
- **Dockerfile Path:** `apps/api/Dockerfile`
- **Build Context:** `/` (raiz do repositório)
- **Environment:**
  ```
  NODE_ENV=production
  DATABASE_URL=postgresql://imuniza:<senha>@imuniza_postgres:5432/imuniza
  REDIS_URL=redis://imuniza_redis:6379
  OPENAI_API_KEY=sk-proj-...
  OPENAI_CHAT_MODEL=gpt-4o
  OPENAI_EMBEDDING_MODEL=text-embedding-3-small
  UAZAPI_URL=https://seu-host.uazapi.com
  UAZAPI_TOKEN=seu-token
  UAZAPI_INSTANCE=seu-instance
  UAZAPI_WEBHOOK_SECRET=<gerar-secret-32+>
  API_PORT=3001
  API_BASE_URL=https://api.imuniza.suaclinica.com.br
  DASHBOARD_BASE_URL=https://imuniza.suaclinica.com.br
  AUTH_SECRET=<openssl rand -base64 32>
  AUTH_URL=https://imuniza.suaclinica.com.br
  DEFAULT_TENANT_NAME=Clínica Imuniza
  DEFAULT_ADMIN_EMAIL=admin@suaclinica.com.br
  DEFAULT_ADMIN_PASSWORD=<senha-inicial-trocar-depois>
  ```

> Os nomes `imuniza_postgres` / `imuniza_redis` são os hostnames internos do Easypanel — ajuste se o seu projeto se chamar diferente.

- **Domain:** `api.imuniza.suaclinica.com.br` → porta `3001`
- **Health Check:** `/health/ready`

## Passo 6 — Serviço `dashboard`

- **Type:** App → **Source:** GitHub (mesmo repo)
- **Dockerfile Path:** `apps/dashboard/Dockerfile`
- **Build Context:** `/`
- **Environment:**
  ```
  NODE_ENV=production
  API_BASE_URL=http://imuniza_api:3001
  ```
- **Domain:** `imuniza.suaclinica.com.br` → porta `3000`

## Passo 7 — Inicializar o banco

Após o primeiro deploy do `api`, abra o terminal web do serviço no Easypanel e rode:

```bash
# 1. Aplicar migrações
pnpm --filter @imuniza/db db:deploy

# 2. Criar o índice HNSW (uma única vez após a 1ª migração)
cat packages/db/prisma/migrations/post-migrate.sql | \
  PGPASSWORD=$POSTGRES_PASSWORD psql \
  -h imuniza_postgres -U imuniza -d imuniza

# 3. Rodar o seed (tenant, admin, vacinas do pacote 2-6m)
pnpm db:seed

# 4. Gerar embeddings da base de conhecimento inicial
pnpm --filter @imuniza/api reindex
```

Nota: como a imagem de runtime usa `tsx`, os scripts `pnpm` funcionam se você adicionar o `pnpm` na imagem. Alternativa rápida: rode tudo local apontando `DATABASE_URL` para o Postgres de produção (via túnel) uma única vez.

## Passo 8 — Configurar o webhook da Uazapi

No painel da Uazapi, aponte o webhook da instância para:

```
POST https://api.imuniza.suaclinica.com.br/webhook/uazapi
Header: x-webhook-secret: <mesmo valor de UAZAPI_WEBHOOK_SECRET>
```

## Passo 9 — Testar

1. Acesse `https://imuniza.suaclinica.com.br` → deve redirecionar para `/login`.
2. Entre com `admin@suaclinica.com.br` + senha configurada.
3. Envie uma mensagem para o número WhatsApp conectado à Uazapi — em alguns segundos deve chegar resposta da IA.
4. Verifique `/metrics/overview` e a fila em `/queue`.

## Atualizando após push

Easypanel detecta pushes no branch configurado e rebuilda automaticamente. Para forçar:

- Abra o serviço `api` ou `dashboard` → **Deploy** → **Rebuild**.

Se houver nova migração Prisma, rode `pnpm --filter @imuniza/db db:deploy` no terminal do `api` após o deploy.

## Rollback

Easypanel guarda imagens das builds anteriores. Use **"Deployments" → selecionar build antigo → Redeploy**.

## Backups

Configure backup automático do volume `postgres_data` (Easypanel → Backups). Recomendado diário com retenção de 30 dias.
