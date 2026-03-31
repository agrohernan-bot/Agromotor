// ════════════════════════════════════════════════════════
// AGROMOTOR — login.js
// Sistema de planes · Free / Asesor Pro / Empresa
// Modal de registro/login · Control de acceso
// Demo con sessionStorage — listo para Supabase
// ════════════════════════════════════════════════════════

const AM_PLANES = {
  free: {
    nombre: 'Free',
    precio: 'Gratis',
    lotes: 1,
    modulos: ['siembra'],
    color: '#3A7A4A',
    icon: '🌱',
    desc: 'Diagnóstico básico de siembra para un lote'
  },
  asesor: {
    nombre: 'Asesor Pro',
    precio: 'USD 79/mes',
    lotes: 50,
    modulos: ['siembra','suelo','economia','fertilizacion','maquinaria','hidrico','cultivares','asistente','mapa'],
    color: '#C8A255',
    icon: '⚡',
    desc: 'Acceso completo · 50 lotes · Asistente IA · Cultivares RECSO'
  },
  empresa: {
    nombre: 'Empresa',
    precio: 'USD 299/mes',
    lotes: 999,
    modulos: ['siembra','suelo','economia','fertilizacion','maquinaria','hidrico','cultivares','asistente','mapa'],
    color: '#2A5A8C',
    icon: '🏢',
    desc: 'Lotes ilimitados · White label · Soporte prioritario · API'
  }
};

// ── ESTADO DE SESIÓN ─────────────────────────────────
let AM_SESION = null;

function amCargarSesion() {
  try {
    const stored = sessionStorage.getItem('am_sesion');
    if (stored) AM_SESION = JSON.parse(stored);
  } catch(e) { AM_SESION = null; }
}

function amGuardarSesion(sesion) {
  AM_SESION = sesion;
  try { sessionStorage.setItem('am_sesion', JSON.stringify(sesion)); } catch(e) {}
  amActualizarUI();
}

function amCerrarSesion() {
  AM_SESION = null;
  try { sessionStorage.removeItem('am_sesion'); } catch(e) {}
  amActualizarUI();
  amMostrarModal('login');
}

// ── VERIFICAR ACCESO A MÓDULO ─────────────────────────
function amTieneAcceso(modulo) {
  if (!AM_SESION) return modulo === 'siembra';
  const plan = AM_PLANES[AM_SESION.plan];
  return plan?.modulos?.includes(modulo) ?? false;
}

// ── ACTUALIZAR UI SEGÚN SESIÓN ────────────────────────
function amActualizarUI() {
  const btnLogin  = $('am-btn-login');
  const btnUser   = $('am-btn-user');
  const userInfo  = $('am-user-info');

  if (AM_SESION) {
    const plan = AM_PLANES[AM_SESION.plan];
    if (btnLogin)  btnLogin.classList.add('hidden');
    if (btnUser)   { btnUser.classList.remove('hidden'); btnUser.textContent = `${plan.icon} ${AM_SESION.nombre?.split(' ')[0] || 'Usuario'}`; }
    if (userInfo)  userInfo.textContent = `${plan.nombre} · ${AM_SESION.email}`;
  } else {
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (btnUser)  btnUser.classList.add('hidden');
    if (userInfo) userInfo.textContent = '';
  }

  // Actualizar tabs bloqueados visualmente
  document.querySelectorAll('.nav-tab[data-mod]').forEach(tab => {
    const mod = tab.dataset.mod;
    const tieneAcceso = amTieneAcceso(mod);
    tab.classList.toggle('am-locked', !tieneAcceso);
  });
}

// ── CONTROL DE ACCESO integrado en switchMod principal ──
// (la lógica de amTieneAcceso se aplica via amActualizarUI al cambiar sesión)

// ── MODAL PRINCIPAL ───────────────────────────────────
function amMostrarModal(vista = 'planes') {
  $('am-modal').classList.remove('hidden');
  $('am-modal').style.animation = 'amFadeIn .3s ease both';
  amCambiarVista(vista);
}

function amCerrarModal() {
  const modal = $('am-modal');
  modal.style.animation = 'amFadeOut .25s ease both';
  setTimeout(() => modal.classList.add('hidden'), 250);
}

function amCambiarVista(vista) {
  ['am-vista-planes','am-vista-login','am-vista-registro'].forEach(id => {
    $(id)?.classList.add('hidden');
  });
  $(`am-vista-${vista}`)?.classList.remove('hidden');
}

// Modal de upgrade cuando intenta acceder a módulo premium
function amMostrarModalUpgrade(modulo) {
  const nombres = {
    suelo:'Análisis de Suelo', economia:'Economía de Campaña',
    fertilizacion:'Fertilización', maquinaria:'Productividad Maquinaria',
    hidrico:'Balance Hídrico', cultivares:'Cultivares RECSO/INTA',
    asistente:'Asistente IA', mapa:'Mapa de Distribuidores'
  };
  const el = $('am-upgrade-modulo');
  if (el) el.textContent = nombres[modulo] || modulo;
  amMostrarModal('planes');
}

// ── LOGIN ─────────────────────────────────────────────
function amLogin() {
  const email = $('am-email')?.value?.trim();
  const pass  = $('am-pass')?.value?.trim();
  const err   = $('am-login-err');

  if (!email || !pass) {
    if (err) { err.textContent = 'Completá email y contraseña.'; err.classList.remove('hidden'); }
    return;
  }

  // Demo: cualquier email/contraseña funciona
  // En producción: llamar a Supabase Auth o tu backend
  const plan = email.includes('empresa') ? 'empresa' : email.includes('free') ? 'free' : 'asesor';

  amGuardarSesion({
    email,
    nombre: email.split('@')[0].replace(/\./g,' '),
    plan,
    desde: new Date().toISOString()
  });

  amCerrarModal();

  // Toast de bienvenida
  amToast(`✅ Bienvenido ${AM_SESION.nombre?.split(' ')[0]}! Plan ${AM_PLANES[plan].nombre} activo.`, 'ok');
}

// ── REGISTRO ──────────────────────────────────────────
function amRegistrar() {
  const nombre = $('am-reg-nombre')?.value?.trim();
  const email  = $('am-reg-email')?.value?.trim();
  const pass   = $('am-reg-pass')?.value?.trim();
  const plan   = gv('am-reg-plan') || 'free';
  const err    = $('am-reg-err');

  if (!nombre || !email || !pass) {
    if (err) { err.textContent = 'Completá todos los campos.'; err.classList.remove('hidden'); }
    return;
  }

  // Demo: registro inmediato
  amGuardarSesion({ email, nombre, plan, desde: new Date().toISOString() });
  amCerrarModal();
  amToast(`🎉 Cuenta creada! Plan ${AM_PLANES[plan].nombre} activo.`, 'ok');
}

// ── TOAST ─────────────────────────────────────────────
function amToast(msg, tipo = 'ok') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(20px);
    background:${tipo==='ok'?'var(--canopy)':'var(--warn)'};color:white;
    padding:.75rem 1.5rem;border-radius:12px;font-size:.85rem;font-weight:600;
    box-shadow:0 8px 32px rgba(0,0,0,.3);z-index:10000;
    animation:amSlideUp .3s cubic-bezier(.22,.68,0,1.2) both;
    white-space:nowrap;max-width:90vw;text-align:center`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'amFadeOut .3s ease both';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}


// ── Modal helpers (plan registration) ──

function amRegistrarPlan(plan) {
  $('am-reg-plan') && ($('am-reg-plan').value = plan);
  amCambiarVista('registro');
}

function amMostrarPerfil() {
  if (!AM_SESION) { amMostrarModal('login'); return; }
  const plan = AM_PLANES[AM_SESION.plan];
  const confirmar = confirm(
    `👤 ${AM_SESION.nombre}\n📧 ${AM_SESION.email}\n⭐ Plan: ${plan.nombre}\n\n¿Cerrar sesión?`
  );
  if (confirmar) amCerrarSesion();
}

// Cargar sesión al inicio
amCargarSesion();
