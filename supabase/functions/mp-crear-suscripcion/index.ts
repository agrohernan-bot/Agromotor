// ════════════════════════════════════════════════════════
// AGROMOTOR — mp-crear-suscripcion
// Crea un preapproval (suscripción mensual recurrente) en Mercado Pago
// y devuelve el init_point para redirigir al usuario al checkout.
// ════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Precios en ARS (configurable). USD ref es la base.
// Aproximamos al dólar oficial ~ARS 1400 (ajustá con BCRA si querés precio dinámico).
const PLANES_AR = {
  asesor:  { ars: 50000,  usd: 35,  nombre: 'AgroMotor Asesor' },
  pro:     { ars: 130000, usd: 90,  nombre: 'AgroMotor Pro ⭐' },
  empresa: { ars: 320000, usd: 230, nombre: 'AgroMotor Empresa' },
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'No autorizado.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Sesión inválida.' }, 401);

    const { plan } = await req.json();
    const planInfo = (PLANES_AR as any)[plan];
    if (!planInfo) return json({ error: 'Plan inválido.' }, 400);

    const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_TOKEN) return json({ error: 'MP_ACCESS_TOKEN no configurado en secrets.' }, 500);

    // URL del sitio (usa la que esté configurada o el default)
    const siteUrl = Deno.env.get('SITE_URL') || 'https://agromotor.com.ar';

    // Crear preapproval (suscripción mensual)
    const preapprovalBody = {
      reason: planInfo.nombre,
      external_reference: `${user.id}|${plan}`,
      payer_email: user.email,
      back_url: `${siteUrl}/app.html?subscription=success`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planInfo.ars,
        currency_id: 'ARS',
      },
      status: 'pending',
    };

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preapprovalBody),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP error:', mpData);
      return json({ error: 'Error creando suscripción en Mercado Pago.', detail: mpData }, mpRes.status);
    }

    // Persistir suscripción pending en DB
    await supabase.from('subscriptions').insert({
      user_id: user.id,
      mp_preapproval_id: mpData.id,
      plan,
      status: 'pending',
      amount_ars: planInfo.ars,
      amount_usd: planInfo.usd,
      metadata: { init_point: mpData.init_point },
    });

    return json({
      ok: true,
      init_point: mpData.init_point,    // URL a la que redirigir al usuario
      preapproval_id: mpData.id,
    });

  } catch (e) {
    console.error('mp-crear-suscripcion error:', e);
    return json({ error: 'Error interno.', stack: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
