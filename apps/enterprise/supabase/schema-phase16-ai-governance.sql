-- Phase 16: company-level AI governance, quotas and immutable usage reservations

CREATE TABLE IF NOT EXISTS public.ai_usage_policies (
  company_id TEXT PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  general_ai_enabled BOOLEAN NOT NULL DEFAULT false,
  emergency_stop BOOLEAN NOT NULL DEFAULT false,
  monthly_request_limit INTEGER NOT NULL DEFAULT 500
    CHECK (monthly_request_limit BETWEEN 10 AND 100000),
  daily_user_limit INTEGER NOT NULL DEFAULT 20
    CHECK (daily_user_limit BETWEEN 1 AND 1000),
  per_minute_limit INTEGER NOT NULL DEFAULT 5
    CHECK (per_minute_limit BETWEEN 1 AND 100),
  max_input_chars INTEGER NOT NULL DEFAULT 2000
    CHECK (max_input_chars BETWEEN 100 AND 4000),
  max_output_chars INTEGER NOT NULL DEFAULT 3000
    CHECK (max_output_chars BETWEEN 200 AND 10000),
  allow_internal_context BOOLEAN NOT NULL DEFAULT false
    CHECK (allow_internal_context = false),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answer_mode TEXT NOT NULL DEFAULT 'general' CHECK (answer_mode = 'general'),
  external_api_used BOOLEAN NOT NULL DEFAULT true,
  input_chars INTEGER NOT NULL CHECK (input_chars >= 0),
  output_chars INTEGER NOT NULL DEFAULT 0 CHECK (output_chars >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_company_month
  ON public.ai_usage_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_day
  ON public.ai_usage_events(company_id, user_id, created_at DESC);

ALTER TABLE public.ai_usage_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_usage_policies FROM anon, authenticated;
REVOKE ALL ON public.ai_usage_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
  p_company_id TEXT,
  p_user_id UUID,
  p_input_chars INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy public.ai_usage_policies%ROWTYPE;
  month_count INTEGER;
  day_count INTEGER;
  minute_count INTEGER;
  event_id UUID;
  result_summary JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND company_id = p_company_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'persistence_required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id));

  SELECT * INTO policy
  FROM public.ai_usage_policies
  WHERE company_id = p_company_id;

  IF policy.company_id IS NULL OR NOT policy.general_ai_enabled THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'general_disabled');
  END IF;
  IF policy.emergency_stop THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'emergency_stop');
  END IF;
  IF p_input_chars > policy.max_input_chars THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'input_too_long');
  END IF;

  SELECT count(*) INTO month_count
  FROM public.ai_usage_events
  WHERE company_id = p_company_id
    AND created_at >= date_trunc('month', now());

  SELECT count(*) INTO day_count
  FROM public.ai_usage_events
  WHERE company_id = p_company_id
    AND user_id = p_user_id
    AND created_at >= date_trunc('day', now());

  SELECT count(*) INTO minute_count
  FROM public.ai_usage_events
  WHERE company_id = p_company_id
    AND created_at >= now() - interval '1 minute';

  result_summary := jsonb_build_object(
    'monthly_used', month_count,
    'daily_user_used', day_count,
    'minute_used', minute_count
  );

  IF month_count >= policy.monthly_request_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'summary', result_summary);
  END IF;
  IF day_count >= policy.daily_user_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_user_limit', 'summary', result_summary);
  END IF;
  IF minute_count >= policy.per_minute_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'per_minute_limit', 'summary', result_summary);
  END IF;

  INSERT INTO public.ai_usage_events (company_id, user_id, input_chars)
  VALUES (p_company_id, p_user_id, p_input_chars)
  RETURNING id INTO event_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'event_id', event_id,
    'summary', jsonb_build_object(
      'monthly_used', month_count + 1,
      'daily_user_used', day_count + 1,
      'minute_used', minute_count + 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(TEXT, UUID, INTEGER) TO service_role;

INSERT INTO public.schema_migrations (version, description)
VALUES ('phase16', 'Company AI governance policies and usage quotas')
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE public.ai_usage_policies IS
  'Per-company external AI enablement, emergency stop, input/output limits and quotas';
COMMENT ON TABLE public.ai_usage_events IS
  'Reserved external AI requests used for cost and abuse controls';
