/**
 * AgroMotor – Revisión Visual Completa con Puppeteer
 * Navega por todos los módulos, toma screenshots, reporta errores.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://agromotor.com.ar';
const EMAIL = 'agrohernan@gmail.com';
// Password leído de variable de entorno o argumento
const PASSWORD = process.env.AM_PASSWORD || process.argv[2] || '';

const OUT_DIR = '/tmp/am-review';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const errors = [];
const screenshots = [];

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

async function shot(page, name, label) {
  const file = path.join(OUT_DIR, `${String(screenshots.length + 1).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  screenshots.push({ file, label });
  log(`  📸 ${label}`);
  return file;
}

async function waitAndClick(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
  await page.click(selector);
}

async function collectConsoleErrors(page) {
  const errs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errs.push(msg.text());
  });
  page.on('pageerror', err => errs.push(err.message));
  return errs;
}

// Módulos definidos en app.html
const MODULES = [
  { id: 'mod-dashboard',      label: 'Dashboard',              nav: 'a[href="#dashboard"], [data-modulo="dashboard"]' },
  { id: 'mod-siembra',        label: 'Qué Sembrar',            nav: '[data-modulo="siembra"], a[href="#siembra"]' },
  { id: 'mod-economia',       label: 'Economía / Costos',      nav: '[data-modulo="economia"], a[href="#economia"]' },
  { id: 'mod-hidrico',        label: 'Balance Hídrico',        nav: '[data-modulo="hidrico"], a[href="#hidrico"]' },
  { id: 'mod-nutricion',      label: 'Nutrición',              nav: '[data-modulo="nutricion"], a[href="#nutricion"]' },
  { id: 'mod-maquinaria',     label: 'Maquinaria',             nav: '[data-modulo="maquinaria"], a[href="#maquinaria"]' },
  { id: 'mod-cultivares',     label: 'Cultivares',             nav: '[data-modulo="cultivares"], a[href="#cultivares"]' },
  { id: 'mod-decision',       label: 'Decisión Sanitaria',     nav: '[data-modulo="decision"], a[href="#decision"]' },
  { id: 'mod-plagas',         label: 'Plagas / Alertas',       nav: '[data-modulo="plagas"], a[href="#plagas"]' },
  { id: 'mod-pulverizacion',  label: 'Pulverización',          nav: '[data-modulo="pulverizacion"], a[href="#pulverizacion"]' },
  { id: 'mod-cosecha',        label: 'Cosecha',                nav: '[data-modulo="cosecha"], a[href="#cosecha"]' },
  { id: 'mod-seguimiento',    label: 'Seguimiento',            nav: '[data-modulo="seguimiento"], a[href="#seguimiento"]' },
  { id: 'mod-mapa',           label: 'Mapa / Lotes',           nav: '[data-modulo="mapa"], a[href="#mapa"]' },
  { id: 'mod-siembra-variable', label: 'Siembra Variable',    nav: '[data-modulo="siembra-variable"], a[href="#siembra-variable"]' },
  { id: 'mod-rotacion',       label: 'Rotación',               nav: '[data-modulo="rotacion"], a[href="#rotacion"]' },
  { id: 'mod-asistente',      label: 'Asistente IA',           nav: '[data-modulo="asistente"], a[href="#asistente"]' },
  { id: 'mod-alerta-sanitaria', label: 'Alerta Sanitaria',    nav: '[data-modulo="alerta-sanitaria"], a[href="#alerta-sanitaria"]' },
];

async function checkModuleVisible(page, moduleId) {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return { found: false };
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      found: true,
      display: style.display,
      visibility: style.visibility,
      height: rect.height,
      width: rect.width,
    };
  }, moduleId);
}

async function checkOtherModulesHidden(page, activeModuleId) {
  return page.evaluate((activeId) => {
    const panels = document.querySelectorAll('.module-panel');
    const visible = [];
    panels.forEach(p => {
      if (p.id === activeId) return;
      const style = window.getComputedStyle(p);
      if (style.display !== 'none') {
        visible.push({ id: p.id, display: style.display });
      }
    });
    return visible;
  });
}

async function run() {
  if (!PASSWORD) {
    log('ERROR: Proporcione la contraseña como variable AM_PASSWORD o argumento');
    process.exit(1);
  }

  log('Iniciando Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors', '--window-size=1440,900'],
    ignoreHTTPSErrors: true,
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ time: new Date().toISOString(), text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ time: new Date().toISOString(), text: 'PAGE ERROR: ' + err.message });
  });

  // ── 1. INDEX ─────────────────────────────────────────────────────────────
  log('Cargando index.html...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await shot(page, 'index', 'Página principal (index)');

  // ── 2. LOGIN ──────────────────────────────────────────────────────────────
  log('Haciendo login...');
  try {
    // Check if there's a login button or form visible
    const loginVisible = await page.evaluate(() => {
      return !!(document.getElementById('loginForm') || document.getElementById('email') || document.querySelector('[data-auth="login"]'));
    });

    if (loginVisible) {
      // Try filling the login form
      await page.waitForSelector('#email, input[type="email"]', { timeout: 10000 });
      const emailSel = await page.$('#email') ? '#email' : 'input[type="email"]';
      await page.type(emailSel, EMAIL);

      const passSel = await page.$('#password') ? '#password' : 'input[type="password"]';
      await page.type(passSel, PASSWORD);

      await shot(page, 'login-filled', 'Formulario de login completado');

      // Click login button
      const loginBtn = await page.$('#btnLogin, button[type="submit"], .btn-login');
      if (loginBtn) {
        await loginBtn.click();
      }
    } else {
      // Navigate directly to app.html
      await page.goto(`${BASE_URL}/app.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // Wait for navigation / redirect
    await page.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const currentUrl = page.url();
    log(`  URL después de login: ${currentUrl}`);
    await shot(page, 'after-login', 'Después de login');

    // If still on login page, try app.html directly
    if (currentUrl.includes('index') || !currentUrl.includes('app')) {
      log('  Navegando directamente a app.html...');
      await page.goto(`${BASE_URL}/app.html`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      await shot(page, 'app-direct', 'App.html directo');
    }
  } catch (e) {
    errors.push({ step: 'login', error: e.message });
    log(`  ERROR en login: ${e.message}`);
    await shot(page, 'login-error', 'Error en login');
  }

  // ── 3. VERIFICAR QUE ESTAMOS EN LA APP ───────────────────────────────────
  // Wait a bit more for JS to initialize
  await new Promise(r => setTimeout(r, 4000));
  await shot(page, 'app-check', 'Estado de app.html después de espera');

  const appDiag = await page.evaluate(() => {
    return {
      url: location.href,
      title: document.title,
      bodyClass: document.body.className,
      hasModulePanel: !!document.querySelector('.module-panel'),
      hasNav: !!document.querySelector('nav, #nav, .am-nav, .nav'),
      hasMain: !!document.querySelector('main, #main, #app'),
      visiblePanels: Array.from(document.querySelectorAll('.module-panel'))
        .filter(el => window.getComputedStyle(el).display !== 'none')
        .map(el => el.id),
      allPanels: Array.from(document.querySelectorAll('.module-panel')).map(el => el.id),
      navLinks: Array.from(document.querySelectorAll('nav a, [data-modulo]')).slice(0,5).map(el => ({
        text: el.textContent.trim().slice(0,30),
        attr: el.getAttribute('data-modulo') || el.getAttribute('href')
      })),
    };
  });
  log(`  Diagnóstico app: ${JSON.stringify(appDiag, null, 2)}`);

  const inApp = appDiag.hasModulePanel || appDiag.hasNav || appDiag.hasMain;

  if (!inApp) {
    errors.push({ step: 'app-load', error: 'No se pudo acceder a la app después del login' });
    log('ERROR: No se cargó la app. Abortando revisión de módulos.');
    await browser.close();
    printReport();
    return;
  }

  log('App cargada correctamente.');
  await shot(page, 'app-loaded', 'App cargada – módulo inicial');

  // ── 4. REVISAR CADA MÓDULO ────────────────────────────────────────────────
  for (const mod of MODULES) {
    log(`\nRevisando módulo: ${mod.label}...`);

    try {
      // Find and click nav item
      const navClicked = await page.evaluate((selector) => {
        const parts = selector.split(',').map(s => s.trim());
        for (const sel of parts) {
          try {
            const el = document.querySelector(sel);
            if (el) { el.click(); return true; }
          } catch (e) {}
        }
        return false;
      }, mod.nav);

      if (!navClicked) {
        log(`  ⚠ Nav item no encontrado: ${mod.nav}`);
        errors.push({ step: mod.id, error: `Ítem de navegación no encontrado: ${mod.nav}` });
        continue;
      }

      await new Promise(r => setTimeout(r, 1500));

      // Check the module panel is visible
      const visibility = await checkModuleVisible(page, mod.id);

      if (!visibility.found) {
        errors.push({ step: mod.id, error: `Panel #${mod.id} no existe en el DOM` });
        log(`  ✗ Panel no encontrado en DOM`);
      } else if (visibility.display === 'none') {
        errors.push({ step: mod.id, error: `Panel #${mod.id} tiene display:none después de activarse` });
        log(`  ✗ Panel sigue oculto (display:none)`);
      } else {
        log(`  ✓ Panel visible (display:${visibility.display}, ${Math.round(visibility.width)}x${Math.round(visibility.height)})`);
      }

      // Check other modules are hidden
      const leaks = await checkOtherModulesHidden(page, mod.id);
      if (leaks.length > 0) {
        const leakIds = leaks.map(l => l.id).join(', ');
        errors.push({ step: mod.id, error: `Módulos que NO deberían estar visibles: ${leakIds}` });
        log(`  ✗ Módulos visibles simultáneamente: ${leakIds}`);
      }

      // Check for overflow / cut content
      const overflow = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflow: el.scrollWidth > el.clientWidth + 5,
        };
      }, mod.id);

      if (overflow && overflow.overflow) {
        log(`  ⚠ Contenido cortado (scrollWidth:${overflow.scrollWidth} > clientWidth:${overflow.clientWidth})`);
        errors.push({ step: mod.id, error: `Contenido horizontalmente desbordado (overflow)` });
      }

      // Take screenshot
      await shot(page, mod.id, `Módulo: ${mod.label}`);

    } catch (e) {
      errors.push({ step: mod.id, error: e.message });
      log(`  ERROR: ${e.message}`);
      await shot(page, `${mod.id}-error`, `ERROR en ${mod.label}`).catch(() => {});
    }
  }

  // ── 5. VERIFICAR MODALES Y BOTONES PRINCIPALES ────────────────────────────
  log('\nVerificando botones y modales...');

  // Check perfil / config modal
  try {
    const profileBtn = await page.$('[data-modal="perfil"], [onclick*="perfil"], #btnPerfil, .user-avatar, [data-action="perfil"]');
    if (profileBtn) {
      await profileBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      await shot(page, 'modal-perfil', 'Modal Perfil de usuario');
      // Close modal
      const closeBtn = await page.$('.am-modal-close, [data-action="cerrar-modal"], #btnCerrarModal');
      if (closeBtn) await closeBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    log(`  Modal perfil: ${e.message}`);
  }

  // ── 6. RECOLECTAR ERRORES DE CONSOLA ─────────────────────────────────────
  log(`\nErrores de consola capturados: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 20).forEach(e => log(`  [CONSOLE ERROR] ${e.text.slice(0, 150)}`));
  }

  await browser.close();

  // ── 7. REPORTE FINAL ──────────────────────────────────────────────────────
  printReport(consoleErrors);
}

function printReport(consoleErrors = []) {
  const report = {
    date: new Date().toISOString(),
    screenshots: screenshots.map(s => ({ file: path.basename(s.file), label: s.label })),
    structuralErrors: errors,
    consoleErrors: consoleErrors.slice(0, 30),
    summary: {
      screenshotsTaken: screenshots.length,
      structuralIssues: errors.length,
      consoleIssues: consoleErrors.length,
    }
  };

  const reportFile = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log('  REPORTE VISUAL – AGROMOTOR');
  console.log('══════════════════════════════════════════════');
  console.log(`  Screenshots: ${report.summary.screenshotsTaken}`);
  console.log(`  Problemas estructurales: ${report.summary.structuralIssues}`);
  console.log(`  Errores de consola JS: ${report.summary.consoleIssues}`);
  console.log(`  Directorio: ${OUT_DIR}`);

  if (errors.length > 0) {
    console.log('\n  PROBLEMAS ENCONTRADOS:');
    errors.forEach((e, i) => console.log(`  ${i+1}. [${e.step}] ${e.error}`));
  } else {
    console.log('\n  ✓ Sin problemas estructurales detectados.');
  }

  if (consoleErrors.length > 0) {
    console.log('\n  ERRORES JAVASCRIPT EN CONSOLA:');
    consoleErrors.slice(0, 10).forEach((e, i) => console.log(`  ${i+1}. ${e.text.slice(0, 200)}`));
  }

  console.log('\n══════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
