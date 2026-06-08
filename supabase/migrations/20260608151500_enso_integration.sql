-- AgroMotor - Integracion de AgroENSO e indice ONI de NOAA
-- Migracion para crear las tablas enso_rendimiento y oni_cache con RLS y permisos.

CREATE TABLE IF NOT EXISTS public.enso_rendimiento (
  id SERIAL PRIMARY KEY,
  provincia_id SMALLINT NOT NULL,
  depto_id INTEGER NOT NULL,
  provincia_nombre TEXT,
  depto_nombre TEXT,
  cultivo TEXT NOT NULL,
  fase_enso TEXT NOT NULL CHECK (fase_enso IN ('ElNino','LaNina','Neutral')),
  rend_promedio_kgha NUMERIC(8,1),
  rend_general_kgha NUMERIC(8,1),
  rend_vs_promedio_pct NUMERIC(5,1),
  significativo BOOLEAN DEFAULT FALSE,
  alguna_fase_sig BOOLEAN DEFAULT FALSE,
  n_campanas SMALLINT,
  UNIQUE(provincia_id, depto_id, cultivo, fase_enso)
);

CREATE INDEX IF NOT EXISTS idx_enso_lookup ON public.enso_rendimiento(provincia_id, depto_id, cultivo);

CREATE TABLE IF NOT EXISTS public.oni_cache (
  id INTEGER DEFAULT 1 PRIMARY KEY,
  fase_actual TEXT NOT NULL,
  oni_valor NUMERIC(4,2),
  trimestre TEXT,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Sembrado inicial de cache
INSERT INTO public.oni_cache (id, fase_actual, oni_valor, trimestre)
VALUES (1, 'Neutral', 0.0, 'MAM 2026')
ON CONFLICT (id) DO NOTHING;

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.enso_rendimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oni_cache ENABLE ROW LEVEL SECURITY;

-- Politicas para permitir lectura a usuarios autenticados
DROP POLICY IF EXISTS "enso_rendimiento_select" ON public.enso_rendimiento;
CREATE POLICY "enso_rendimiento_select"
  ON public.enso_rendimiento
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "oni_cache_select" ON public.oni_cache;
CREATE POLICY "oni_cache_select"
  ON public.oni_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Otorgar permisos de lectura a usuarios autenticados
GRANT SELECT ON public.enso_rendimiento TO authenticated;
GRANT SELECT ON public.oni_cache TO authenticated;
