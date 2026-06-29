import { MAX_UPLOAD_BYTES } from '@/lib/api/validate';

export interface SecurityPolicyConfig {
  token_pass: {
    default_max_uses: number;
    default_expiry_days: number;
    hash_algorithm: string;
    require_revoke_on_compromise: boolean;
  };
  audit: {
    retention_days: number;
    log_ip_address: boolean;
    log_user_agent: boolean;
    immutable_storage: boolean;
  };
  upload: {
    max_file_size_mb: number;
    allowed_extensions: string[];
    scan_on_upload: boolean;
  };
  ai: {
    require_knowledge_citation: boolean;
    show_no_knowledge_warning: boolean;
    block_external_data_leak: boolean;
  };
  confidential_access: {
    require_token_for_confidential: boolean;
    warn_on_executive_only: boolean;
    warn_on_confidential_view: boolean;
  };
}

export const SECURITY_POLICY: SecurityPolicyConfig = {
  token_pass: {
    default_max_uses: 20,
    default_expiry_days: 90,
    hash_algorithm: 'SHA-256',
    require_revoke_on_compromise: true,
  },
  audit: {
    retention_days: 365,
    log_ip_address: true,
    log_user_agent: true,
    immutable_storage: false,
  },
  upload: {
    max_file_size_mb: MAX_UPLOAD_BYTES / 1024 / 1024,
    allowed_extensions: ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md'],
    scan_on_upload: false,
  },
  ai: {
    require_knowledge_citation: true,
    show_no_knowledge_warning: true,
    block_external_data_leak: true,
  },
  confidential_access: {
    require_token_for_confidential: true,
    warn_on_executive_only: true,
    warn_on_confidential_view: true,
  },
};
