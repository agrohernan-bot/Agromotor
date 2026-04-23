-- ════════════════════════════════════════════════════════
-- AGROMOTOR · Migración 001 — Tabla profiles + Auth trigger
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ════════════════════════════════════════════════════════

-- ── Tabla profiles ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       TEXT        NOT NULL DEFAULT '',
  plan         TEXT        NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free', 'asesor', 'empresa')),
  plan_hasta   TIMESTAMPTZ,           -- NULL = sin vencimiento pagado
  trial_hasta  TIMESTAMPTZ,           -- 14 días para asesor/empresa nuevos
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede leer/editar su propio perfil
CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── Trigger: crear perfil automáticamente al registrarse ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, plan, trial_hasta)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'plan', 'free'),
    -- Trial de 14 días solo para planes pagos
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'plan', 'free') <> 'free'
      THEN NOW() + INTERVAL '14 days'
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Índice para búsquedas por plan (futuro dashboard admin) ──
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);
