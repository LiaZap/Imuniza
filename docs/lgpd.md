# LGPD — Lei Geral de Proteção de Dados

Este documento resume as medidas e obrigações da plataforma Imuniza sob a LGPD (Lei nº 13.709/2018).

## 1. Base legal

O tratamento de dados pessoais de pacientes e responsáveis ocorre com base em:

- **Art. 7º, V** — execução de contrato: a clínica atende o paciente, e o atendimento via WhatsApp é parte desse serviço.
- **Art. 11, II, "f"** — tutela de saúde, em procedimento realizado por profissional ou serviço de saúde.
- **Art. 7º, I** — consentimento: coletado na primeira interação (ver seção 3).

## 2. Dados tratados

| Dado | Fonte | Finalidade | Retenção |
|------|-------|------------|----------|
| Número de telefone (WhatsApp) | Paciente | Identificar o paciente e retomar histórico | 5 anos ou até revogação |
| Nome / push name | WhatsApp | Personalização do atendimento | 5 anos |
| Idade do bebê, condições de saúde relatadas, histórico de vacinação | Paciente (chat) | Recomendação de vacinas | 5 anos |
| Mensagens (conteúdo) | Paciente + IA + atendente | Histórico de atendimento | 5 anos |
| Logs operacionais | Sistema | Operação e segurança | 90 dias |

Dados sensíveis adicionais (saúde) são tratados apenas quando o paciente informa espontaneamente.

## 3. Consentimento no primeiro contato

O system prompt da IA inclui a seguinte obrigação (ver `packages/ai/src/prompts/system.ts`, regra 8):

> Se for o primeiro contato, a IA deve esclarecer que é uma assistente virtual, que a conversa é registrada para atendimento e qualidade, e que o paciente pode pedir atendimento humano a qualquer momento.

A IA **não pode** solicitar CPF, número de cartão de crédito, endereço completo ou outros dados sensíveis que não sejam estritamente necessários.

## 4. Segurança técnica

### Criptografia em repouso
- Banco PostgreSQL com volume persistente criptografado pelo provedor (padrão em Hetzner, DO, AWS EBS).
- Senhas de atendentes armazenadas com **bcrypt** (fator 10).
- JWT de sessão assinado com `AUTH_SECRET` de 32+ bytes.

### Criptografia em trânsito
- HTTPS obrigatório em produção (Easypanel emite certificado Let's Encrypt automaticamente).
- Webhook Uazapi autentica por `UAZAPI_WEBHOOK_SECRET`.

### Logs
O logger (pino) tem `redact` configurado em [apps/api/src/server.ts](../apps/api/src/server.ts) para mascarar:
- Headers `authorization`, `cookie`, `x-webhook-secret`
- Bodies: `password`, `text`, `message`, `pushName`, número WhatsApp
- Campos: `body.content`, `message.content`

Logs de debug (incluindo `prisma:query`) **não devem** ser ativados em produção — deixe `NODE_ENV=production`.

## 5. Direitos do titular

O titular tem direito a (Art. 18):

| Direito | Como exercer na Imuniza |
|---------|-------------------------|
| Confirmação e acesso | Pedir via WhatsApp → handoff para atendente → exportação manual do histórico |
| Correção | Pedir via WhatsApp; atendente edita o perfil via Prisma Studio |
| Anonimização / eliminação | Marcar paciente com `DELETE FROM` ou script (ver `docs/ops.md`) |
| Portabilidade | Exportação JSON do histórico da conversation |
| Revogação do consentimento | Pedir "apagar meus dados" → atendente executa o fluxo de eliminação |

## 6. Incidentes de segurança

Em caso de incidente que implique risco ou dano relevante aos titulares, o encarregado (DPO) designado pela clínica deve:

1. Registrar o incidente com data, escopo e dados envolvidos.
2. Comunicar à ANPD em prazo razoável (Art. 48).
3. Comunicar aos titulares afetados.

## 7. Operadores

- **OpenAI (EUA)** — processa mensagens para resposta da IA e gera embeddings. Prompt é enviado a cada turno. Ver https://openai.com/policies/data-processing-addendum
- **Uazapi / provedor WhatsApp** — recebe e envia mensagens pelo WhatsApp.
- **Provedor de hosting (ex: Hetzner / Easypanel)** — hospeda o banco e aplicação.

Recomenda-se assinar DPAs (acordos de processamento de dados) com cada operador.

## 8. Retenção e descarte

- Mensagens e dados de paciente são retidos pelo prazo legal de prontuário (20 anos para saúde, CFM Resolução 1.821/2007) salvo pedido explícito do titular.
- Logs operacionais são removidos após 90 dias (configurar `logrotate` ou equivalente no host).

## 9. Checklist para o cliente (clínica)

- [ ] Designar um DPO (encarregado)
- [ ] Publicar política de privacidade no site da clínica
- [ ] Revisar periodicamente (anualmente) o sistema de consentimento
- [ ] Definir política de retenção conforme obrigações do CFM/conselho profissional
- [ ] Treinar atendentes sobre tratamento de dados no chat do dashboard
