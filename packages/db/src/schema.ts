import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  bigint,
  bigserial,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// pgvector custom type
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dim = (config as { dimensions?: number } | undefined)?.dimensions ?? 1536;
    return `vector(${dim})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(Number);
  },
});

// ============== Enums ==============
export const userRoleEnum = pgEnum('user_role', ['member', 'admin', 'director']);
export const departmentEnum = pgEnum('department', [
  'vendas',
  'conteudo',
  'marketing',
  'suporte',
  'produto',
  'mentoria',
  'financeiro',
  'diretoria',
  'outros',
]);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const attachmentKindEnum = pgEnum('attachment_kind', [
  'image',
  'pdf',
  'docx',
  'xlsx',
  'audio',
  'text',
  'other',
]);
export const memorySourceEnum = pgEnum('memory_source', [
  'manual',
  'auto_extract',
  'onboarding',
]);
export const promptCategoryEnum = pgEnum('prompt_category', [
  'vendas',
  'conteudo',
  'mentoria',
  'produto',
  'operacional',
  'outros',
]);
export const sourceTypeEnum = pgEnum('kb_source_type', [
  'upload',
  'drive',
  'notion',
  'manual',
  'url',
]);

// ============== Auth (Better Auth compatible) ==============
export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: varchar('name', { length: 255 }),
    image: varchar('image', { length: 500 }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    role: userRoleEnum('role').notNull().default('member'),
    department: departmentEnum('department').notNull().default('outros'),
    jobTitle: varchar('job_title', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: index('idx_user_tenant').on(t.tenantId),
    emailIdx: index('idx_user_email').on(t.email),
  })
);

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_session_user').on(t.userId),
    expiresIdx: index('idx_session_expires').on(t.expiresAt),
  })
);

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 64 }).notNull(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: varchar('scope', { length: 500 }),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    providerAccountIdx: uniqueIndex('uk_account_provider').on(t.providerId, t.accountId),
    userIdx: index('idx_account_user').on(t.userId),
  })
);

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    identifierIdx: index('idx_verification_identifier').on(t.identifier),
  })
);

// ============== Conversas ==============
export const conversation = pgTable(
  'conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull().default('Nova conversa'),
    systemPrompt: text('system_prompt'),
    model: varchar('model', { length: 100 }),
    pinned: boolean('pinned').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    branchParentId: uuid('branch_parent_id').references((): any => conversation.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantUserIdx: index('idx_conv_tenant_user').on(t.tenantId, t.userId),
    userPinnedUpdatedIdx: index('idx_conv_user_pinned_updated').on(
      t.userId,
      t.pinned,
      t.updatedAt
    ),
    archivedIdx: index('idx_conv_archived').on(t.archived),
  })
);

export const message = pgTable(
  'message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    model: varchar('model', { length: 100 }),
    provider: varchar('provider', { length: 50 }),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    costCents: integer('cost_cents'),
    thinking: text('thinking'),
    toolCalls: jsonb('tool_calls'),
    citations: jsonb('citations'),
    parentMessageId: uuid('parent_message_id').references((): any => message.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    convCreatedIdx: index('idx_msg_conv_created').on(t.conversationId, t.createdAt),
    tenantIdx: index('idx_msg_tenant').on(t.tenantId),
  })
);

export const attachment = pgTable(
  'attachment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    kind: attachmentKindEnum('kind').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageUrl: varchar('storage_url', { length: 500 }).notNull(),
    originalName: varchar('original_name', { length: 255 }),
    extractedText: text('extracted_text'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    messageIdx: index('idx_att_message').on(t.messageId),
    tenantIdx: index('idx_att_tenant').on(t.tenantId),
  })
);

// ============== Memória do usuário ==============
export const userMemory = pgTable(
  'user_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    category: varchar('category', { length: 50 }),
    source: memorySourceEnum('source').notNull().default('auto_extract'),
    sourceConvId: uuid('source_conv_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUpdatedIdx: index('idx_mem_user_updated').on(t.userId, t.updatedAt),
    tenantIdx: index('idx_mem_tenant').on(t.tenantId),
  })
);

// ============== Biblioteca de prompts ==============
export const promptTemplate = pgTable(
  'prompt_template',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    category: promptCategoryEnum('category').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    variables: jsonb('variables'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantCatIdx: index('idx_prompt_tenant_cat').on(t.tenantId, t.category),
  })
);

// ============== Knowledge base (RAG) ==============
export const kbDocument = pgTable(
  'kb_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    title: varchar('title', { length: 300 }).notNull(),
    sourceUrl: varchar('source_url', { length: 500 }),
    sourceType: sourceTypeEnum('source_type').notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    storageUrl: varchar('storage_url', { length: 500 }),
    category: varchar('category', { length: 80 }),
    totalChunks: integer('total_chunks').notNull().default(0),
    indexedAt: timestamp('indexed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantCatIdx: index('idx_kb_tenant_cat').on(t.tenantId, t.category),
  })
);

export const kbChunk = pgTable(
  'kb_chunk',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => kbDocument.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 } as any),
    tokens: integer('tokens'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    docIdx: index('idx_chunk_doc').on(t.documentId),
    tenantIdx: index('idx_chunk_tenant').on(t.tenantId),
  })
);

// ============== Auditoria de uso ==============
export const usageLog = pgTable(
  'usage_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().default('entur'),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id'),
    messageId: uuid('message_id'),
    provider: varchar('provider', { length: 50 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    costCents: integer('cost_cents').notNull().default(0),
    latencyMs: integer('latency_ms'),
    error: varchar('error', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantDateIdx: index('idx_usage_tenant_date').on(t.tenantId, t.createdAt),
    userDateIdx: index('idx_usage_user_date').on(t.userId, t.createdAt),
    providerModelIdx: index('idx_usage_provider_model').on(t.provider, t.model),
  })
);

// ============== Tenant settings ==============
export const tenantSetting = pgTable(
  'tenant_setting',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    key: varchar('key', { length: 120 }).notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.key] }),
  })
);

// ============== Trigger updated_at (managed via migration) ==============
export const __triggerSql = sql`
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;
