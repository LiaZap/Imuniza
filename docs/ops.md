# Manual de Operação

Runbook com as tarefas operacionais mais comuns. Destinado à equipe da clínica e/ou DevOps responsável pela plataforma.

## Acesso ao dashboard

- URL: `https://imuniza.suaclinica.com.br`
- Admin inicial: configurado via `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`. Troque a senha no primeiro login (roadmap — hoje, via Prisma Studio).

## Rotinas diárias do atendente

### 1. Atender um paciente da fila

1. Entrar no dashboard → **Fila**.
2. Conversas com status "Aguardando" aparecem com botão **Abrir**.
3. Clique **Abrir** → leia o resumo do handoff (em amarelo) e o histórico.
4. Clique **Assumir conversa** para silenciar a IA.
5. Use a caixa de texto para responder. A mensagem vai direto pelo WhatsApp.
6. Quando concluir, clique **Encerrar**.

### 2. Assumir sem clique de "Assumir"

Se você começar a digitar e enviar, o sistema auto-assume a conversa para você (atalho).

## Tarefas do admin

### Atualizar preços de vacinas

1. **Vacinas** → botão **Editar** na linha desejada.
2. Edite os campos. Slug deve permanecer estável (a IA referencia por slug).
3. **Salvar**. A IA passará a usar o novo preço imediatamente — **não precisa reindexar**.

### Adicionar uma vacina nova

1. **Vacinas** → preencha o form "Nova vacina" à direita.
2. Informe idades (meses separados por vírgula, ex: `12, 15`).
3. **Salvar**.

### Atualizar a base de conhecimento

#### Edição direta
1. **Base de conhecimento** → **Editar** no documento.
2. Ajuste o Markdown.
3. **Salvar**.
4. **Reindexar** — gera novos embeddings via OpenAI. Só depois disso a IA encontra via busca semântica.

#### Importar um novo `.docx` (via CLI)
No servidor da API:
```bash
pnpm --filter @imuniza/api ingest:docx "/caminho/arquivo.docx" "Título do documento"
```
Ele cria o documento já indexado.

### Trocar a persona / saudação da IA

**Configurações** (rota `/settings`, admin only). Altere persona, saudação e horário. Vale imediato para novas mensagens.

### Criar um atendente

Hoje, via SQL (roadmap: UI de usuários):

```sql
INSERT INTO users (id, "tenantId", email, name, "passwordHash", role, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants LIMIT 1),
  'atendente@suaclinica.com.br',
  'Maria Atendente',
  crypt('senha-inicial', gen_salt('bf', 10)),
  'attendant',
  true, NOW(), NOW()
);
```

O atendente deve trocar a senha no primeiro acesso (quando a UI de "trocar senha" chegar; por enquanto, ajuste via SQL).

## Resolução de problemas

### IA não está respondendo

1. Abra `/health/ready` no API — deve retornar `{"status":"ok","checks":{"db":"ok","redis":"ok"}}`.
2. Veja os logs do serviço `api` no Easypanel. Busque por `incoming_message job failed`.
3. Causas comuns:
   - `OPENAI_API_KEY` inválida ou sem créditos → trocar a chave.
   - Uazapi desconectada → ressincronizar no painel da Uazapi.
   - Redis caiu → reiniciar o serviço `redis`.

### Webhook não recebe mensagens

1. Confirme no painel da Uazapi que a URL é `https://api.<dominio>/webhook/uazapi` e o header `x-webhook-secret` está configurado.
2. Teste manualmente:
   ```bash
   curl -X POST https://api.imuniza.suaclinica.com.br/webhook/uazapi \
     -H "Content-Type: application/json" \
     -H "x-webhook-secret: $SECRET" \
     -d '{"event":"messages.upsert","data":{"key":{"remoteJid":"5511000000000@s.whatsapp.net","fromMe":false,"id":"TEST"},"message":{"conversation":"oi"},"pushName":"Teste","messageTimestamp":'"$(date +%s)"'}}'
   ```
   Esperado: `{"status":"queued"}`.

### Atendente assumiu mas IA continua respondendo

Isso é bug — abra issue. Workaround temporário: encerrar a conversa (`/close`) e a IA para totalmente.

## Backup e restauração

### Backup automático (configurar no Easypanel)
- Volumes: `postgres_data` diário, retenção 30 dias.
- Volumes: `redis_data` semanal (fila é efêmera, ok perder).

### Backup manual
```bash
docker exec imuniza_postgres pg_dump -U imuniza imuniza > backup-$(date +%F).sql
```

### Restauração
```bash
cat backup.sql | docker exec -i imuniza_postgres psql -U imuniza -d imuniza
```

Após restaurar, **reindexe a KB** para regenerar embeddings consistentes:
```bash
pnpm --filter @imuniza/api reindex
```

## Apagar dados de um paciente (LGPD)

```sql
-- substitua o telefone pelo do paciente
WITH p AS (SELECT id FROM patients WHERE phone = '+5511999998888' LIMIT 1)
DELETE FROM messages WHERE "conversationId" IN (
  SELECT id FROM conversations WHERE "patientId" = (SELECT id FROM p)
);
DELETE FROM handoffs WHERE "conversationId" IN (
  SELECT id FROM conversations WHERE "patientId" = (SELECT id FROM p)
);
DELETE FROM conversations WHERE "patientId" = (SELECT id FROM p);
DELETE FROM patients WHERE id = (SELECT id FROM p);
```

## Atualizar o sistema

Em dev, fluxo típico:

```bash
git pull
pnpm install
pnpm db:migrate
pnpm typecheck
```

Em produção, o Easypanel faz auto-deploy quando você dá push. Se houver nova migração:

```bash
# no terminal do container api no Easypanel
pnpm --filter @imuniza/db db:deploy
```
