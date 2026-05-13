-- ════════════════════════════════════════════════════════
-- AGROMOTOR · Migración 003 — Integración Mercado Pago
-- Tablas para suscripciones, pagos e historial de facturación
-- ════════════════════════════════════════════════════════

-- 1. Actualizar constraint de planes en profiles para incluir el plan 'pro' (si faltaba)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'asesor', 'pro', 'empresa'));

-- 2. Tabla de Suscripciones (Preapprovals)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mp_preapproval_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL CHECK (plan IN ('asesor', 'pro', 'empresa')),
    status TEXT NOT NULL DEFAULT 'pending',
    amount_ars NUMERIC,
    amount_usd NUMERIC,
    next_payment_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Pagos Individuales
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    mp_payment_id TEXT NOT NULL UNIQUE,
    amount_ars NUMERIC NOT NULL,
    status TEXT NOT NULL,
    status_detail TEXT,
    paid_at TIMESTAMPTZ,
    raw JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas para subscriptions: usuarios pueden leer sus propias suscripciones (no editar)
CREATE POLICY "own_subscriptions_select" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Políticas para payments: usuarios pueden leer sus propios pagos (no editar)
CREATE POLICY "own_payments_select" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Función genérica para actualizar timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para subscriptions.updated_at
DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
