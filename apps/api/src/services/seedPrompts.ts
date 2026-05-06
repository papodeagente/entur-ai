import { db, schema } from '@entur-ai/db';
import { eq } from 'drizzle-orm';

const TENANT_ID = 'entur';

interface SeedPrompt {
  category: 'vendas' | 'conteudo' | 'mentoria' | 'produto' | 'operacional';
  title: string;
  body: string;
  variables: { name: string; label: string; placeholder?: string; type?: 'text' | 'textarea'; default?: string }[];
}

const SEED: SeedPrompt[] = [
  // ===== VENDAS =====
  {
    category: 'vendas',
    title: 'SPIN para venda em grupo',
    body: `Crie 4 perguntas SPIN (Situação, Problema, Implicação, Necessidade) para qualificar um prospect interessado em organizar uma viagem em grupo.

Perfil do grupo: {{tipo_grupo}}
Tamanho aproximado: {{tamanho_grupo}}
Contexto adicional: {{contexto}}

Use o tom da Entur: claro, prático, sem caixa alta. Mostre como cada pergunta abre conversa e revela dor de verdade. Para cada pergunta, comente em 1 linha por que aquela pergunta é estratégica.`,
    variables: [
      { name: 'tipo_grupo', label: 'Tipo de grupo', placeholder: 'Ex: empresarial, intercâmbio, formandos' },
      { name: 'tamanho_grupo', label: 'Tamanho aproximado', placeholder: 'Ex: 25-40 pessoas' },
      { name: 'contexto', label: 'Contexto', type: 'textarea', placeholder: 'Como veio o lead, urgência, etc' },
    ],
  },
  {
    category: 'vendas',
    title: 'Email de recuperação de lead frio',
    body: `Escreva um email curto (máx 8 linhas), em pt-BR, para reativar um lead que parou de responder há {{dias_sem_contato}} dias.

Nome do lead: {{nome_lead}}
Produto/oferta: {{produto}}
Última conversa foi sobre: {{ultimo_assunto}}

Tom Entur: caloroso, sem cobrança, oferecendo valor. Termine com 1 pergunta aberta que convida resposta. Sem caixa alta.`,
    variables: [
      { name: 'nome_lead', label: 'Nome do lead' },
      { name: 'dias_sem_contato', label: 'Dias sem contato', placeholder: 'Ex: 14' },
      { name: 'produto', label: 'Produto/oferta', placeholder: 'Ex: curso, mentoria, pacote' },
      { name: 'ultimo_assunto', label: 'Último assunto conversado', type: 'textarea' },
    ],
  },
  {
    category: 'vendas',
    title: 'Argumento de objeção comercial',
    body: `Reformule este argumento comercial para responder a uma objeção típica.

Objeção do cliente: "{{objecao}}"
Produto/serviço: {{produto}}
Contexto: {{contexto}}

Crie 3 versões da resposta, cada uma usando uma técnica diferente (reframe, prova social, contraponto). Cada versão em até 4 linhas.`,
    variables: [
      { name: 'objecao', label: 'Objeção do cliente', type: 'textarea', placeholder: 'Ex: está caro, vou pensar...' },
      { name: 'produto', label: 'Produto/serviço' },
      { name: 'contexto', label: 'Contexto da venda', type: 'textarea' },
    ],
  },

  // ===== CONTEÚDO =====
  {
    category: 'conteudo',
    title: 'Carrossel Papo de Agente (10 slides)',
    body: `Crie um carrossel de 10 slides para o Instagram do Papo de Agente.

Tema: {{tema}}
Gancho/dor central: {{gancho}}
CTA final: {{cta}}

Regras Entur:
- Sem caixa alta, sem manchetes sensacionalistas
- Sem hífens estilizados (ex: \"essencial — para você\")
- Mulher como decisora (vendas em turismo)
- Tom prático, conversado, com microinsights

Estrutura: slide 1 = capa com gancho; slides 2-9 = desenvolvimento (1 ideia por slide, 1-3 frases); slide 10 = CTA.

Marque cada slide com [SLIDE N] e devolva em texto simples (sem títulos genéricos tipo "introdução").`,
    variables: [
      { name: 'tema', label: 'Tema do carrossel', placeholder: 'Ex: 5 erros de quem está começando como agente' },
      { name: 'gancho', label: 'Gancho/dor central', type: 'textarea' },
      { name: 'cta', label: 'CTA final', placeholder: 'Ex: comente "QUERO" para receber o passo a passo' },
    ],
  },
  {
    category: 'conteudo',
    title: 'Roteiro Reels 60s',
    body: `Escreva um roteiro de Reels de 60 segundos (formato falado) sobre {{tema}}.

Estrutura:
- 0-3s: gancho que para o scroll
- 3-50s: 3 micro-insights ou storytelling rápido
- 50-60s: CTA + reforço

Tom Entur: claro, direto, conversado. Marque os tempos no roteiro.`,
    variables: [{ name: 'tema', label: 'Tema do Reels', placeholder: 'Ex: como precificar pacote sob medida' }],
  },
  {
    category: 'conteudo',
    title: 'Email marketing - lançamento',
    body: `Escreva um email de lançamento (~250 palavras) para a base Entur.

Produto: {{produto}}
Diferencial principal: {{diferencial}}
Urgência (se houver): {{urgencia}}
Link/CTA: {{cta_link}}

Tom: confiante, prático, sem prometer milagre. Subject line + 3 sub-headers. Termine com PS curto que reforça a urgência ou diferencial.`,
    variables: [
      { name: 'produto', label: 'Produto sendo lançado' },
      { name: 'diferencial', label: 'Diferencial principal', type: 'textarea' },
      { name: 'urgencia', label: 'Urgência (opcional)', placeholder: 'Ex: vagas limitadas, fim de pré-venda...' },
      { name: 'cta_link', label: 'Link/CTA', placeholder: 'Ex: https://entur.com.br/curso-x' },
    ],
  },
  {
    category: 'conteudo',
    title: 'Storytelling de aluna',
    body: `Escreva um post de Instagram (texto longo, ~250 palavras) contando a história de transformação de uma aluna Entur.

Nome da aluna: {{nome_aluna}}
Onde começou: {{onde_comecou}}
Onde está agora: {{onde_esta}}
Virada de chave (momento de mudança): {{virada}}

Tom Entur: humano, sem inventar, sem clichê. Termine com convite para outras agentes que se identificam.`,
    variables: [
      { name: 'nome_aluna', label: 'Nome da aluna' },
      { name: 'onde_comecou', label: 'Onde começou', type: 'textarea' },
      { name: 'onde_esta', label: 'Onde está agora', type: 'textarea' },
      { name: 'virada', label: 'Virada de chave', type: 'textarea' },
    ],
  },

  // ===== MENTORIA =====
  {
    category: 'mentoria',
    title: 'Devolutiva de simulação de venda',
    body: `Faça uma devolutiva estruturada de uma simulação de venda da aluna.

Aluna: {{aluna}}
Cenário simulado: {{cenario}}
Pontos fortes observados: {{fortes}}
Pontos a desenvolver: {{a_desenvolver}}

Estrutura:
1. O que funcionou (com exemplo específico)
2. O que precisa de atenção (sem julgar — descreva o impacto)
3. 2 próximos passos concretos (mensuráveis)

Tom: mentora experiente, generosa mas honesta. Sem floreios.`,
    variables: [
      { name: 'aluna', label: 'Nome da aluna' },
      { name: 'cenario', label: 'Cenário simulado', type: 'textarea' },
      { name: 'fortes', label: 'Pontos fortes observados', type: 'textarea' },
      { name: 'a_desenvolver', label: 'Pontos a desenvolver', type: 'textarea' },
    ],
  },
  {
    category: 'mentoria',
    title: 'Plano SMART para aluna',
    body: `Crie um plano de ação SMART (Específico, Mensurável, Atingível, Relevante, Temporal) para uma aluna Entur que quer atingir uma meta.

Aluna: {{aluna}}
Meta: {{meta}}
Prazo: {{prazo}}
Recursos disponíveis: {{recursos}}
Bloqueios atuais: {{bloqueios}}

Devolva o plano com: meta SMART rephrased, 4 marcos intermediários, 1 indicador semanal de acompanhamento, 2 riscos com plano B.`,
    variables: [
      { name: 'aluna', label: 'Nome da aluna' },
      { name: 'meta', label: 'Meta', type: 'textarea', placeholder: 'Ex: faturar 30k em 90 dias' },
      { name: 'prazo', label: 'Prazo', placeholder: 'Ex: 90 dias' },
      { name: 'recursos', label: 'Recursos disponíveis', type: 'textarea' },
      { name: 'bloqueios', label: 'Bloqueios atuais', type: 'textarea' },
    ],
  },

  // ===== PRODUTO =====
  {
    category: 'produto',
    title: 'Descrição de curso',
    body: `Escreva a descrição comercial de um curso Entur (~300 palavras).

Nome do curso: {{nome_curso}}
Público-alvo: {{publico}}
Transformação prometida: {{transformacao}}
3 módulos principais: {{modulos}}
Carga horária / formato: {{formato}}

Estrutura: gancho de abertura, problema do público, transformação, o que está dentro (módulos), formato, CTA. Tom Entur (sem promessa milagrosa, sem caixa alta).`,
    variables: [
      { name: 'nome_curso', label: 'Nome do curso' },
      { name: 'publico', label: 'Público-alvo', placeholder: 'Ex: agentes iniciantes, donas de agência' },
      { name: 'transformacao', label: 'Transformação prometida', type: 'textarea' },
      { name: 'modulos', label: '3 módulos principais', type: 'textarea' },
      { name: 'formato', label: 'Formato e carga horária', placeholder: 'Ex: 6 semanas, 2 lives/semana' },
    ],
  },
  {
    category: 'produto',
    title: 'Copy de landing page',
    body: `Escreva a copy de uma landing page de conversão para um produto Entur.

Produto: {{produto}}
Dor central do público: {{dor}}
Oferta: {{oferta}}
Bônus / garantia: {{bonus}}

Estrutura solicitada (devolva com cada bloco identificado):
- HERO (headline + sub + CTA)
- 3 BLOCOS DE BENEFÍCIO
- PROVA SOCIAL (placeholder)
- OFERTA detalhada
- FAQ 5 perguntas
- CTA FINAL

Tom Entur: claro, sem promessa milagrosa, sem caixa alta.`,
    variables: [
      { name: 'produto', label: 'Produto' },
      { name: 'dor', label: 'Dor central do público', type: 'textarea' },
      { name: 'oferta', label: 'Oferta', type: 'textarea', placeholder: 'Ex: R$ 1.997 ou 12x R$ 197' },
      { name: 'bonus', label: 'Bônus/garantia', type: 'textarea' },
    ],
  },

  // ===== OPERACIONAL =====
  {
    category: 'operacional',
    title: 'Email interno - comunicado',
    body: `Escreva um email interno curto para a equipe Entur.

Assunto: {{assunto}}
Ponto-chave: {{ponto_chave}}
Próxima ação esperada do time: {{proxima_acao}}
Prazo: {{prazo}}

Estilo: 5-8 linhas, direto, com 1 negrito no que importa. Encerre com 1 frase de incentivo curta (sem clichê).`,
    variables: [
      { name: 'assunto', label: 'Assunto' },
      { name: 'ponto_chave', label: 'Ponto-chave', type: 'textarea' },
      { name: 'proxima_acao', label: 'Próxima ação esperada', type: 'textarea' },
      { name: 'prazo', label: 'Prazo', placeholder: 'Ex: até sexta 18h' },
    ],
  },
  {
    category: 'operacional',
    title: 'Brief para fornecedor',
    body: `Escreva um brief curto e objetivo para um fornecedor.

Tipo de serviço: {{tipo_servico}}
Escopo: {{escopo}}
Resultado esperado: {{resultado}}
Prazo: {{prazo}}
Orçamento: {{orcamento}}

Termine com 3 perguntas que você quer que o fornecedor responda na proposta.`,
    variables: [
      { name: 'tipo_servico', label: 'Tipo de serviço', placeholder: 'Ex: design de carrossel, edição de vídeo' },
      { name: 'escopo', label: 'Escopo', type: 'textarea' },
      { name: 'resultado', label: 'Resultado esperado', type: 'textarea' },
      { name: 'prazo', label: 'Prazo' },
      { name: 'orcamento', label: 'Orçamento (faixa)' },
    ],
  },
];

export async function ensurePromptsSeeded(): Promise<void> {
  const existing = await db
    .select({ id: schema.promptTemplate.id })
    .from(schema.promptTemplate)
    .where(eq(schema.promptTemplate.tenantId, TENANT_ID))
    .limit(1);

  if (existing.length > 0) return;

  for (const p of SEED) {
    await db.insert(schema.promptTemplate).values({
      tenantId: TENANT_ID,
      category: p.category,
      title: p.title,
      body: p.body,
      variables: p.variables as any,
    });
  }
  console.log(`  ✓ ${SEED.length} prompts ENTUR seedados`);
}
