export const TENANT_ID = 'entur';
export const APP_NAME = 'ENTUR AI';

export const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'entur.com.br';

export const DEPARTMENTS = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'suporte', label: 'Suporte' },
  { id: 'produto', label: 'Produto' },
  { id: 'mentoria', label: 'Mentoria' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'outros', label: 'Outros' },
] as const;

export type Department = (typeof DEPARTMENTS)[number]['id'];

export type UserRole = 'member' | 'admin' | 'director';
