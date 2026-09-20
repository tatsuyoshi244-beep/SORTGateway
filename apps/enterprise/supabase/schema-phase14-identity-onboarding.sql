-- Phase 14: human-friendly company login IDs and tenant-safe onboarding

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS login_id TEXT;

UPDATE public.companies
SET login_id = slug
WHERE login_id IS NULL;

ALTER TABLE public.companies
  ALTER COLUMN login_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_login_id
  ON public.companies(login_id);

-- The original schema made department codes globally unique. They are tenant-local.
ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_company_code
  ON public.departments(company_id, code);

INSERT INTO public.schema_migrations (version, description)
VALUES ('phase14', 'Tenant identity onboarding and company login IDs')
ON CONFLICT (version) DO NOTHING;
