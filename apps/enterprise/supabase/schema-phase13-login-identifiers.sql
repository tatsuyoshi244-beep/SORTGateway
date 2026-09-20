-- Phase 13: enterprise login identifiers

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_employee_number
  ON public.users(company_id, employee_number)
  WHERE employee_number IS NOT NULL;

INSERT INTO schema_migrations (version, description)
VALUES ('phase13', 'Company ID and employee number login')
ON CONFLICT (version) DO NOTHING;
