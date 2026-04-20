import type OpenAI from 'openai';

export const functionDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'send_reply',
      description:
        'Envia uma mensagem de texto ao paciente via WhatsApp. Use para responder, pedir esclarecimentos ou orientar.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Texto em português, conciso e acolhedor.' },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_patient_profile',
      description:
        'Atualiza dados do perfil do paciente (idade do bebê, nome, condições). Campos omitidos permanecem inalterados.',
      parameters: {
        type: 'object',
        properties: {
          babyAgeMonths: { type: 'number', description: 'Idade do bebê em meses' },
          babyName: { type: 'string' },
          medicalConditions: { type: 'array', items: { type: 'string' } },
          vaccineHistory: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_kb',
      description:
        'Busca trechos da base de conhecimento sobre vacinas. Use quando precisar de detalhes sobre uma vacina específica ou dúvida técnica.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          topK: { type: 'integer', minimum: 1, maximum: 10, default: 4 },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_vaccines',
      description:
        'Lista vacinas disponíveis com preços e idades. Filtros opcionais por idade em meses.',
      parameters: {
        type: 'object',
        properties: {
          ageMonths: { type: 'integer', minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_vaccines',
      description:
        'Recomenda vacinas para um perfil. Use após identificar a idade do bebê. Retorna lista com preços.',
      parameters: {
        type: 'object',
        properties: {
          ageMonths: { type: 'integer', minimum: 0 },
          conditions: { type: 'array', items: { type: 'string' } },
        },
        required: ['ageMonths'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_handoff',
      description:
        'Encaminha o paciente para a equipe humana (fila de agendamento). Use quando o paciente quiser agendar, tiver dúvida que você não pode resolver, ou sintoma preocupante.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: ['scheduling', 'clinical_concern', 'complex_question', 'patient_request'],
          },
          summary: {
            type: 'string',
            description: 'Resumo curto da situação do paciente para o atendente.',
          },
        },
        required: ['reason', 'summary'],
        additionalProperties: false,
      },
    },
  },
];
