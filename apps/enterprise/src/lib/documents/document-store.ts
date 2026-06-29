import { randomUUID } from 'crypto';
import type {
  DocumentChunk,
  DocumentRecord,
  DocumentStatus,
  InformationClassification,
  SessionUser,
} from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured } from '@/lib/env';
import {
  localDeleteDocument,
  localGetAllChunks,
  localGetChunks,
  localGetDocument,
  localListDocuments,
  localSaveChunks,
  localSaveDocument,
  localSaveFile,
} from './local-store';
import { splitIntoChunks } from '@/lib/rag/chunk';
import { embedTexts } from '@/lib/rag/embed';
import { filterByCompany, resolveEffectiveCompanyId } from '@/lib/tenant/filter';
import { DEMO_COMPANY_ID } from '@/lib/tenant/constants';
import { extractText, inferFileType, type ExtractOutcome } from './extract';

const STORAGE_BUCKET = 'documents';

function mapDocumentRow(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id ?? DEMO_COMPANY_ID),
    title: String(row.title),
    filename: String(row.filename),
    file_type: row.file_type as DocumentRecord['file_type'],
    storage_path: String(row.storage_path),
    department: row.department ? String(row.department) : null,
    department_id: row.department_id ? String(row.department_id) : null,
    classification: row.classification as InformationClassification,
    owner_id: row.owner_id ? String(row.owner_id) : null,
    owner_name: row.owner_name ? String(row.owner_name) : null,
    status: row.status as DocumentRecord['status'],
    error_message: row.error_message ? String(row.error_message) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapChunkRow(row: Record<string, unknown>): DocumentChunk {
  return {
    id: String(row.id),
    company_id: String(row.company_id ?? DEMO_COMPANY_ID),
    document_id: String(row.document_id),
    chunk_index: Number(row.chunk_index),
    content: String(row.content),
    token_count: Number(row.token_count ?? 0),
    page_number: row.page_number != null ? Number(row.page_number) : null,
    embedding_status: row.embedding_status as DocumentChunk['embedding_status'],
  };
}

export async function listDocuments(companyId?: string): Promise<DocumentRecord[]> {
  let docs: DocumentRecord[] = [];
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      let query = client.from('documents').select('*').order('updated_at', { ascending: false });
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (!error && data) docs = data.map((r) => mapDocumentRow(r as Record<string, unknown>));
    }
  }
  if (docs.length === 0) docs = await localListDocuments();
  return companyId ? filterByCompany(docs, companyId) : docs;
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const { data } = await client.from('documents').select('*').eq('id', id).maybeSingle();
      if (data) return mapDocumentRow(data as Record<string, unknown>);
    }
  }
  return localGetDocument(id);
}

export async function getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const { data } = await client
        .from('document_chunks')
        .select('*')
        .eq('document_id', documentId)
        .order('chunk_index');
      if (data) return data.map((r) => mapChunkRow(r as Record<string, unknown>));
    }
  }
  return localGetChunks(documentId);
}

export async function getAllDocumentChunks(companyId?: string): Promise<DocumentChunk[]> {
  let chunks: DocumentChunk[] = [];
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      let query = client.from('document_chunks').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      const { data } = await query;
      if (data) chunks = data.map((r) => mapChunkRow(r as Record<string, unknown>));
    }
  }
  if (chunks.length === 0) chunks = await localGetAllChunks();
  return companyId ? filterByCompany(chunks, companyId) : chunks;
}

async function saveFileToStorage(filename: string, buffer: Buffer): Promise<string> {
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const storagePath = `${randomUUID()}/${filename}`;
      const { error } = await client.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
      if (!error) return `supabase://${STORAGE_BUCKET}/${storagePath}`;
    }
  }
  return localSaveFile(filename, buffer);
}

async function persistDocument(doc: DocumentRecord): Promise<DocumentRecord> {
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const { data, error } = await client.from('documents').upsert(doc).select('*').single();
      if (!error && data) return mapDocumentRow(data as Record<string, unknown>);
    }
  }
  return localSaveDocument(doc);
}

async function persistChunks(
  documentId: string,
  chunks: Omit<DocumentChunk, 'id'>[]
): Promise<DocumentChunk[]> {
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      await client.from('document_chunks').delete().eq('document_id', documentId);
      const rows = chunks.map((c) => ({ ...c, document_id: documentId }));
      const { data, error } = await client.from('document_chunks').insert(rows).select('*');
      if (!error && data) return data.map((r) => mapChunkRow(r as Record<string, unknown>));
    }
  }
  return localSaveChunks(documentId, chunks);
}

async function updateStatus(
  id: string,
  status: DocumentStatus,
  error_message: string | null = null
): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  const updated: DocumentRecord = {
    ...doc,
    status,
    error_message,
    updated_at: new Date().toISOString(),
  };
  await persistDocument(updated);
}

export interface UploadDocumentInput {
  buffer: Buffer;
  filename: string;
  title: string;
  department: string | null;
  department_id: string | null;
  classification: InformationClassification;
  owner: SessionUser;
  company_id?: string;
}

export async function uploadAndProcessDocument(
  input: UploadDocumentInput
): Promise<DocumentRecord> {
  const fileType = inferFileType(input.filename);
  if (!fileType) {
    throw new Error('対応していないファイル形式です');
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const storage_path = await saveFileToStorage(input.filename, input.buffer);

  const companyId = input.company_id ?? resolveEffectiveCompanyId(input.owner);

  const doc: DocumentRecord = {
    id,
    company_id: companyId,
    title: input.title || input.filename,
    filename: input.filename,
    file_type: fileType,
    storage_path,
    department: input.department,
    department_id: input.department_id,
    classification: input.classification,
    owner_id: input.owner.id,
    owner_name: input.owner.display_name || input.owner.full_name,
    status: 'processing',
    error_message: null,
    created_at: now,
    updated_at: now,
  };

  await persistDocument(doc);

  const extraction: ExtractOutcome = await extractText(input.buffer, fileType);
  if (!extraction.ok) {
    await updateStatus(id, 'error', extraction.error);
    const failed = await getDocument(id);
    return failed!;
  }

  const textChunks = splitIntoChunks(extraction.text, {
    pageTexts: extraction.pageTexts,
  });

  if (textChunks.length === 0) {
    await updateStatus(id, 'error', '抽出されたテキストが空です');
    const failed = await getDocument(id);
    return failed!;
  }

  const chunkRows: Omit<DocumentChunk, 'id'>[] = textChunks.map((c) => ({
    company_id: companyId,
    document_id: id,
    chunk_index: c.chunk_index,
    content: c.content,
    token_count: c.token_count,
    page_number: c.page_number,
    embedding_status: 'pending' as const,
  }));

  await persistChunks(id, chunkRows);

  // Embedding 基盤呼び出し（現状ダミー・embedding_status は pending のまま）
  await embedTexts(textChunks.map((c) => c.content));

  await updateStatus(id, 'indexed', null);
  const indexed = await getDocument(id);
  return indexed!;
}

/** 外部連携同期用 — 安定した storage_path を生成 */
export function buildIntegrationStoragePath(provider: string, sourcePath: string): string {
  const encoded = encodeURIComponent(sourcePath);
  return `integration://${provider}/source/${encoded}`;
}

export async function findDocumentByStoragePath(
  companyId: string,
  storagePath: string
): Promise<DocumentRecord | null> {
  const docs = await listDocuments(companyId);
  return docs.find((d) => d.storage_path === storagePath) ?? null;
}

async function indexSyncedDocumentContent(
  doc: DocumentRecord,
  content: string
): Promise<DocumentRecord> {
  const textChunks = splitIntoChunks(content);
  const chunkRows: Omit<DocumentChunk, 'id'>[] = textChunks.map((c) => ({
    company_id: doc.company_id,
    document_id: doc.id,
    chunk_index: c.chunk_index,
    content: c.content,
    token_count: c.token_count,
    page_number: c.page_number,
    embedding_status: 'pending' as const,
  }));

  await persistChunks(doc.id, chunkRows);
  await embedTexts(textChunks.map((c) => c.content));
  await updateStatus(doc.id, 'indexed', null);

  const indexed = await getDocument(doc.id);
  return indexed!;
}

/** 外部連携同期用 — 新規作成または既存ドキュメント更新 */
export async function upsertSyncedDocument(input: {
  company_id: string;
  title: string;
  filename: string;
  content: string;
  source_path: string;
  owner_id: string;
  owner_name: string;
  department?: string | null;
  classification?: InformationClassification;
  source_provider?: string;
}): Promise<{ document: DocumentRecord; is_new: boolean; content_changed: boolean }> {
  const provider = input.source_provider ?? 'external';
  const storage_path = buildIntegrationStoragePath(provider, input.source_path);
  const existing = await findDocumentByStoragePath(input.company_id, storage_path);
  const now = new Date().toISOString();

  if (existing) {
    const chunks = await getDocumentChunks(existing.id);
    const previousContent = chunks.map((c) => c.content).join('\n');
    const contentChanged = previousContent !== input.content;

    const updated: DocumentRecord = {
      ...existing,
      title: input.title,
      filename: input.filename,
      status: 'processing',
      error_message: null,
      updated_at: now,
    };
    await persistDocument(updated);

    if (contentChanged) {
      const indexed = await indexSyncedDocumentContent(updated, input.content);
      return { document: indexed, is_new: false, content_changed: true };
    }

    await updateStatus(existing.id, 'indexed', null);
    const unchanged = await getDocument(existing.id);
    return { document: unchanged!, is_new: false, content_changed: false };
  }

  const id = randomUUID();
  const doc: DocumentRecord = {
    id,
    company_id: input.company_id,
    title: input.title,
    filename: input.filename,
    file_type: 'txt',
    storage_path,
    department: input.department ?? null,
    department_id: null,
    classification: input.classification ?? 'internal',
    owner_id: input.owner_id,
    owner_name: input.owner_name,
    status: 'processing',
    error_message: null,
    created_at: now,
    updated_at: now,
  };

  await persistDocument(doc);
  const indexed = await indexSyncedDocumentContent(doc, input.content);
  return { document: indexed, is_new: true, content_changed: true };
}

/** @deprecated upsertSyncedDocument を使用 */
export async function importSyncedDocument(input: {
  company_id: string;
  title: string;
  filename: string;
  content: string;
  owner_id: string;
  owner_name: string;
  department?: string | null;
  classification?: InformationClassification;
  source_provider?: string;
  source_path?: string;
}): Promise<DocumentRecord> {
  const { document } = await upsertSyncedDocument({
    ...input,
    source_path: input.source_path ?? input.filename,
  });
  return document;
}

export async function deleteDocument(id: string): Promise<boolean> {
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const doc = await getDocument(id);
      if (doc?.storage_path.startsWith('supabase://')) {
        const path = doc.storage_path.replace(`supabase://${STORAGE_BUCKET}/`, '');
        await client.storage.from(STORAGE_BUCKET).remove([path]);
      }
      await client.from('document_chunks').delete().eq('document_id', id);
      const { error } = await client.from('documents').delete().eq('id', id);
      if (!error) return true;
    }
  }
  return localDeleteDocument(id);
}
