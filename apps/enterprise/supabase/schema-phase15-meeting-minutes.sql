-- Phase 15: department meeting minutes and cross-department access approval

CREATE TABLE IF NOT EXISTS public.meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  meeting_date DATE NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  participants TEXT NOT NULL DEFAULT '',
  agenda TEXT NOT NULL,
  decisions TEXT NOT NULL,
  action_items TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE minute_access_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.minute_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  minute_id UUID NOT NULL REFERENCES public.meeting_minutes(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  target_department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
  status minute_access_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_company_department
  ON public.meeting_minutes(company_id, department_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_minute_requests_requester
  ON public.minute_access_requests(company_id, requester_id, status);
CREATE INDEX IF NOT EXISTS idx_minute_requests_pending
  ON public.minute_access_requests(company_id, status, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_minute_requests_one_pending
  ON public.minute_access_requests(minute_id, requester_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.list_meeting_minutes_for_user()
RETURNS TABLE (
  id UUID, company_id TEXT, title TEXT, meeting_date DATE, department_id UUID,
  department_name TEXT, participants TEXT, agenda TEXT, decisions TEXT,
  action_items TEXT, created_by UUID, created_by_name TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT users.id, users.company_id, users.department_id, users.role
    FROM public.users
    WHERE users.id = auth.uid() AND users.is_active = true
  )
  SELECT minute.id, minute.company_id, minute.title, minute.meeting_date,
    minute.department_id, department.name,
    CASE WHEN allowed.can_view THEN minute.participants ELSE '' END,
    CASE WHEN allowed.can_view THEN minute.agenda ELSE '' END,
    CASE WHEN allowed.can_view THEN minute.decisions ELSE '' END,
    CASE WHEN allowed.can_view THEN minute.action_items ELSE '' END,
    minute.created_by,
    CASE WHEN allowed.can_view THEN creator.full_name ELSE '' END,
    minute.created_at, minute.updated_at
  FROM public.meeting_minutes minute
  JOIN viewer ON viewer.company_id = minute.company_id
  JOIN public.departments department ON department.id = minute.department_id
  JOIN public.users creator ON creator.id = minute.created_by
  CROSS JOIN LATERAL (
    SELECT (
      viewer.role IN ('admin', 'super_admin')
      OR viewer.department_id = minute.department_id
      OR EXISTS (
        SELECT 1 FROM public.minute_access_requests request
        WHERE request.minute_id = minute.id
          AND request.requester_id = viewer.id
          AND request.status = 'approved'
      )
    ) AS can_view
  ) allowed
  ORDER BY minute.meeting_date DESC, minute.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.request_meeting_minute_access(
  p_minute_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer public.users%ROWTYPE;
  minute public.meeting_minutes%ROWTYPE;
  request_id UUID;
BEGIN
  SELECT * INTO viewer FROM public.users WHERE id = auth.uid() AND is_active = true;
  SELECT * INTO minute FROM public.meeting_minutes WHERE id = p_minute_id;
  IF viewer.id IS NULL OR minute.id IS NULL OR viewer.company_id <> minute.company_id THEN
    RAISE EXCEPTION 'resource not found';
  END IF;
  IF viewer.department_id = minute.department_id THEN
    RAISE EXCEPTION 'own department minute does not require approval';
  END IF;
  IF char_length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'reason is too short';
  END IF;
  INSERT INTO public.minute_access_requests (
    company_id, minute_id, requester_id, requester_department_id,
    target_department_id, reason
  ) VALUES (
    viewer.company_id, minute.id, viewer.id, viewer.department_id,
    minute.department_id, trim(p_reason)
  ) RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_meeting_minutes_for_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_meeting_minutes_for_user() TO authenticated;
REVOKE ALL ON FUNCTION public.request_meeting_minute_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_meeting_minute_access(UUID, TEXT) TO authenticated;

ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minute_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_minutes_select ON public.meeting_minutes
FOR SELECT TO authenticated USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  AND (
    department_id = (SELECT department_id FROM public.users WHERE id = auth.uid())
    OR (SELECT role IN ('admin', 'super_admin') FROM public.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.minute_access_requests request
      WHERE request.minute_id = meeting_minutes.id
        AND request.requester_id = auth.uid()
        AND request.status = 'approved'
    )
  )
);

CREATE POLICY meeting_minutes_insert ON public.meeting_minutes
FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  AND (
    department_id = (SELECT department_id FROM public.users WHERE id = auth.uid())
    OR (SELECT role IN ('admin', 'super_admin') FROM public.users WHERE id = auth.uid())
  )
);

CREATE POLICY meeting_minutes_update ON public.meeting_minutes
FOR UPDATE TO authenticated USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  AND (
    created_by = auth.uid()
    OR (SELECT role IN ('admin', 'super_admin') FROM public.users WHERE id = auth.uid())
  )
) WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

CREATE POLICY minute_requests_select ON public.minute_access_requests
FOR SELECT TO authenticated USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  AND (
    requester_id = auth.uid()
    OR (SELECT role IN ('admin', 'super_admin') FROM public.users WHERE id = auth.uid())
  )
);

CREATE POLICY minute_requests_insert ON public.minute_access_requests
FOR INSERT TO authenticated WITH CHECK (
  requester_id = auth.uid()
  AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.meeting_minutes minute
    WHERE minute.id = minute_id
      AND minute.company_id = company_id
      AND minute.department_id = target_department_id
  )
);

CREATE POLICY minute_requests_review ON public.minute_access_requests
FOR UPDATE TO authenticated USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  AND (SELECT role IN ('admin', 'super_admin') FROM public.users WHERE id = auth.uid())
) WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  AND reviewed_by = auth.uid()
);

INSERT INTO public.schema_migrations (version, description)
VALUES ('phase15', 'Department meeting minutes and cross-department approval')
ON CONFLICT (version) DO NOTHING;
