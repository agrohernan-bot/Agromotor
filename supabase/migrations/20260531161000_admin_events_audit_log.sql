-- AgroMotor: auditoria administrativa.
-- Registra altas/bajas de usuarios y cambios sensibles de perfiles.

CREATE TABLE IF NOT EXISTS public.admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid,
  target_email text,
  target_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_events_created_at
  ON public.admin_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_events_event_type
  ON public.admin_events(event_type);

CREATE INDEX IF NOT EXISTS idx_admin_events_target_user
  ON public.admin_events(target_user_id);

ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.admin_events TO authenticated;

DROP POLICY IF EXISTS "admin_events_select" ON public.admin_events;
CREATE POLICY "admin_events_select" ON public.admin_events
  FOR SELECT
  USING (app_private.is_admin());

DROP POLICY IF EXISTS "admin_events_insert" ON public.admin_events;
CREATE POLICY "admin_events_insert" ON public.admin_events
  FOR INSERT
  WITH CHECK (app_private.is_admin());

CREATE OR REPLACE FUNCTION app_private.log_admin_event(
  p_event_type text,
  p_actor_user_id uuid DEFAULT auth.uid(),
  p_target_user_id uuid DEFAULT NULL,
  p_target_email text DEFAULT NULL,
  p_target_name text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
SET row_security = off
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_events (
    event_type,
    actor_user_id,
    target_user_id,
    target_email,
    target_name,
    metadata
  )
  VALUES (
    p_event_type,
    p_actor_user_id,
    p_target_user_id,
    p_target_email,
    p_target_name,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION app_private.log_admin_event(text, uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.log_admin_event(text, uuid, uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_auth_user_created_admin_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
SET row_security = off
AS $$
BEGIN
  PERFORM app_private.log_admin_event(
    'user_created',
    NULL,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    jsonb_build_object(
      'plan', COALESCE(NEW.raw_user_meta_data->>'plan', 'free'),
      'rol', COALESCE(NEW.raw_user_meta_data->>'rol', 'agronomo'),
      'cpia', NEW.raw_user_meta_data->>'cpia',
      'matricula_numero', NEW.raw_user_meta_data->>'matricula_numero',
      'provider', NEW.raw_app_meta_data->>'provider'
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_auth_user_deleted_admin_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
SET row_security = off
AS $$
BEGIN
  PERFORM app_private.log_admin_event(
    'user_deleted',
    NULL,
    OLD.id,
    OLD.email,
    COALESCE(OLD.raw_user_meta_data->>'nombre', split_part(OLD.email, '@', 1)),
    jsonb_build_object(
      'deleted_at', now(),
      'last_sign_in_at', OLD.last_sign_in_at
    )
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_event ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_event
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.log_auth_user_created_admin_event();

DROP TRIGGER IF EXISTS on_auth_user_deleted_admin_event ON auth.users;
CREATE TRIGGER on_auth_user_deleted_admin_event
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.log_auth_user_deleted_admin_event();

CREATE OR REPLACE FUNCTION public.log_profile_admin_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
SET row_security = off
AS $$
DECLARE
  v_changed jsonb := '{}'::jsonb;
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    v_changed := v_changed || jsonb_build_object('plan', jsonb_build_object('old', OLD.plan, 'new', NEW.plan));
  END IF;
  IF OLD.rol IS DISTINCT FROM NEW.rol THEN
    v_changed := v_changed || jsonb_build_object('rol', jsonb_build_object('old', OLD.rol, 'new', NEW.rol));
  END IF;
  IF OLD.cpia IS DISTINCT FROM NEW.cpia THEN
    v_changed := v_changed || jsonb_build_object('cpia', jsonb_build_object('old', OLD.cpia, 'new', NEW.cpia));
  END IF;
  IF OLD.matricula_numero IS DISTINCT FROM NEW.matricula_numero THEN
    v_changed := v_changed || jsonb_build_object('matricula_numero', jsonb_build_object('old', OLD.matricula_numero, 'new', NEW.matricula_numero));
  END IF;
  IF OLD.matricula_verificada IS DISTINCT FROM NEW.matricula_verificada THEN
    v_changed := v_changed || jsonb_build_object('matricula_verificada', jsonb_build_object('old', OLD.matricula_verificada, 'new', NEW.matricula_verificada));
  END IF;
  IF OLD.plan_hasta IS DISTINCT FROM NEW.plan_hasta THEN
    v_changed := v_changed || jsonb_build_object('plan_hasta', jsonb_build_object('old', OLD.plan_hasta, 'new', NEW.plan_hasta));
  END IF;
  IF OLD.trial_hasta IS DISTINCT FROM NEW.trial_hasta THEN
    v_changed := v_changed || jsonb_build_object('trial_hasta', jsonb_build_object('old', OLD.trial_hasta, 'new', NEW.trial_hasta));
  END IF;

  IF v_changed <> '{}'::jsonb THEN
    PERFORM app_private.log_admin_event(
      CASE
        WHEN OLD.matricula_verificada IS DISTINCT FROM NEW.matricula_verificada
          THEN CASE WHEN NEW.matricula_verificada THEN 'matricula_verified' ELSE 'matricula_revoked' END
        WHEN OLD.plan IS DISTINCT FROM NEW.plan OR OLD.plan_hasta IS DISTINCT FROM NEW.plan_hasta OR OLD.trial_hasta IS DISTINCT FROM NEW.trial_hasta
          THEN 'plan_changed'
        ELSE 'profile_updated'
      END,
      auth.uid(),
      NEW.id,
      NEW.email,
      NEW.nombre,
      jsonb_build_object('changes', v_changed)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_admin_event ON public.profiles;
CREATE TRIGGER on_profile_admin_event
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_admin_event();

INSERT INTO public.admin_events (
  event_type,
  actor_user_id,
  target_user_id,
  target_email,
  target_name,
  metadata,
  created_at
)
SELECT
  'user_existing',
  NULL,
  p.id,
  p.email,
  p.nombre,
  jsonb_build_object(
    'plan', p.plan,
    'rol', p.rol,
    'cpia', p.cpia,
    'matricula_numero', p.matricula_numero,
    'matricula_verificada', p.matricula_verificada
  ),
  COALESCE(p.created_at, now())
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.admin_events e
  WHERE e.event_type = 'user_existing'
    AND e.target_user_id = p.id
);
