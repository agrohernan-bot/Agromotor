// ════════════════════════════════════════════════════════
// AGROMOTOR — login.js
// Auth real con Supabase · Planes Free / Asesor Pro / Empresa
// Requiere: config.js cargado antes (define AM_SB y AM_CONFIG)
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  try { localStorage.removeItem('am_god'); } catch (_) {}

// ── LÍMITES POR PLAN ──────────────────────────────────
// Plan único: 20 lotes base + USD 1 por cada lote extra
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
    nombre: 'Profesional',
    precio: 'USD 35/mes',
    lotes: 20,
    iaCallsMes: 30,
    modulos: [
      'siembra','suelo','decision','economia','nutricion',
      'maquinaria','hidrico','cultivares','asistente','mapa',
      'seguimiento','plagas','pulverizacion',
      'cosecha','alerta-sanitaria','siembra-variable'
    ],
    color: '#3A7A4A',
    icon: '🌾',
    desc: 'Para asesores · 20 lotes base · lotes extra USD 1/mes c/u · Todo el motor agronómico'
  },
  // Alias legacy para usuarios con plan pro/empresa — redirigen a asesor en UI
  pro:     { nombre: 'Profesional', precio: 'USD 35/mes', lotes: 20, iaCallsMes: 30, modulos: ['siembra','suelo','decision','economia','nutricion','maquinaria','hidrico','cultivares','asistente','mapa','seguimiento','plagas','pulverizacion','cosecha','alerta-sanitaria','siembra-variable'], color: '#3A7A4A', icon: '🌾', desc: '' },
  empresa: { nombre: 'Profesional', precio: 'USD 35/mes', lotes: 20, iaCallsMes: 30, modulos: ['siembra','suelo','decision','economia','nutricion','maquinaria','hidrico','cultivares','asistente','mapa','seguimiento','plagas','pulverizacion','cosecha','alerta-sanitaria','siembra-variable'], color: '#3A7A4A', icon: '🌾', desc: '' }
};

// ── FECHA FIN DE PROMOCIÓN ────────────────────────────
const AM_PROMO_HASTA = new Date('2026-08-02');

// ── ESTADO DE SESIÓN ──────────────────────────────────
// { id, email, nombre, plan, planHasta, trialHasta, lotesExtra, token }
let AM_SESION = null;

// Flag activo durante el flujo PASSWORD_RECOVERY.
// de la app cuando SIGNED_IN dispara justo después de PASSWORD_RECOVERY,
// y se limpia solo cuando USER_UPDATED confirma que la contraseña fue cambiada.
let _modoRecovery = false;
if (window.location.hash.includes('type=recovery')) _modoRecovery = true;

// ── HELPERS INTERNOS DE SESIÓN ────────────────────────
function amSetSesion(session) {
  var meta = session.user.user_metadata || {};
  AM_SESION = {
    id:        session.user.id,
    email:     session.user.email,
    nombre:    meta.nombre || session.user.email.split('@')[0],
    plan:      meta.plan || 'free',
    planHasta: null,
    trialHasta:null,
    lotesExtra:meta.lotes_extra || 0,
    rol:       meta.rol || 'agronomo',
    cpia:      meta.cpia || null,
    matricula: meta.matricula_numero || null,
    matriculaVerificada: false,
    token:     session.access_token
  };
}

function amEnrichPerfil(session) {
  // Enrich desde profiles en background — no bloquea el flow ni onAuthStateChange
  setTimeout(function() {
    Promise.race([
      AM_SB.from('profiles')
        .select('nombre, plan, plan_hasta, trial_hasta, lotes_extra, rol, cpia, matricula_numero, matricula_verificada')
        .eq('id', session.user.id).maybeSingle(),
      new Promise(function(resolve) { setTimeout(function() { resolve({ data: null, error: { message: 'timeout' } }); }, 5000); })
    ]).then(function(res) {
      if (!AM_SESION || !res?.data) return;
      var p = res.data;
      AM_SESION.nombre    = p.nombre    || AM_SESION.nombre;
      AM_SESION.plan      = p.plan      || AM_SESION.plan;
      AM_SESION.planHasta = p.plan_hasta;
      AM_SESION.trialHasta= p.trial_hasta;
      AM_SESION.lotesExtra= p.lotes_extra || 0;
      AM_SESION.rol       = p.rol       || AM_SESION.rol;
      AM_SESION.cpia      = p.cpia      || AM_SESION.cpia;
      AM_SESION.matricula = p.matricula_numero || AM_SESION.matricula;
      AM_SESION.matriculaVerificada = !!p.matricula_verificada;
      amActualizarUI();
    }).catch(function() { /* noop — usamos lo que ya tenemos del JWT */ });
  }, 0);
}

// ── LISTENER CENTRAL (única fuente de verdad) ─────────
// IMPORTANTE: NUNCA usar `await` directo a Supabase dentro de onAuthStateChange
// — causa deadlock con supabase-js v2. Usamos user_metadata (ya en el JWT)
// como fuente primaria, y enrich desde profiles de forma deferred.
AM_SB.auth.onAuthStateChange((event, session) => {
  // PASSWORD_RECOVERY: llegó via link de reset → mostrar form y bloquear apertura de app
  if (event === 'PASSWORD_RECOVERY') {
    _modoRecovery = true;
    amMostrarFormularioNuevaContrasena();
    return;
  }

  // SIGNED_IN durante recovery: la sesión temporal es válida, pero NO abrir la app.
  // Supabase dispara SIGNED_IN sincrónicamente justo después de PASSWORD_RECOVERY — es el
  // "flash" que el usuario ve: sin este guard, la app se abría pisando el formulario.
  // Solo reabrimos el modal si por algún motivo estaba cerrado; si PASSWORD_RECOVERY
  // ya lo abrió (caso normal), evitamos la doble animación.
  if (event === 'SIGNED_IN' && _modoRecovery) {
    const modal = document.getElementById('am-modal');
    if (!modal || modal.classList.contains('hidden')) amMostrarFormularioNuevaContrasena();
    return;
  }

  // USER_UPDATED tras recovery exitoso: contraseña cambiada → ahora sí abrir la app
  if (event === 'USER_UPDATED' && _modoRecovery) {
    _modoRecovery = false;
    if (session?.user) { amSetSesion(session); amActualizarUI(); amEnrichPerfil(session); }
    if (typeof amCargarLotesGlobales === 'function') amCargarLotesGlobales();
    amCerrarModal();
    amToast('Contraseña actualizada. ¡Bienvenido a AgroMotor!', 'ok');
    return;
  }

  // SIGNED_OUT — limpiar flag y sesión
  if (event === 'SIGNED_OUT') {
    _modoRecovery = false;
    AM_SESION = null;
    amActualizarUI();
    if (typeof amCargarLotesGlobales === 'function') amCargarLotesGlobales();
    return;
  }

  // SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION — flujo normal
  if (session?.user) {
    amSetSesion(session);
    amActualizarUI();
    if (typeof amCargarLotesGlobales === 'function') amCargarLotesGlobales();
    amEnrichPerfil(session);
  } else {
    AM_SESION = null;
    amActualizarUI();
    if (typeof amCargarLotesGlobales === 'function') amCargarLotesGlobales();
  }
});

// ── VERIFICAR ACCESO A MÓDULO ─────────────────────────
function amTieneAcceso(modulo) {
  // Promocion lanzamiento: acceso total hasta el 01 Agosto 2026 inclusive.
  // Requiere sesion activa (login obligatorio durante la promo).
  if (new Date() < new Date('2026-08-02')) {
    if (!AM_SESION) return false;
    return true;
  }

  if (!AM_SESION) return false;

  const plan = AM_PLANES[AM_SESION.plan];
  if (!plan?.modulos?.includes(modulo)) return false;

  if (AM_SESION.plan === 'free') return false;

  const ahora = new Date();
  const planVigente = AM_SESION.planHasta && new Date(AM_SESION.planHasta) > ahora;
  const trialVigente = AM_SESION.trialHasta && new Date(AM_SESION.trialHasta) > ahora;

  if (!planVigente && !trialVigente) return false;

  return true;
}
// ── ACTUALIZAR UI SEGÚN SESIÓN ────────────────────────
function amActualizarUI() {
  const btnLogin    = $('am-btn-login');
  const btnRegistro = $('am-btn-registro'); // TODO: eliminar el 1° de agosto de 2026
  const btnUser     = $('am-btn-user');
  const userInfo    = $('am-user-info');

  if (AM_SESION) {
    const plan = AM_PLANES[AM_SESION.plan];
    btnLogin?.classList.add('hidden');
    btnRegistro?.classList.add('hidden');
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
    btnRegistro?.classList.remove('hidden');
    btnUser?.classList.add('hidden');
    if (userInfo) { userInfo.textContent = ''; userInfo.style.display = 'none'; }
  }

  // Marcar tabs bloqueados visualmente
  document.querySelectorAll('.nav-tab[data-mod]').forEach(tab => {
    tab.classList.toggle('am-locked', !amTieneAcceso(tab.dataset.mod));
  });
}

// ── MODAL PRINCIPAL ───────────────────────────────────
var _amModalCloseTimer = null; // timer pendiente de amCerrarModal

function amMostrarModal(vista = 'planes') {
  const modal = $('am-modal');
  // Cancelar cualquier timer de cierre pendiente (race condition:
  // si amCerrarModal fue llamado hace < 260ms, su setTimeout
  // agregaría .hidden encima de esta apertura)
  if (_amModalCloseTimer) { clearTimeout(_amModalCloseTimer); _amModalCloseTimer = null; }
  // Bloquear scroll del body mientras el modal está abierto
  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');
  // Usar transition en lugar de animation keyframes para evitar
  // el problema de opacity:0 pegado cuando la tab está en background
  modal.style.transition = 'none';
  modal.style.opacity = '0';
  modal.style.transform = 'scale(0.96)';
  modal.classList.remove('hidden');
  // Doble rAF garantiza que el browser pinte el estado inicial
  // antes de iniciar la transición visible
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      modal.style.transition = 'opacity .3s ease, transform .3s ease';
      modal.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    });
  });
  amCambiarVista(vista);
  amResetModalScroll();
}

function amCerrarModal() {
  if (!AM_SESION) {
    var visible = document.querySelector('#am-vista-registro:not(.hidden), #am-vista-login:not(.hidden), #am-vista-planes:not(.hidden)');
    var err = visible ? visible.querySelector('.alert.danger') : null;
    if (err) amMostrarError(err, 'NecesitÃ¡s iniciar sesiÃ³n para ingresar a AgroMotor.');
    return;
  }
  const modal = $('am-modal');
  modal.style.transition = 'opacity .25s ease, transform .25s ease';
  modal.style.opacity = '0';
  modal.style.transform = 'scale(0.96)';
  _amModalCloseTimer = setTimeout(function() {
    _amModalCloseTimer = null;
    modal.classList.add('hidden');
    // Limpiar estilos inline para próxima apertura
    modal.style.opacity = '';
    modal.style.transform = '';
    modal.style.transition = '';
    // Restaurar scroll del body
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
  }, 260);
}

function amCambiarVista(vista) {
  // Durante la promo redirigimos 'planes' a 'registro' directamente.
  // Cuando AM_PROMO_HASTA expire, eliminar este bloque para mostrar el selector de planes.
  if (vista === 'planes' && new Date() < AM_PROMO_HASTA) vista = 'registro';
  ['am-vista-planes','am-vista-login','am-vista-registro','am-vista-recovery'].forEach(id => {
    $(id)?.classList.add('hidden');
  });
  $(`am-vista-${vista}`)?.classList.remove('hidden');
  amResetModalScroll();
}

function amResetModalScroll() {
  requestAnimationFrame(function() {
    var modal = $('am-modal');
    var shell = modal ? modal.firstElementChild : null;
    var visible = modal ? modal.querySelector('#am-vista-planes:not(.hidden), #am-vista-login:not(.hidden), #am-vista-registro:not(.hidden), #am-vista-recovery:not(.hidden)') : null;
    [modal, shell, visible].forEach(function(el) {
      if (el) el.scrollTop = 0;
    });
  });
}

function amMostrarModalUpgrade(modulo) {
  const nombres = {
    suelo:'Análisis de Suelo', decision:'Motor de Decisión',
    economia:'Economía de Campaña', nutricion:'Nutrición de Cultivo',
    maquinaria:'Productividad Maquinaria', hidrico:'Balance Hídrico',
    cultivares:'Cultivares RECSO/INTA', asistente:'Asistente IA',
    mapa:'Mapa de Distribuidores', plagas:'Alertas de Plagas',
    pulverizacion:'Ventanas de Pulverización', cosecha:'Cosecha Decide',
    seguimiento:'Seguimiento Fenológico'
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

// ── RECUPERAR CONTRASEÑA ──────────────────────────────
async function amOlvidarContrasena() {
  const email = $('am-email')?.value?.trim();
  const err   = $('am-login-err');
  if (!email) {
    amMostrarError(err, 'Ingresá tu email primero y luego hacé clic en ¿Olvidaste tu contraseña?');
    return;
  }
  const { error } = await AM_SB.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://agromotor.com.ar/app.html'
  });
  if (error) {
    amMostrarError(err, `Error al enviar el email: ${error.message}`);
    return;
  }
  amToast('Te enviamos un email para restablecer tu contraseña. Revisá tu bandeja.', 'ok');
}

// ── REGISTRO ──────────────────────────────────────────
// Auto-abrir modal desde URL params (?signup=1&plan=X)
// También maneja el return de Mercado Pago (?subscription=success/pending/failure)
function amProcesarUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);

    // ── Retorno desde checkout de Mercado Pago ──
    const subResult = params.get('subscription');
    if (subResult) {
      // Limpiar URL sin reload
      const urlLimpia = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', urlLimpia);

      setTimeout(async function() {
        if (subResult === 'success') {
          // Recargar datos del usuario desde Supabase (el webhook pudo haber actualizado el plan)
          if (typeof AM_SB !== 'undefined') {
            try {
              const { data: { user } } = await AM_SB.auth.getUser();
              if (user && typeof amCargarSesion === 'function') await amCargarSesion();
            } catch(e) { /* noop */ }
          }
          amToast('✅ ¡Suscripción iniciada! Tu plan se activará en unos minutos una vez confirmado el pago.', 'ok');
        } else if (subResult === 'pending') {
          amToast('⏳ Pago pendiente de confirmación. Te avisamos cuando se acredite.', 'ok');
        } else if (subResult === 'failure') {
          amToast('❌ El pago no pudo procesarse. Podés intentarlo de nuevo desde tu perfil.', 'err');
        }
      }, 1200);
      return;
    }

    // ── Auto-abrir modal de login/registro ──
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

// Auto-mostrar modal si no logueado.
// Durante la promo: no se abre automáticamente (el guard de módulos lo hace).
// Post-promo: ídem — solo al tocar un módulo restringido.
window.addEventListener('DOMContentLoaded', function() {
  // No abrir modales automáticamente: si el usuario toca un módulo restringido,
  // amTieneAcceso/amMostrarModalUpgrade muestran el login en ese momento.
  if (_modoRecovery) return;
  if (new Date() < new Date('2026-08-02')) {
    setTimeout(function() {
      if (!AM_SESION && !_modoRecovery && typeof amMostrarModal === 'function') {
        amMostrarModal('registro');
      }
    }, 900);
  }
});

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
    const trialHasta = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const planFinal  = (plan && plan !== 'free') ? plan : 'asesor';
    const updates = { rol, plan: planFinal, trial_hasta: trialHasta, matricula_declarada_at: new Date().toISOString() };
    if (rol === 'agronomo') { updates.cpia = cpia; updates.matricula_numero = matricula; }
    await AM_SB.from('profiles').update(updates).eq('id', data.user.id);
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }

  if (data.session) {
    // Email confirmation OFF en Supabase — sesión activa inmediatamente
    // onAuthStateChange disparará AM_SESION y cerrará la UI
    amCerrarModal();
    amToast(`Bienvenido ${nombre.split(' ')[0]}! Tu cuenta está lista.`, 'ok');
  } else {
    // Email confirmation ON — el usuario debe confirmar antes de iniciar sesión
    amCambiarVista('login');
    amToast('Cuenta creada. Revisá tu email para confirmarla y luego iniciá sesión aquí.', 'ok');
  }
}

// ── CERRAR SESIÓN ─────────────────────────────────────
// ── RECOVERY: nueva contraseña ────────────────────────
function amMostrarFormularioNuevaContrasena() {
  amMostrarModal('recovery');
}

async function amConfirmarNuevaContrasena() {
  const pass1 = $('am-rec-pass1')?.value?.trim();
  const pass2 = $('am-rec-pass2')?.value?.trim();
  const err   = $('am-rec-err');
  const btn   = $('am-rec-btn');

  if (!pass1) { amMostrarError(err, 'Ingresá tu nueva contraseña.'); return; }
  if (pass1.length < 8) { amMostrarError(err, 'La contraseña debe tener al menos 8 caracteres.'); return; }
  if (pass1 !== pass2) { amMostrarError(err, 'Las contraseñas no coinciden. Verificá e intentá de nuevo.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  const { error } = await AM_SB.auth.updateUser({ password: pass1 });
  if (btn) { btn.disabled = false; btn.textContent = 'Guardar nueva contraseña'; }

  if (error) {
    amMostrarError(err, `Error al actualizar: ${error.message}`);
    return;
  }
  // USER_UPDATED → onAuthStateChange limpia _modoRecovery, cierra modal y muestra toast
}

async function amCerrarSesion() {
  await AM_SB.auth.signOut();
  // onAuthStateChange pone AM_SESION = null y actualiza la UI
  amToast('Sesión cerrada.', 'ok');
}

// ── PERFIL ────────────────────────────────────────────
function amMostrarPerfil() {
  if (!AM_SESION) { amMostrarModal('login'); return; }

  // Eliminar panel previo si existe
  const prevPanel = document.getElementById('am-perfil-panel');
  if (prevPanel) { prevPanel.remove(); return; }

  const plan = AM_PLANES[AM_SESION.plan];

  // Construir filas de info
  const rows = [
    { icon: '👤', label: AM_SESION.nombre },
    { icon: '📧', label: AM_SESION.email },
    { icon: plan.icon, label: `Plan ${plan.nombre}` },
  ];
  if (AM_SESION.matricula) {
    const mat = `Mat. ${AM_SESION.matricula}${AM_SESION.cpia ? ' · ' + AM_SESION.cpia : ''}${AM_SESION.matriculaVerificada ? ' ✓' : ''}`;
    rows.push({ icon: '🎓', label: mat });
  }
  if (AM_SESION.trialHasta) {
    rows.push({ icon: '🕐', label: `Trial hasta ${new Date(AM_SESION.trialHasta).toLocaleDateString('es-AR')}` });
  }
  if (AM_SESION.planHasta) {
    rows.push({ icon: '📅', label: `Plan hasta ${new Date(AM_SESION.planHasta).toLocaleDateString('es-AR')}` });
  }

  const overlay = document.createElement('div');
  overlay.id = 'am-perfil-panel';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(28,18,8,.4);backdrop-filter:blur(3px);display:flex;justify-content:flex-end;align-items:flex-start;padding:56px 12px 12px;box-sizing:border-box';

  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(280px, calc(100vw - 24px));max-height:calc(100dvh - 80px)',
    'background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(28,18,8,.2)',
    'font-family:"DM Sans",sans-serif;overflow:auto;-webkit-overflow-scrolling:touch'
  ].join(';');
  if (window.innerWidth < 520) {
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '64px 10px 10px';
  }

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'background:linear-gradient(135deg,var(--canopy,#3A7A4A),#2A5A8C);padding:1rem 1.1rem .8rem;color:#fff';
  header.innerHTML = `<div style="font-weight:700;font-size:.95rem">${plan.icon} ${AM_SESION.nombre.split(' ')[0]}</div><div style="font-size:.72rem;opacity:.8;margin-top:.1rem">${AM_SESION.email}</div>`;

  // Filas info
  const body = document.createElement('div');
  body.style.cssText = 'padding:.7rem 1rem';
  rows.slice(2).forEach(function(r) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.55rem;padding:.35rem 0;font-size:.8rem;color:#3a2e1c;border-bottom:1px solid rgba(74,46,26,.07)';
    row.innerHTML = `<span style="font-size:.9rem;flex-shrink:0">${r.icon}</span><span style="min-width:0;overflow-wrap:anywhere">${r.label}</span>`;
    body.appendChild(row);
  });

  // Botones
  const btns = document.createElement('div');
  btns.style.cssText = 'padding:.7rem 1rem .9rem;display:flex;flex-direction:column;gap:.45rem';

  function mkBtn(txt, color, action) {
    const b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = `width:100%;border:none;border-radius:9px;padding:.55rem .9rem;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit;background:${color};color:#fff;text-align:left`;
    b.addEventListener('click', function() { overlay.remove(); action(); });
    return b;
  }

  btns.appendChild(mkBtn('🚪 Cerrar sesión', '#C94A2A', function() { amCerrarSesion(); }));
  if (typeof amOnbStart === 'function') {
    btns.appendChild(mkBtn('🎯 Ver tour de bienvenida', '#2A5A8C', function() { amOnbStart(); }));
  }
  if (AM_SESION.rol === 'admin') {
    btns.appendChild(mkBtn('Panel admin', '#1A3A6C', function() { window.location.href = '/admin.html'; }));
  }

  // Dar de baja
  const btnBaja = document.createElement('button');
  btnBaja.textContent = '🗑 Dar de baja mi cuenta';
  btnBaja.style.cssText = 'width:100%;border:1.5px solid #e5e7eb;border-radius:9px;padding:.5rem .9rem;font-size:.78rem;cursor:pointer;font-family:inherit;background:#fff;color:#9ca3af;text-align:left;margin-top:.3rem';
  btnBaja.addEventListener('click', function() {
    overlay.remove();
    amSolicitarBajaCuenta();
  });
  btns.appendChild(btnBaja);

  const btnCerrar = document.createElement('button');
  btnCerrar.textContent = 'Cancelar';
  btnCerrar.style.cssText = 'width:100%;border:1.5px solid #d4c9b8;border-radius:9px;padding:.5rem .9rem;font-size:.82rem;cursor:pointer;font-family:inherit;background:#fff;color:#5a4a32';
  btnCerrar.addEventListener('click', function() { overlay.remove(); });
  btns.appendChild(btnCerrar);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(btns);
  overlay.appendChild(panel);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── HELPER: seleccionar plan desde modal ──────────────
// Si el user ya está logueado y elige un plan pago → va directo a MP.
// Si no, abre el form de registro con el plan preseleccionado.
function amRegistrarPlan(plan) {
  // User logueado eligiendo plan pago → suscribirse en MP
  if (AM_SESION && plan !== 'free') {
    amSuscribir(plan);
    return;
  }
  // Sin sesión → registro
  const sel = $('am-reg-plan');
  if (sel) sel.value = plan;
  amCambiarVista('registro');
}

// ── INICIAR SUSCRIPCIÓN MERCADOPAGO ───────────────────
// Si el user está logueado → llama a la edge function que crea el preapproval
// y redirige al checkout de MP.
async function amSuscribir(plan) {
  if (!AM_SESION) {
    amToast('Iniciá sesión primero para suscribirte.', 'err');
    amMostrarModal('login');
    return;
  }
  if (!['asesor','pro','empresa'].includes(plan)) {
    amToast('Plan inválido.', 'err');
    return;
  }
  try {
    const { data: { session } } = await AM_SB.auth.getSession();
    if (!session) { amToast('Sesión expirada.', 'err'); return; }

    const url = AM_CONFIG.supabase.url + '/functions/v1/mp-crear-suscripcion';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ plan }),
    });
    const data = await r.json();
    if (!r.ok || !data.init_point) {
      amToast(data.error || 'No pudimos crear la suscripción. Intentá de nuevo.', 'err');
      console.error('MP suscripcion error:', data);
      return;
    }
    // Redirigir al checkout de Mercado Pago
    window.location.href = data.init_point;
  } catch (e) {
    amToast('Error de conexión con Mercado Pago.', 'err');
    console.error('amSuscribir:', e);
  }
}
window.amSuscribir = amSuscribir;

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

// ── SOLICITUD DE BAJA DE CUENTA ───────────────────────
async function amSolicitarBajaCuenta() {
  if (!AM_SESION) return;

  // Diálogo de confirmación
  const conf = document.createElement('div');
  conf.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(28,18,8,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box';
  conf.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:340px;width:100%;padding:1.5rem;font-family:'DM Sans',sans-serif;box-shadow:0 16px 48px rgba(28,18,8,.25)">
      <div style="font-size:1.6rem;text-align:center;margin-bottom:.6rem">⚠️</div>
      <div style="font-weight:700;font-size:1rem;color:#1c1912;margin-bottom:.5rem;text-align:center">¿Dar de baja tu cuenta?</div>
      <div style="font-size:.8rem;color:#5a4a32;line-height:1.55;margin-bottom:1.1rem">
        Registraremos tu solicitud de baja. En menos de <strong>48 horas</strong> eliminamos tu cuenta y todos tus datos de nuestros servidores.<br><br>
        Recibirás confirmación en <strong>${AM_SESION.email}</strong>.<br><br>
        Esta acción no se puede deshacer.
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <button id="am-baja-confirmar" style="width:100%;padding:.6rem;border-radius:9px;border:none;background:#C94A2A;color:#fff;font-weight:700;font-size:.85rem;cursor:pointer;font-family:inherit">
          Sí, quiero dar de baja mi cuenta
        </button>
        <button id="am-baja-cancelar" style="width:100%;padding:.55rem;border-radius:9px;border:1.5px solid #d4c9b8;background:#fff;color:#5a4a32;font-size:.85rem;cursor:pointer;font-family:inherit">
          Cancelar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(conf);

  document.getElementById('am-baja-cancelar').addEventListener('click', function() { conf.remove(); });
  document.getElementById('am-baja-confirmar').addEventListener('click', async function() {
    this.disabled = true; this.textContent = 'Registrando solicitud...';
    try {
      await AM_SB.from('profiles').update({
        deletion_requested_at: new Date().toISOString(),
        plan: 'free'
      }).eq('id', AM_SESION.id);
      conf.remove();
      amToast('Solicitud de baja registrada. Te contactaremos en menos de 48 horas.', 'ok');
      setTimeout(function() { amCerrarSesion(); }, 2000);
    } catch(e) {
      conf.remove();
      amToast('Error al registrar la solicitud. Escribinos a soporte@agromotor.app', 'error');
    }
  });
  conf.addEventListener('click', function(e) { if (e.target === conf) conf.remove(); });
}

  // Exponer a global
  window.AM_PLANES = AM_PLANES;
  window.amTieneAcceso = amTieneAcceso;
  window.amActualizarUI = amActualizarUI;
  window.amMostrarModal = amMostrarModal;
  window.amCerrarModal = amCerrarModal;
  window.amCambiarVista = amCambiarVista;
  window.amMostrarModalUpgrade = amMostrarModalUpgrade;

  window.amLogin = amLogin;
  window.amConfirmarNuevaContrasena = amConfirmarNuevaContrasena;
  window.amOlvidarContrasena = amOlvidarContrasena;
  window.amProcesarUrlParams = amProcesarUrlParams;
  window.amRegistrar = amRegistrar;
  window.amSolicitarBajaCuenta = amSolicitarBajaCuenta;
  window.amCerrarSesion = amCerrarSesion;
  window.amMostrarPerfil = amMostrarPerfil;
  window.amRegistrarPlan = amRegistrarPlan;
  window.amMostrarError = amMostrarError;
  window.amToast = amToast;
  window.amCargarSesion = amCargarSesion;

  // Propagar actualización de AM_SESION
  Object.defineProperty(window, 'AM_SESION', {
    get: function() { return AM_SESION; },
    set: function(val) { AM_SESION = val; }
  });

})();
