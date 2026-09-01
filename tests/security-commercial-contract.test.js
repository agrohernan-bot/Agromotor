const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('la documentación no publica credenciales operativas', () => {
  const docs = ['README.md', 'STATUS.md', 'task.md', 'walkthrough.md']
    .filter((file) => fs.existsSync(path.join(ROOT, file)))
    .map((file) => `${file}\n${read(file)}`)
    .join('\n');

  assert.doesNotMatch(docs, /(?:password|contraseña)\s*:\s*`[^`]+`/i);
  assert.doesNotMatch(docs, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
});

test('la oferta pública no conserva la promoción vencida ni planes legacy', () => {
  const publicCopy = ['app.html', 'index.html', 'README.md', 'terminos.html']
    .map(read)
    .join('\n');

  assert.doesNotMatch(publicCopy, /1(?:°)? de agosto de 2026|gratis hasta agosto/i);
  assert.doesNotMatch(publicCopy, /USD\s*(?:90|230)/i);
  assert.match(publicCopy, /30 días sin cargo/i);
  assert.match(publicCopy, /USD 35/i);
  assert.match(publicCopy, /20 lotes/i);
});

test('el proxy IA exige vigencia y usa el cupo Profesional único', () => {
  const proxy = read('supabase/functions/claude-proxy/index.ts');

  assert.match(proxy, /free:\s+0/);
  assert.match(proxy, /asesor:\s+30/);
  assert.match(proxy, /pro:\s+30/);
  assert.match(proxy, /empresa:\s+30/);
  assert.match(proxy, /planPago \|\| enTrial/);
  assert.doesNotMatch(proxy, /EN_PROMO|PROMO_FIN/);
});

test('registro, cobro y base de datos comparten la prueba Profesional', () => {
  const app = read('app.html');
  const checkout = read('supabase/functions/mp-crear-suscripcion/index.ts');
  const migration = read('supabase/migrations/20260901120000_professional_trial_30_days.sql');

  assert.match(app, /id="am-reg-plan" value="asesor"/);
  assert.doesNotMatch(checkout, /usd:\s*(?:90|230)/);
  assert.match(checkout, /asesor:\s*\{ ars: 50000, usd: 35/);
  assert.match(migration, /INTERVAL '30 days'/);
});

test('el alta y el perfil no confían privilegios al navegador', () => {
  const migration = read('supabase/migrations/20260901120000_professional_trial_30_days.sql');

  assert.match(migration, /raw_user_meta_data->>'plan' IN \('asesor', 'pro', 'empresa'\)/);
  assert.match(migration, /raw_user_meta_data->>'rol' = 'estudiante'/);
  assert.doesNotMatch(migration, /COALESCE\(NEW\.raw_user_meta_data->>'rol'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC/);
  assert.match(migration, /CREATE TRIGGER protect_profile_entitlements/);
  assert.match(migration, /OLD\.plan IS DISTINCT FROM NEW\.plan/);
  assert.match(migration, /OLD\.lotes_extra IS DISTINCT FROM NEW\.lotes_extra/);
  assert.match(migration, /OLD\.ia_calls_this_month IS DISTINCT FROM NEW\.ia_calls_this_month/);
  assert.match(migration, /OLD\.rol IS DISTINCT FROM NEW\.rol/);
});

test('las funciones internas de auditoría no quedan expuestas como RPC', () => {
  const migration = read('supabase/migrations/20260901115624_harden_trigger_function_permissions.sql');

  assert.match(migration, /REVOKE ALL ON FUNCTION public\.log_auth_user_created_admin_event\(\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.log_auth_user_deleted_admin_event\(\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.log_profile_admin_event\(\) FROM PUBLIC/);
  assert.match(migration, /ALTER FUNCTION public\.update_updated_at\(\) SET search_path = public/);
  assert.match(migration, /ALTER FUNCTION public\.set_lotes_updated_at\(\) SET search_path = public/);
});

test('CI ejecuta la suite completa', () => {
  const workflow = read('.github/workflows/regression-tests.yml');
  assert.match(workflow, /node --test tests\/\*\.test\.js/);
});
