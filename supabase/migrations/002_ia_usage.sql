-- ════════════════════════════════════════════════════════
-- AgroMotor — Límite mensual de consultas al Asistente IA
-- ════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ia_calls_this_month integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS ia_reset_date        date    DEFAULT CURRENT_DATE NOT NULL;
