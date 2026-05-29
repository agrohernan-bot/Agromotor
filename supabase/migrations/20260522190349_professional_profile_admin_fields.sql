-- AgroMotor: campos profesionales, acceso admin y vista de matrícula.
-- El frontend ya usa estos campos para registro, perfil y panel admin.

CREATE SCHEMA IF NOT EXISTS app_private;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'asesor', 'pro', 'empresa'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'agronomo'
    CHECK (rol IN ('agronomo', 'estudiante', 'admin')),
  ADD COLUMN IF NOT EXISTS cpia text,
  ADD COLUMN IF NOT EXISTS matricula_numero text,
  ADD COLUMN IF NOT EXISTS matricula_verificada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS matricula_declarada_at timestamptz,
  ADD COLUMN IF NOT EXISTS matricula_verificada_at timestamptz,
  ADD COLUMN IF NOT EXISTS universidad text,
  ADD COLUMN IF NOT EXISTS anio_cursado text;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND rol = 'admin'
  );
$$;

GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_admin() TO authenticated;

DROP POLICY IF EXISTS "admin_profiles_select" ON public.profiles;
CREATE POLICY "admin_profiles_select" ON public.profiles
  FOR SELECT
  USING (app_private.is_admin());

DROP POLICY IF EXISTS "admin_profiles_update" ON public.profiles;
CREATE POLICY "admin_profiles_update" ON public.profiles
  FOR UPDATE
  USING (app_private.is_admin())
  WITH CHECK (app_private.is_admin());

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
    COALESCE(NEW.raw_user_meta_data->>'plan', 'free'),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'plan', 'free') <> 'free'
      THEN NOW() + INTERVAL '14 days'
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'agronomo'),
    NEW.raw_user_meta_data->>'cpia',
    NEW.raw_user_meta_data->>'matricula_numero',
    CASE
      WHEN NEW.raw_user_meta_data ? 'matricula_numero' THEN NOW()
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'universidad',
    NEW.raw_user_meta_data->>'anio_cursado'
  );
  RETURN NEW;
END;
$$;

DROP VIEW IF EXISTS public.admin_matriculas;
CREATE OR REPLACE VIEW public.admin_matriculas
WITH (security_invoker = true)
AS
SELECT
  id,
  email,
  nombre,
  rol,
  cpia,
  matricula_numero,
  matricula_verificada,
  matricula_declarada_at,
  matricula_verificada_at,
  universidad,
  anio_cursado,
  plan,
  created_at AS registrado_en
FROM public.profiles
WHERE app_private.is_admin();

GRANT SELECT ON public.admin_matriculas TO authenticated;
