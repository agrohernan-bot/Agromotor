-- AgroMotor - proteccion de datos de lotes
-- Objetivo: eliminar perdidas por sincronizacion incompleta y permitir restauracion.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_reason text;

CREATE INDEX IF NOT EXISTS idx_lotes_user_not_deleted
  ON public.lotes (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.lotes_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lote_id text NOT NULL,
  nombre text NOT NULL DEFAULT 'Lote',
  accion text NOT NULL DEFAULT 'sync_auto',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotes_versiones_user_lote_created
  ON public.lotes_versiones (user_id, lote_id, created_at DESC);

ALTER TABLE public.lotes_versiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_versiones_select_own" ON public.lotes_versiones;
CREATE POLICY "lotes_versiones_select_own"
  ON public.lotes_versiones
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "lotes_versiones_insert_own" ON public.lotes_versiones;
CREATE POLICY "lotes_versiones_insert_own"
  ON public.lotes_versiones
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

GRANT SELECT, INSERT ON public.lotes_versiones TO authenticated;
