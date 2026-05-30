// ════════════════════════════════════════════════════════
// AGROMOTOR — claude-proxy (Supabase Edge Function)
// Proxy seguro entre el browser y la API de Anthropic.
// La CLAUDE_API_KEY nunca sale del servidor.
// Deploy: supabase functions deploy claude-proxy
// Secrets: supabase secrets set CLAUDE_API_KEY=sk-ant-...
// ════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://agromotor.com.ar',
  'https://www.agromotor.com.ar',
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Límites mensuales por plan (consultas IA / mes)
// Período promo (hasta 01-ago-2026): plan free → 15 consultas/mes
// Post-promo: free → 0, planes pagos según tabla
// TODO: restaurar el 1° de agosto de 2026 (eliminar entrada 'free' de IA_LIMITES_PROMO)
const PROMO_FIN = new Date('2026-08-02');
const EN_PROMO  = new Date() < PROMO_FIN;

const IA_LIMITES: Record<string, number> = {
  free:    EN_PROMO ? 15 : 0,  // 15/mes durante promo, 0 post-promo
  asesor:  30,
  pro:     100,
  empresa: 300,
};

serve(async (req: Request) => {
  const CORS = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // ── 1. Verificar token de sesión ─────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'No autorizado. Iniciá sesión primero.' }, 401, CORS);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return json({ error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' }, 401, CORS);
    }

    // ── 2. Verificar plan activo ──────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, plan_hasta, trial_hasta, ia_calls_this_month, ia_reset_date')
      .eq('id', user.id)
      .single();

    const ahora     = new Date();
    const planActivo = profile?.plan ?? 'free';
    const planHasta  = profile?.plan_hasta  ? new Date(profile.plan_hasta)  : null;
    const trialHasta = profile?.trial_hasta ? new Date(profile.trial_hasta) : null;
    const planPago   = planHasta  && planHasta  > ahora;
    const enTrial    = trialHasta && trialHasta > ahora;

    // Verificar acceso al Asistente IA:
    // - Durante promo (hasta 01-ago-2026): plan free tiene 15 llamadas/mes → permitir
    // - Post-promo: solo planes pagos con suscripción/trial vigente
    const tieneAccesoIA = EN_PROMO
      ? (planActivo in IA_LIMITES && IA_LIMITES[planActivo] > 0)
      : ((planActivo in IA_LIMITES) && (planPago || enTrial));

    if (!tieneAccesoIA) {
      return json({
        error: EN_PROMO
          ? 'El Asistente IA requiere registrarse durante el período de lanzamiento.'
          : 'El Asistente IA requiere plan Asesor Pro o Empresa. Actualizá tu plan.',
      }, 403, CORS);
    }

    // ── 3. Verificar y actualizar contador mensual ────
    const limite = IA_LIMITES[planActivo];
    const hoyStr = ahora.toISOString().split('T')[0];

    let callsUsadas = profile?.ia_calls_this_month ?? 0;
    const resetDate = profile?.ia_reset_date ?? hoyStr;

    // Si cambió el mes, resetear el contador
    const mesActual = hoyStr.substring(0, 7);
    const mesReset  = String(resetDate).substring(0, 7);

    if (mesActual !== mesReset) {
      callsUsadas = 0;
      await supabase.from('profiles')
        .update({ ia_calls_this_month: 0, ia_reset_date: hoyStr })
        .eq('id', user.id);
    }

    if (limite !== -1 && callsUsadas >= limite) {
      const planLabels: Record<string, string> = { asesor: 'Asesor', pro: 'Pro', empresa: 'Empresa' };
      return json({
        error: `Alcanzaste el límite de ${limite} consultas mensuales del plan ${planLabels[planActivo] || planActivo}. El contador se reinicia el próximo mes.`,
        ia_remaining: 0,
        ia_total: limite,
      }, 429, CORS);
    }

    // ── 4. Reenviar a Claude API ──────────────────────
    const body = await req.json();

    // Validar y sanitizar system prompt del cliente.
    // Solo se acepta string; se trunca a 20 000 chars para prevenir abuso.
    const rawSystem = typeof body.system === 'string' ? body.system.slice(0, 20000) : null;
    const systemBlocks = rawSystem && rawSystem.length > 1024
      ? [{ type: 'text', text: rawSystem, cache_control: { type: 'ephemeral' } }]
      : rawSystem ?? undefined;

    const payload = {
      model:      body.model      ?? 'claude-sonnet-4-5',
      max_tokens: Math.min(body.max_tokens ?? 1000, 2000),
      system:     systemBlocks,
      messages:   body.messages,
    };

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         Deno.env.get('CLAUDE_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const claudeData = await claudeRes.json();

    if (!claudeRes.ok) {
      return new Response(JSON.stringify(claudeData), {
        status: claudeRes.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Incrementar contador tras respuesta exitosa ─
    const nuevasLlamadas = callsUsadas + 1;
    await supabase.from('profiles')
      .update({ ia_calls_this_month: nuevasLlamadas })
      .eq('id', user.id);

    const remaining = limite === -1 ? -1 : limite - nuevasLlamadas;

    return new Response(JSON.stringify({ ...claudeData, ia_remaining: remaining, ia_total: limite }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('claude-proxy error:', e);
    return json({ error: 'Error interno del servidor.' }, 500, CORS);
  }
});

function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
