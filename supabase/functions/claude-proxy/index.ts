// ════════════════════════════════════════════════════════
// AGROMOTOR — claude-proxy (Supabase Edge Function)
// Proxy seguro entre el browser y la API de Anthropic.
// La CLAUDE_API_KEY nunca sale del servidor.
// Deploy: supabase functions deploy claude-proxy
// Secrets: supabase secrets set CLAUDE_API_KEY=sk-ant-...
// ════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Límites mensuales por plan
const IA_LIMITES: Record<string, number> = {
  asesor:  30,
  pro:     100,
  empresa: 300,
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // ── 1. Verificar token de sesión ─────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'No autorizado. Iniciá sesión primero.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return json({ error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' }, 401);
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

    if (!(planActivo in IA_LIMITES) || (!planPago && !enTrial)) {
      return json({
        error: 'El Asistente IA requiere plan Asesor Pro o Empresa. Actualizá tu plan.'
      }, 403);
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
      }, 429);
    }

    // ── 4. Reenviar a Claude API ──────────────────────
    const body = await req.json();

    // Prompt caching: el system prompt de AgroMotor es ~80% estático
    // (rol del asistente, reglas, especialidades). Lo separamos en bloque
    // cacheable. Ahorra ~30% en input tokens cuando el cache hits.
    const systemBlocks = (typeof body.system === 'string' && body.system.length > 1024)
      ? [{ type: 'text', text: body.system, cache_control: { type: 'ephemeral' } }]
      : body.system;

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
    return json({ error: 'Error interno del servidor.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
