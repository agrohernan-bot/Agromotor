// ════════════════════════════════════════════════════════
// AGROMOTOR — mp-webhook
// Recibe eventos de Mercado Pago (preapproval changes + payments)
// y actualiza profiles.plan_hasta + tabla payments/subscriptions.
//
// Eventos esperados:
//   - preapproval: cambios en la suscripción (authorized, paused, cancelled)
//   - subscription_authorized_payment: cada cobro mensual exitoso
//   - payment: pago individual (lo usamos para auditoría)
// ════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_TOKEN) return new Response('MP_ACCESS_TOKEN missing', { status: 500 });

    const body = await req.json();
    const type = body.type || body.action?.split('.')[0] || 'unknown';
    const dataId = body.data?.id;

    console.log('mp-webhook event:', type, dataId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── PREAPPROVAL: suscripción autorizada / pausada / cancelada ──
    if (type === 'preapproval' && dataId) {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
      });
      const sub = await r.json();

      // external_reference = "userId|plan"
      const [userId, plan] = (sub.external_reference || '').split('|');

      const newStatus = (sub.status === 'authorized' || sub.status === 'paused' ||
                        sub.status === 'cancelled' || sub.status === 'pending') ? sub.status : 'pending';

      // Actualizar tabla subscriptions
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        mp_preapproval_id: sub.id,
        plan,
        status: newStatus === 'expired' ? 'cancelled' : newStatus,
        amount_ars: sub.auto_recurring?.transaction_amount,
        amount_usd: 0, // se actualiza al crear, no al webhook
        next_payment_at: sub.next_payment_date,
      }, { onConflict: 'mp_preapproval_id' });

      // Si se autorizó, extender plan_hasta del user 1 mes
      if (newStatus === 'authorized' && userId && plan) {
        const ahora = new Date();
        const planHasta = new Date(ahora.getTime() + 31 * 24 * 60 * 60 * 1000);
        await supabase.from('profiles').update({
          plan,
          plan_hasta: planHasta.toISOString(),
          trial_hasta: null, // termina trial
        }).eq('id', userId);
      }

      // Si se canceló o expiró, downgrade a free al final del período actual
      if (newStatus === 'cancelled' && userId) {
        // No tocamos plan_hasta — el user mantiene acceso hasta que venza el período pago
        await supabase.from('subscriptions').update({ status: 'cancelled' })
          .eq('mp_preapproval_id', sub.id);
      }
    }

    // ── PAYMENT: cobro individual (sea de suscripción o no) ──
    if ((type === 'payment' || type === 'subscription_authorized_payment') && dataId) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
      });
      const pay = await r.json();

      let userId: string | null = null;
      let subId: string | null = null;

      // Si el payment está vinculado a un preapproval, buscamos la suscripción
      const preapprovalId = pay.preapproval_id || pay.metadata?.preapproval_id;
      if (preapprovalId) {
        const { data: sub } = await supabase.from('subscriptions')
          .select('id, user_id').eq('mp_preapproval_id', preapprovalId).single();
        userId = sub?.user_id || null;
        subId = sub?.id || null;
      }

      // Fallback: external_reference
      if (!userId && pay.external_reference) {
        userId = (pay.external_reference.split('|')[0]) || null;
      }

      if (userId) {
        // Registrar el pago (idempotente vía mp_payment_id UNIQUE)
        await supabase.from('payments').upsert({
          user_id: userId,
          subscription_id: subId,
          mp_payment_id: String(pay.id),
          amount_ars: pay.transaction_amount,
          status: pay.status,
          status_detail: pay.status_detail,
          paid_at: pay.date_approved || null,
          raw: pay,
        }, { onConflict: 'mp_payment_id' });

        // Si fue aprobado y es de suscripción, extender plan_hasta 1 mes más
        if (pay.status === 'approved' && subId) {
          const { data: prof } = await supabase.from('profiles')
            .select('plan_hasta').eq('id', userId).single();
          const ahora = new Date();
          const base = prof?.plan_hasta && new Date(prof.plan_hasta) > ahora
            ? new Date(prof.plan_hasta) : ahora;
          const nuevoPlanHasta = new Date(base.getTime() + 31 * 24 * 60 * 60 * 1000);
          await supabase.from('profiles').update({
            plan_hasta: nuevoPlanHasta.toISOString(),
          }).eq('id', userId);
        }
      }
    }

    // ACK rápido a MP
    return new Response('OK', { status: 200, headers: CORS });

  } catch (e) {
    console.error('mp-webhook error:', e);
    // IMPORTANTE: devolvemos 200 igual para que MP no reintente indefinidamente
    // (los errores quedan en logs para auditoría)
    return new Response('OK', { status: 200, headers: CORS });
  }
});
