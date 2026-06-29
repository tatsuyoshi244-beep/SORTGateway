import type { DocumentRecord } from '@/types';

export function getDocumentStats(docs: DocumentRecord[]) {
  return {
    total: docs.length,
    indexed: docs.filter((d) => d.status === 'indexed').length,
    processing: docs.filter((d) => d.status === 'processing').length,
    error: docs.filter((d) => d.status === 'error').length,
  };
}
