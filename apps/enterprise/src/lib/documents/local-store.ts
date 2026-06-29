import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DocumentChunk, DocumentRecord } from '@/types';
import { getLocalUploadDir } from '@/lib/env';

const INDEX_FILE = 'documents-index.json';

interface LocalIndex {
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
}

function dataDir(): string {
  return path.join(process.cwd(), '.data');
}

function indexPath(): string {
  return path.join(dataDir(), INDEX_FILE);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.join(process.cwd(), getLocalUploadDir()), { recursive: true });
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<LocalIndex> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(indexPath(), 'utf-8');
    return JSON.parse(raw) as LocalIndex;
  } catch {
    return { documents: [], chunks: [] };
  }
}

async function writeIndex(index: LocalIndex): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(indexPath(), JSON.stringify(index, null, 2), 'utf-8');
}

export async function localListDocuments(): Promise<DocumentRecord[]> {
  const index = await readIndex();
  return [...index.documents].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function localGetDocument(id: string): Promise<DocumentRecord | null> {
  const index = await readIndex();
  return index.documents.find((d) => d.id === id) ?? null;
}

export async function localGetChunks(documentId: string): Promise<DocumentChunk[]> {
  const index = await readIndex();
  return index.chunks
    .filter((c) => c.document_id === documentId)
    .sort((a, b) => a.chunk_index - b.chunk_index);
}

export async function localGetAllChunks(): Promise<DocumentChunk[]> {
  const index = await readIndex();
  return index.chunks;
}

export async function localSaveDocument(doc: DocumentRecord): Promise<DocumentRecord> {
  const index = await readIndex();
  const i = index.documents.findIndex((d) => d.id === doc.id);
  if (i >= 0) index.documents[i] = doc;
  else index.documents.push(doc);
  await writeIndex(index);
  return doc;
}

export async function localSaveChunks(documentId: string, chunks: Omit<DocumentChunk, 'id'>[]): Promise<DocumentChunk[]> {
  const index = await readIndex();
  index.chunks = index.chunks.filter((c) => c.document_id !== documentId);
  const saved: DocumentChunk[] = chunks.map((c) => ({
    ...c,
    id: randomUUID(),
  }));
  index.chunks.push(...saved);
  await writeIndex(index);
  return saved;
}

export async function localDeleteDocument(id: string): Promise<boolean> {
  const index = await readIndex();
  const doc = index.documents.find((d) => d.id === id);
  if (!doc) return false;
  index.documents = index.documents.filter((d) => d.id !== id);
  index.chunks = index.chunks.filter((c) => c.document_id !== id);
  await writeIndex(index);
  try {
    const filePath = path.join(process.cwd(), doc.storage_path);
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
  return true;
}

export async function localSaveFile(
  filename: string,
  buffer: Buffer
): Promise<string> {
  await ensureDataDir();
  const safeName = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const rel = path.join(getLocalUploadDir(), safeName);
  const abs = path.join(process.cwd(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return rel.replace(/\\/g, '/');
}
