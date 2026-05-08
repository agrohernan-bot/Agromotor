// ════════════════════════════════════════════════════════
// AGROMOTOR — login.js
// Auth real con Supabase · Planes Free / Asesor Pro / Empresa
// Requiere: config.js cargado antes (define AM_SB y AM_CONFIG)
// ════════════════════════════════════════════════════════

const AM_PLANES = {
  free: {
    nombre: 'Demo',
    precio: 'Gratis',
    lotes: 1,
    iaCallsMes: 0,
    modulos: ['siembra'],
    color: '#3A7A4A',
    icon: '🌱',
    desc: 'Probá AgroMotor con un lote · Diagnóstico básico de siembra'
  },
  asesor: {
    nombre: 'Asesor',
    precio: 'USD 35/mes',
    lotes: 5,
    iaCallsMes: 30,
    modulos: [
      'siembra','suelo','decision','economia','fertilizacion','fertoptima',
      'maquinaria','hidrico','cultivares','asistente','mapa',
      'seguimiento','balance','balancenut','plagas','pulverizacion',
      'cosecha','alerta-sanitaria','siembra-variable'
    ],
    color: '#3A7A4A',
    icon: '🌾',
    desc: 'Para asesor independiente · 5 lotes · IA 30 consultas/mes · Todo el motor agronómico'
  },
  pro: {
    nombre: 'Pro',
    precio: 'USD 90/mes',
    lotes: 25,
    iaCallsMes: 100,
    modulos: [
      'siembra','suelo','decision','economia','fertilizacion','fertoptima',
      'maquinaria','hidrico','cultivares','asistente','mapa',
      'seguimiento','balance','balancenut','plagas','pulverizacion',
      'cosecha','alerta-sanitaria','siembra-variable'
    ],
    color: '#C8A255',
    icon: '⚡',
    desc: 'Para estudio chico · 25 lotes · IA 100 consultas/mes · PDF brandeable · Historial extendido'
  },
  empresa: {
    nombre: 'Empresa',
    precio: 'USD 250/mes',
    lotes: 75,
    iaCallsMes: 300,
    modulos: [
      'siembra','suelo','decision','economia','fertilizacion','fertoptima',
      'maquinaria','hidrico','cultivares','asistente','mapa',
      'seguimiento','balance','balancenut','plagas','pulverizacion',
      'cosecha','alerta-sanitaria','siembra-variable'
    ],
    color: '#2A5A8C',
    icon: '🏢',
    desc: 'Para cooperativas y empresas · 75 lotes · IA 300 consultas/mes · NDVI satelital · API export · Soporte directo'
  }
};

// ── ESTADO DE SESIÓN ──────────────────────────────────
// { id, email, nombre, plan, planHasta, trialHasta, token }
let AM_SESION = null;

// ── LISTENER CENTRAL (única fuente de verdad) ─────────
AM_SB.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    // Cargar plan + matrícula desde la tabla profiles
    const { data: profile } = await AM_SB
      .from('profiles')
      .select('nombre, plan, plan_hasta, trial_hasta, rol, cpia, matricula_numero, matricula_verificada')
      .eq('id', session.user.id)
      .single();

    AM_SESION = {
      id:        session.user.id,
      email:     session.user.email,
      nombre:    profile?.nombre
                   || session.user.user_metadata?.nombre
                   || session.user.email.split('@')[0],
      plan:      profile?.plan ?? 'free',
      planHasta: profile?.plan_hasta  ?? null,
      trialHasta:profile?.trial_hasta ?? null,
      rol:       profile?.rol ?? 'agronomo',
      cpia:      profile?.cpia ?? null,
      matricula: profile?.matricula_numero ?? null,
      matriculaVerificada: !!profile?.matricula_verificada,
      token:     session.access_token
    };
  } else {
    AM_SESION = null;
  }
  amActualizarUI();
});

// ── VERIFICAR ACCESO A MÓDULO ─────────────────────────
function amTieneAcceso(modulo) {
  if (AM_CONFIG.devMode) return true;
  if (!AM_SESION) return modulo === 'siembra';

  const plan = AM_PLANES[AM_SESION.plan];
  if (!plan?.modulos?.includes(modulo)) return false;

  // Plan gratuito: siempre activo
  if (AM_SESION.plan === 'free') return true;

  // Planes pagos: verificar que no estén vencidos
  const ahora     = new Date();
  const planVigente  = AM_SESION.planHasta  && new Date(AM_SESION.planHasta)  > ahora;
  const trialVigente = AM_SESION.trialHasta && new Date(AM_SESION.trialHasta) > ahora;

  if (!planVigente && !trialVigente) {
    // Plan vencido: degradar silenciosamente a free
    return modulo === 'siembra';
  }

  return true;
}

// ── ACTUALIZAR UI SEGÚN SESIÓN ────────────────────────
function amActualizarUI() {
  const btnLogin = $('am-btn-login');
  const btnUser  = $('am-btn-user');
  const userInfo = $('am-user-info');

  if (AM_SESION) {
    const plan = AM_PLANES[AM_SESION.plan];
    btnLogin?.classList.add('hidden');
    if (btnUser) {
      btnUser.classList.remove('hidden');
      const prefijo = AM_SESION.rol === 'agronomo' ? 'Ing. ' : '';
      btnUser.textContent = `${plan.icon} ${prefijo}${AM_SESION.nombre.split(' ').slice(-1)[0]}`;
    }
    if (userInfo) {
      const matSuffix = AM_SESION.matricula
        ? ` · Mat ${AM_SESION.matricula}${AM_SESION.cpia ? ' (' + AM_SESION.cpia + ')' : ''}${AM_SESION.matriculaVerificada ? ' ✓' : ''}`
        : (AM_SESION.rol === 'estudiante' ? ' · Estudiante' : '');
      userInfo.textContent = `${plan.nombre}${matSuffix}`;
      userInfo.style.display = 'block';
    }
  } else {
    btnLogin?.classList.remove('hidden');
    btnUser?.classList.add('hidden');
    if (userInfo) { userInfo.textContent = ''; userInfo.style.display = 'none'; }
  }

  // Marcar tabs bloqueados visualmente
  document.querySelectorAll('.nav-tab[data-mod]').forEach(tab => {
    tab.classList.toggle('am-locked', !amTieneAcceso(tab.dataset.mod));
  });
}

// ── MODAL PRINCIPAL ───────────────────────────────────
function amMostrarModal(vista = 'planes') {
  const modal = $('am-modal');
  modal.classList.remove('hidden');
  modal.style.animation = 'amFadeIn .3s ease both';
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

function amMostrarModalUpgrade(modulo) {
  const nombres = {
    suelo:'Análisis de Suelo', decision:'Motor de Decisión',
    economia:'Economía de Campaña', fertilizacion:'Fertilización',
    maquinaria:'Productividad Maquinaria', hidrico:'Balance Hídrico',
    cultivares:'Cultivares RECSO/INTA', asistente:'Asistente IA',
    mapa:'Mapa de Distribuidores', plagas:'Alertas de Plagas',
    pulverizacion:'Ventanas de Pulverización', cosecha:'Cosecha Decide',
    seguimiento:'Seguimiento Fenológico', balance:'Balance Nutricional'
  };
  const el = $('am-upgrade-modulo');
  if (el) el.textContent = nombres[modulo] || modulo;
  amMostrarModal('planes');
}

// ── LOGIN ─────────────────────────────────────────────
async function amLogin() {
  const email = $('am-email')?.value?.trim();
  const pass  = $('am-pass')?.value?.trim();
  const err   = $('am-login-err');
  const btn   = $('am-btn-login-submit');

  if (!email || !pass) {
    amMostrarError(err, 'Completá email y contraseña.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Ingresando...'; }

  const { error } = await AM_SB.auth.signInWithPassword({ email, password: pass });

  if (btn) { btn.disabled = false; btn.textContent = 'Iniciar sesión'; }

  if (error) {
    const msgs = {
      'Invalid login credentials': 'Email o contraseña incorrectos.',
      'Email not confirmed': 'Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.',
    };
    amMostrarError(err, msgs[error.message] || `Error: ${error.message}`);
    return;
  }

  // onAuthStateChange actualiza AM_SESION y la UI automáticamente
  amCerrarModal();
  setTimeout(() => {
    if (AM_SESION) amToast(`Bienvenido ${AM_SESION.nombre.split(' ')[0]}! Plan ${AM_PLANES[AM_SESION.plan].nombre} activo.`, 'ok');
  }, 500);
}

// ── REGISTRO ──────────────────────────────────────────
// Auto-abrir modal desde URL params (?signup=1&plan=X)
function amProcesarUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === '1' || params.get('login') === '1') {
      const planSel = params.get('plan');
      const vista = params.get('login') === '1' ? 'login' : 'registro';
      setTimeout(function() {
        if (typeof amMostrarModal === 'function') amMostrarModal(vista);
        if (planSel && vista === 'registro') {
          var sel = document.getElementById('am-reg-plan');
          if (sel) {
            for (var i = 0; i < sel.options.length; i++) {
              if (sel.options[i].value === planSel) { sel.selectedIndex = i; break; }
            }
          }
        }
      }, 800);
    }
  } catch(e) { /* noop */ }
}
window.addEventListener('DOMContentLoaded', amProcesarUrlParams);

// Toggle bloques agronomo/estudiante en el form de registro
function amRegToggleRol() {
  const rol = gv('am-reg-rol') || 'agronomo';
  const ag = $('am-reg-block-agronomo');
  const es = $('am-reg-block-estudiante');
  if (!ag || !es) return;
  if (rol === 'estudiante') {
    ag.classList.add('hidden');
    es.classList.remove('hidden');
  } else {
    ag.classList.remove('hidden');
    es.classList.add('hidden');
  }
}
window.amRegToggleRol = amRegToggleRol;

async function amRegistrar() {
  const nombre = $('am-reg-nombre')?.value?.trim();
  const email  = $('am-reg-email')?.value?.trim();
  const pass   = $('am-reg-pass')?.value?.trim();
  const plan   = gv('am-reg-plan') || 'free';
  const rol    = gv('am-reg-rol') || 'agronomo';
  const cpia        = gv('am-reg-cpia');
  const matricula   = $('am-reg-matricula')?.value?.trim();
  const universidad = $('am-reg-universidad')?.value?.trim();
  const anio        = gv('am-reg-anio');
  const jura        = $('am-reg-jura')?.checked;
  const err    = $('am-reg-err');
  const btn    = $('am-btn-reg-submit');

  if (!nombre || !email || !pass) {
    amMostrarError(err, 'Completá nombre, email y contraseña.');
    return;
  }
  if (pass.length < 8) {
    amMostrarError(err, 'La contraseña debe tener al menos 8 caracteres.');
    return;
  }
  if (rol === 'agronomo') {
    if (!cpia)      { amMostrarError(err, 'Seleccioná tu Consejo Profesional.'); return; }
    if (!matricula) { amMostrarError(err, 'Ingresá tu número de matrícula profesional.'); return; }
  } else if (rol === 'estudiante') {
    if (!universidad) { amMostrarError(err, 'Ingresá tu universidad.'); return; }
    if (!anio)        { amMostrarError(err, 'Seleccioná el año que cursás.'); return; }
  }
  if (!jura) {
    amMostrarError(err, 'Debés aceptar la declaración jurada de los datos profesionales.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Creando cuenta...'; }

  const metadata = { nombre, plan, rol };
  if (rol === 'agronomo') {
    metadata.cpia = cpia;
    metadata.matricula_numero = matricula;
  } else {
    metadata.universidad = universidad;
    metadata.anio_cursado = anio;
  }

  const { data, error } = await AM_SB.auth.signUp({
    email,
    password: pass,
    options: { data: metadata }
  });

  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }
    const msgs = {
      'User already registered': 'Ya existe una cuenta con ese email. Iniciá sesión.',
      'Password should be at least 6 characters': 'La contraseña debe tener al menos 8 caracteres.',
    };
    amMostrarError(err, msgs[error.message] || `Error: ${error.message}`);
    return;
  }

  // Persistir matrícula en la tabla profiles (handle_new_user puede no copiar todos los metadata)
  if (data?.user?.id) {
    const updates = { rol, matricula_declarada_at: new Date().toISOString() };
    if (rol === 'agronomo') { updates.cpia = cpia; updates.matricula_numero = matricula; }
    await AM_SB.from('profiles').update(updates).eq('id', data.user.id);
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }
  amCerrarModal();
  amToast('Cuenta creada. Revisá tu email para confirmarla y luego iniciá sesión.', 'ok');
}

// ── CERRAR SESIÓN ─────────────────────────────────────
async function amCerrarSesion() {
  await AM_SB.auth.signOut();
  // onAuthStateChange pone AM_SESION = null y actualiza la UI
  amToast('Sesión cerrada.', 'ok');
}

// ── PERFIL ────────────────────────────────────────────
function amMostrarPerfil() {
  if (!AM_SESION) { amMostrarModal('login'); return; }

  const plan      = AM_PLANES[AM_SESION.plan];
  const trialInfo = AM_SESION.trialHasta
    ? `\n🕐 Trial hasta: ${new Date(AM_SESION.trialHasta).toLocaleDateString('es-AR')}`
    : '';
  const planInfo  = AM_SESION.planHasta
    ? `\n📅 Plan hasta: ${new Date(AM_SESION.planHasta).toLocaleDateString('es-AR')}`
    : '';

  const confirmar = confirm(
    `👤 ${AM_SESION.nombre}\n📧 ${AM_SESION.email}\n⭐ Plan: ${plan.nombre}${trialInfo}${planInfo}\n\n¿Cerrar sesión?`
  );
  if (confirmar) amCerrarSesion();
}

// ── HELPER: seleccionar plan desde modal ──────────────
function amRegistrarPlan(plan) {
  const sel = $('am-reg-plan');
  if (sel) sel.value = plan;
  amCambiarVista('registro');
}

// ── HELPERS INTERNOS ──────────────────────────────────
function amMostrarError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

function amToast(msg, tipo = 'ok') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(20px);
    background:${tipo === 'ok' ? 'var(--canopy)' : 'var(--warn)'};color:white;
    padding:.75rem 1.5rem;border-radius:12px;font-size:.85rem;font-weight:600;
    box-shadow:0 8px 32px rgba(0,0,0,.3);z-index:10000;
    animation:amSlideUp .3s cubic-bezier(.22,.68,0,1.2) both;
    white-space:nowrap;max-width:90vw;text-align:center`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'amFadeOut .3s ease both';
    setTimeout(() => t.remove(), 300);
  }, 4000);
}

// Compatibilidad: función vacía, onAuthStateChange maneja el init
function amCargarSesion() {}
