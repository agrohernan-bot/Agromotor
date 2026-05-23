// ════════════════════════════════════════════════════════
// AGROMOTOR — onboarding.js
// Tour guiado de primer uso · 5 pasos · skippable
// Se dispara la primera vez que un user logueado abre el Dashboard
// ════════════════════════════════════════════════════════

(function() {
  'use strict';

  var STORAGE_KEY = 'am_onboarding_completed';

  var STEPS = [
    {
      icon: '👋',
      title: 'Bienvenido a AgroMotor',
      body: nombre => `Hola${nombre ? ' Ing. ' + nombre : ''}, te muestro cómo aprovechar la herramienta en 30 segundos. Podés saltarte el tour cuando quieras.`,
      target: null,
      placement: 'center',
    },
    {
      icon: '📍',
      title: 'Paso 1 · Ubicá tu lote en el mapa',
      body: () => 'Hacé clic en cualquier punto del mapa o usá el botón GPS si estás en el campo. La coordenada queda guardada y el motor empieza a traer datos automáticamente.',
      target: '#am-inline-map',
      placement: 'bottom',
    },
    {
      icon: '🛰️',
      title: 'Paso 2 · Obtener datos del lote',
      body: () => 'Apretá "Obtener datos" y AgroMotor consulta 4 fuentes en paralelo: Open-Meteo (clima), NASA POWER (histórico), SoilGrids (suelo) y la geolocalización exacta. Sin moverte.',
      target: '#btn-api',
      placement: 'left',
    },
    {
      icon: '🌾',
      title: 'Paso 3 · El flujo agronómico completo',
      body: () => 'Bajá a las tarjetas de módulos. Tenés 17 módulos agrupados en 6 etapas (Planificación → Sanidad → Avanzado). Cada uno hereda los datos del lote.',
      target: '#dash-mod-section',
      placement: 'top',
    },
    {
      icon: '🤖',
      title: 'Paso 4 · Tu asistente IA agronómico',
      body: () => 'En "Asistente IA" podés hacerle preguntas en español sobre tu lote: "¿es buen momento para sembrar?", "¿qué nutrientes faltan?", etc. Responde con datos reales del lote.',
      target: null,
      placement: 'center',
    },
    {
      icon: '📄',
      title: 'Paso 5 · Tus análisis con membrete profesional',
      body: () => 'Cada análisis (Decisión, Nutrición, Suelo, Cosecha, etc.) lo podés exportar a PDF con tu nombre, matrícula y firma — listo para entregarle al productor.',
      target: null,
      placement: 'center',
    },
  ];

  var currentStep = 0;
  var overlay, tooltip;

  function isCompleted() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch(e) { return false; }
  }
  function markCompleted() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'am-onboarding-overlay';
    // top/left/right/bottom en lugar de inset:0 para compatibilidad Safari iOS < 14.1
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9998;
      background: rgba(15,31,20,.7);
      backdrop-filter: blur(2px);
      pointer-events: auto;
      animation: amFadeIn .3s ease;
    `;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) skipTour(); });

    tooltip = document.createElement('div');
    tooltip.id = 'am-onboarding-tooltip';
    // width con min() — box-sizing:border-box — opacity:0 hasta que positionTooltip calcule
    tooltip.style.cssText = `
      position: fixed; z-index: 9999;
      background: linear-gradient(145deg, #fff, #fbf8f1);
      border: 1.5px solid rgba(200,162,85,.45);
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,.4), 0 4px 16px rgba(200,162,85,.25);
      padding: 1.5rem 1.6rem;
      width: min(420px, calc(100vw - 2rem));
      max-height: calc(100vh - 3rem);
      overflow-y: auto;
      box-sizing: border-box;
      font-family: 'DM Sans', sans-serif;
      color: #1c1208;
      opacity: 0;
      transition: opacity .2s ease;
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
  }

  function renderStep() {
    var step = STEPS[currentStep];
    if (!step) { finishTour(); return; }

    var sess = window.AM_SESION;
    var nombre = sess?.nombre?.split(' ')[0] || null;
    var bodyText = typeof step.body === 'function' ? step.body(nombre) : step.body;

    var progress = `${currentStep + 1} de ${STEPS.length}`;
    var btnPrev = currentStep > 0
      ? `<button onclick="amOnbPrev()" style="background:transparent;border:1px solid rgba(74,46,26,.3);color:#5a4a32;padding:.5rem 1rem;border-radius:9px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">← Atrás</button>`
      : `<button onclick="amOnbSkip()" style="background:transparent;border:none;color:rgba(74,46,26,.55);padding:.5rem 1rem;font-size:.82rem;cursor:pointer;font-family:inherit;text-decoration:underline">Saltar tour</button>`;

    var nextLabel = currentStep === STEPS.length - 1 ? '🚀 Empezar' : 'Siguiente →';
    var btnNext = `<button onclick="amOnbNext()" style="background:linear-gradient(135deg,#1E4D2B,#3A7A4A);color:white;border:none;padding:.55rem 1.2rem;border-radius:9px;font-size:.85rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(58,122,74,.3)">${nextLabel}</button>`;

    // Ocultar durante la transición para evitar flash de posición incorrecta
    tooltip.style.opacity = '0';
    tooltip.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
        <div style="font-size:1.6rem">${step.icon}</div>
        <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C8A255;margin-left:auto">${progress}</div>
      </div>
      <div style="font-family:'DM Serif Display',serif;font-size:1.3rem;color:#1b3d28;line-height:1.2;margin-bottom:.6rem">${step.title}</div>
      <div style="font-size:.88rem;line-height:1.55;color:#3D2210;margin-bottom:1.1rem">${bodyText}</div>
      <div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center">${btnPrev}${btnNext}</div>
    `;

    // Scroll primero (sin behavior:'smooth' para que el layout sea inmediato)
    highlightTarget(step.target);

    // Doble rAF: el primero asegura que el DOM está actualizado con el nuevo innerHTML,
    // el segundo asegura que el browser completó el layout y getBoundingClientRect es correcto.
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        positionTooltip(step);
        tooltip.style.opacity = '1';
      });
    });
  }

  function positionTooltip(step) {
    var placement = step.placement || 'center';
    var rect = step.target ? document.querySelector(step.target)?.getBoundingClientRect() : null;
    var vw = window.innerWidth, vh = window.innerHeight;
    var gap = 16;

    // En mobile (<500px) siempre posicionar en la parte superior full-width
    // para que el botón "Siguiente" sea siempre accesible sin scroll.
    if (vw < 500) {
      tooltip.style.top  = '1rem';
      tooltip.style.left = '1rem';
      tooltip.style.right = '1rem';
      tooltip.style.width = 'auto';
      return;
    }

    // Restablecer overrides de mobile
    tooltip.style.right = '';
    tooltip.style.width = '';

    // Leer rect DESPUÉS del doble rAF — layout ya está completo
    var ttRect = tooltip.getBoundingClientRect();
    var ttW = ttRect.width  || 420;
    var ttH = ttRect.height || 200;

    if (placement === 'center' || !rect) {
      tooltip.style.top  = Math.max(16, (vh - ttH) / 2) + 'px';
      tooltip.style.left = Math.max(16, (vw - ttW) / 2) + 'px';
      return;
    }

    var top, left;

    if (placement === 'bottom') {
      top = rect.bottom + gap;
      // Flip arriba si no entra abajo
      if (top + ttH > vh - 16) top = rect.top - ttH - gap;
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - ttW / 2, vw - ttW - 16));
    } else if (placement === 'top') {
      top = rect.top - ttH - gap;
      // Flip abajo si no entra arriba
      if (top < 16) top = rect.bottom + gap;
      left = Math.max(16, Math.min(rect.left + rect.width / 2 - ttW / 2, vw - ttW - 16));
    } else if (placement === 'left') {
      left = rect.left - ttW - gap;
      // Flip derecha si no entra izquierda
      if (left < 16) left = rect.right + gap;
      top = Math.max(16, Math.min(rect.top + rect.height / 2 - ttH / 2, vh - ttH - 16));
    } else if (placement === 'right') {
      left = rect.right + gap;
      // Flip izquierda si no entra derecha
      if (left + ttW > vw - 16) left = rect.left - ttW - gap;
      top = Math.max(16, Math.min(rect.top + rect.height / 2 - ttH / 2, vh - ttH - 16));
    }

    // Clamping duro contra los bordes del viewport
    top  = Math.max(16, Math.min(top,  vh - ttH - 16));
    left = Math.max(16, Math.min(left, vw - ttW - 16));

    tooltip.style.top  = top  + 'px';
    tooltip.style.left = left + 'px';
  }

  function highlightTarget(selector) {
    var prev = document.querySelector('.am-onb-highlight');
    if (prev) {
      prev.classList.remove('am-onb-highlight');
      prev.style.position  = '';
      prev.style.zIndex    = '';
      prev.style.boxShadow = '';
      prev.style.borderRadius = '';
    }
    if (!selector) return;
    var el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('am-onb-highlight');
    var origPos = window.getComputedStyle(el).position;
    if (origPos === 'static') el.style.position = 'relative';
    el.style.zIndex     = '9999';
    el.style.boxShadow  = '0 0 0 4px rgba(200,162,85,.6), 0 0 0 9999px rgba(15,31,20,.0)';
    el.style.borderRadius = '14px';
    // Scroll INSTANTÁNEO (sin behavior:'smooth') para que el rect sea correcto
    // cuando positionTooltip() llame a getBoundingClientRect() en el rAF siguiente.
    var elRect = el.getBoundingClientRect();
    if (elRect.top < 80 || elRect.bottom > window.innerHeight - 100) {
      el.scrollIntoView({ block: 'center' });
    }
  }

  function startTour() {
    if (isCompleted()) return;
    currentStep = 0;
    document.documentElement.classList.add('onb-active');
    buildOverlay();
    setTimeout(renderStep, 100);
  }
  function nextStep() {
    currentStep++;
    if (currentStep >= STEPS.length) finishTour();
    else renderStep();
  }
  function prevStep() {
    currentStep--;
    if (currentStep < 0) currentStep = 0;
    renderStep();
  }
  function skipTour() {
    markCompleted();
    cleanup();
  }
  function finishTour() {
    markCompleted();
    cleanup();
    if (typeof amToast === 'function') {
      amToast('🚀 Listo. Si querés ver el tour de nuevo, andá a tu perfil.', 'ok');
    }
  }
  function cleanup() {
    document.documentElement.classList.remove('onb-active');
    var hl = document.querySelector('.am-onb-highlight');
    if (hl) {
      hl.classList.remove('am-onb-highlight');
      hl.style.position = ''; hl.style.zIndex = ''; hl.style.boxShadow = ''; hl.style.borderRadius = '';
    }
    if (overlay) { overlay.remove(); overlay = null; }
    if (tooltip) { tooltip.remove(); tooltip = null; }
  }

  // Exponer en window
  window.amOnbNext = nextStep;
  window.amOnbPrev = prevStep;
  window.amOnbSkip = skipTour;
  window.amOnbStart = function() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    startTour();
  };

  // Auto-start: cuando el user inicia sesión Y está en el Dashboard, mostrar tour una vez.
  function checkAndStart() {
    if (isCompleted()) return;
    if (!window.AM_SESION) return;
    var dashActive = document.getElementById('mod-dashboard')?.classList.contains('active');
    if (!dashActive) return;
    setTimeout(startTour, 1200);
  }

  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(checkAndStart, 1500);
    var lastSess = null;
    setInterval(function() {
      var hasSess = !!window.AM_SESION;
      if (hasSess && !lastSess) checkAndStart();
      lastSess = hasSess;
    }, 1000);
  });
})();
