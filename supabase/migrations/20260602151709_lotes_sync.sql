-- AgroMotor - sincronizacion de lotes por usuario
-- Fuente remota para que los lotes creados en celular/PC viajen con el login.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lote_id text NOT NULL,
  nombre text NOT NULL DEFAULT 'Lote',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  activo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lote_id)
);

CREATE INDEX IF NOT EXISTS idx_lotes_user_updated
  ON public.lotes (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lotes_user_activo
  ON public.lotes (user_id)
  WHERE activo;

CREATE OR REPLACE FUNCTION public.set_lotes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_lotes_updated_at ON public.lotes;
CREATE TRIGGER set_lotes_updated_at
  BEFORE UPDATE ON public.lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lotes_updated_at();

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_select_own" ON public.lotes;
CREATE POLICY "lotes_select_own"
  ON public.lotes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lotes_insert_own" ON public.lotes;
CREATE POLICY "lotes_insert_own"
  ON public.lotes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lotes_update_own" ON public.lotes;
CREATE POLICY "lotes_update_own"
  ON public.lotes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lotes_delete_own" ON public.lotes;
CREATE POLICY "lotes_delete_own"
  ON public.lotes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes TO authenticated;
