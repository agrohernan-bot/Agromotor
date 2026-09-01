-- AgroMotor - alta coherente con la prueba Profesional vigente.
-- La metadata del navegador no es una fuente de autorización: solo se aceptan
-- los valores públicos previstos por el formulario y nunca el rol admin.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, nombre, plan, trial_hasta, rol, cpia, matricula_numero,
    matricula_declarada_at, universidad, anio_cursado
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.raw_user_meta_data->>'plan' IN ('asesor', 'pro', 'empresa')
      THEN 'asesor'
      ELSE 'free'
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'plan' IN ('asesor', 'pro', 'empresa')
      THEN NOW() + INTERVAL '30 days'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'rol' = 'estudiante' THEN 'estudiante'
      ELSE 'agronomo'
    END,
    NEW.raw_user_meta_data->>'cpia',
    NEW.raw_user_meta_data->>'matricula_numero',
    CASE
      WHEN NEW.raw_user_meta_data ? 'matricula_numero' THEN NOW()
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'universidad',
    NEW.raw_user_meta_data->>'anio_cursado'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nombre = COALESCE(EXCLUDED.nombre, public.profiles.nombre);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- El dueño del perfil puede editar sus datos profesionales, pero no puede
-- autoasignarse un plan, extender una prueba ni convertirse en administrador.
CREATE OR REPLACE FUNCTION app_private.protect_profile_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF auth.uid() = OLD.id
     AND NOT app_private.is_admin()
     AND (
       OLD.plan IS DISTINCT FROM NEW.plan
       OR OLD.plan_hasta IS DISTINCT FROM NEW.plan_hasta
       OR OLD.trial_hasta IS DISTINCT FROM NEW.trial_hasta
       OR OLD.lotes_extra IS DISTINCT FROM NEW.lotes_extra
       OR OLD.ia_calls_this_month IS DISTINCT FROM NEW.ia_calls_this_month
       OR OLD.ia_reset_date IS DISTINCT FROM NEW.ia_reset_date
       OR OLD.rol IS DISTINCT FROM NEW.rol
       OR OLD.matricula_verificada IS DISTINCT FROM NEW.matricula_verificada
       OR OLD.matricula_verificada_at IS DISTINCT FROM NEW.matricula_verificada_at
     )
  THEN
    RAISE EXCEPTION 'No está permitido modificar privilegios del perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.protect_profile_entitlements() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.protect_profile_entitlements() FROM anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_entitlements ON public.profiles;
CREATE TRIGGER protect_profile_entitlements
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app_private.protect_profile_entitlements();
