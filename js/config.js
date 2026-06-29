// ════════════════════════════════════════════════════════
// AGROMOTOR — config.js
// Configuración central · completar credenciales antes del deploy
// Cargado antes de login.js, plagas.js y asistente.js
// ════════════════════════════════════════════════════════

window.AM_CONFIG = {
  supabase: {
    url:     'https://xsbaqlqztppdpdcjgazz.supabase.co',
    anonKey: 'sb_publishable_v37KGDs2Z4CPbF4I5RHUXA_Rlz8RrRK'
  },
  assetVersion: '184',
  claudeProxy: 'https://xsbaqlqztppdpdcjgazz.supabase.co/functions/v1/claude-proxy',
  ensoProxy: '/api/enso',
  soilProxy: '/api/soil',
  marketProxy: '/api/market',
  agromonitoringKey: 'b0fc7778f1bef4d4b5e2076f0c75845f'
};

// ── Cliente Supabase compartido ───────────────────────
// Usado por login.js, plagas.js y asistente.js.
// La anon key es pública por diseño: Supabase la expone en el client.
// La seguridad real viene de RLS (Row Level Security) en la DB.
window.AM_SB = supabase.createClient(
  AM_CONFIG.supabase.url,
  AM_CONFIG.supabase.anonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
