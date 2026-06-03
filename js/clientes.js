// ════════════════════════════════════════════════════════
// AGROMOTOR — clientes.js v1
// Catálogo de clientes en localStorage · CRUD modal
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  var CLIENTES_KEY = 'am_clientes_v1';

  window.AM_CLIENTES = [];

  function cargarClientes() {
    try {
      var raw = localStorage.getItem(CLIENTES_KEY);
      if (raw) window.AM_CLIENTES = JSON.parse(raw) || [];
    } catch (e) {
      window.AM_CLIENTES = [];
    }
    if (!Array.isArray(window.AM_CLIENTES)) window.AM_CLIENTES = [];
  }

  function guardarClientes() {
    try {
      localStorage.setItem(CLIENTES_KEY, JSON.stringify(window.AM_CLIENTES));
    } catch (e) {}
  }

  // Retorna HTML de <option> para el select del formulario de lote
  window.amClienteOptions = function (clienteIdActual) {
    var opts = ['<option value="">Sin cliente asignado</option>'];
    (window.AM_CLIENTES || []).forEach(function (c) {
      var sel = (c.id === clienteIdActual) ? ' selected' : '';
      opts.push('<option value="' + esc(c.id) + '"' + sel + '>' + esc(c.nombre) + '</option>');
    });
    opts.push('<option value="__nuevo__">+ Nuevo cliente...</option>');
    return opts.join('');
  };

  // ── Modal CRUD ───────────────────────────────────────
  window.amMostrarModalClientes = function () {
    cerrarModal();
    var overlay = document.createElement('div');
    overlay.id = 'am-cli-overlay';
    overlay.className = 'am-cli-overlay';
    overlay.innerHTML = buildModalHTML();
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) cerrarModal();
    });
    setTimeout(function () {
      var inp = document.getElementById('am-cli-nombre');
      if (inp) inp.focus();
    }, 80);
  };

  window.amCerrarModalClientes = cerrarModal;

  function cerrarModal() {
    var el = document.getElementById('am-cli-overlay');
    if (el) el.remove();
  }

  function buildListaHTML() {
    if (!window.AM_CLIENTES.length) {
      return '<p class="am-cli-empty">No hay clientes registrados todavía.</p>';
    }
    return window.AM_CLIENTES.map(function (c) {
      return '<div class="am-cli-row" id="am-cli-item-' + esc(c.id) + '">' +
        '<div class="am-cli-info">' +
          '<div class="am-cli-nombre">' + esc(c.nombre) + '</div>' +
          (c.localidad ? '<div class="am-cli-sub">' + esc(c.localidad) + '</div>' : '') +
        '</div>' +
        '<div class="am-cli-acciones">' +
          '<button class="am-cli-btn-edit" onclick="amClienteEditar(\'' + esc(c.id) + '\')">✏ Editar</button>' +
          '<button class="am-cli-btn-del" onclick="amClienteEliminar(\'' + esc(c.id) + '\')">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function buildModalHTML() {
    return '<div class="am-cli-box">' +
      '<div class="am-cli-head">' +
        '<span class="am-cli-head-titulo">👤 Mis Clientes</span>' +
        '<button class="am-cli-close" onclick="amCerrarModalClientes()">✕</button>' +
      '</div>' +
      '<div class="am-cli-body">' +
        '<div class="am-cli-section-title">Clientes registrados</div>' +
        '<div id="am-cli-lista">' + buildListaHTML() + '</div>' +
        '<div class="am-cli-section-title" style="margin-top:1.25rem">Agregar / editar cliente</div>' +
        '<div class="am-cli-form" id="am-cli-form">' +
          '<div class="am-cli-fg">' +
            '<label class="am-cli-label">Nombre / Razón social <span class="am-cli-req">*</span></label>' +
            '<input id="am-cli-nombre" class="am-cli-input" type="text" placeholder="Ej: Hermanos García, Estancia Don Pedro..." autocomplete="off">' +
          '</div>' +
          '<div class="am-cli-fg-row">' +
            '<div class="am-cli-fg">' +
              '<label class="am-cli-label">Localidad</label>' +
              '<input id="am-cli-localidad" class="am-cli-input" type="text" placeholder="Ej: Pergamino..." autocomplete="off">' +
            '</div>' +
            '<div class="am-cli-fg">' +
              '<label class="am-cli-label">Teléfono</label>' +
              '<input id="am-cli-telefono" class="am-cli-input" type="text" placeholder="Ej: +54 9 3..." autocomplete="off">' +
            '</div>' +
          '</div>' +
          '<div class="am-cli-fg">' +
            '<label class="am-cli-label">Email</label>' +
            '<input id="am-cli-email" class="am-cli-input" type="email" placeholder="cliente@email.com" autocomplete="off">' +
          '</div>' +
          '<input type="hidden" id="am-cli-edit-id" value="">' +
          '<div class="am-cli-footer-form">' +
            '<button class="am-cli-btn-cancel" onclick="amCliResetForm()">Cancelar</button>' +
            '<button class="am-cli-btn-guardar" onclick="amClienteGuardar()">Guardar cliente →</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  window.amClienteGuardar = function () {
    var nombre    = (val('am-cli-nombre')).trim();
    if (!nombre) {
      var inp = document.getElementById('am-cli-nombre');
      if (inp) { inp.style.borderColor = '#D4522A'; inp.focus(); }
      return;
    }
    var localidad = val('am-cli-localidad').trim();
    var telefono  = val('am-cli-telefono').trim();
    var email     = val('am-cli-email').trim();
    var editId    = val('am-cli-edit-id').trim();

    if (editId) {
      var cli = (window.AM_CLIENTES || []).find(function (c) { return c.id === editId; });
      if (cli) {
        cli.nombre    = nombre;
        cli.localidad = localidad;
        cli.telefono  = telefono;
        cli.email     = email;
      }
    } else {
      window.AM_CLIENTES.push({
        id:        'cli_' + Date.now(),
        nombre:    nombre,
        localidad: localidad,
        telefono:  telefono,
        email:     email,
      });
    }

    guardarClientes();

    var lista = document.getElementById('am-cli-lista');
    if (lista) lista.innerHTML = buildListaHTML();

    amCliResetForm();
    if (typeof amToast === 'function') amToast(editId ? 'Cliente actualizado ✓' : 'Cliente agregado ✓', 'ok');
    if (typeof amRenderSelectLotes === 'function') amRenderSelectLotes();
  };

  window.amClienteEditar = function (id) {
    var cli = (window.AM_CLIENTES || []).find(function (c) { return c.id === id; });
    if (!cli) return;
    setVal('am-cli-nombre',    cli.nombre    || '');
    setVal('am-cli-localidad', cli.localidad || '');
    setVal('am-cli-telefono',  cli.telefono  || '');
    setVal('am-cli-email',     cli.email     || '');
    setVal('am-cli-edit-id',   cli.id);
    var inp = document.getElementById('am-cli-nombre');
    if (inp) { inp.style.borderColor = ''; inp.focus(); }
    var form = document.getElementById('am-cli-form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  window.amClienteEliminar = function (id) {
    var cli = (window.AM_CLIENTES || []).find(function (c) { return c.id === id; });
    if (!cli) return;
    if (!confirm('¿Eliminar cliente "' + cli.nombre + '"?\nLos lotes asignados quedarán sin cliente.')) return;
    window.AM_CLIENTES = window.AM_CLIENTES.filter(function (c) { return c.id !== id; });
    guardarClientes();
    var row = document.getElementById('am-cli-item-' + id);
    if (row) row.remove();
    var lista = document.getElementById('am-cli-lista');
    if (lista && !window.AM_CLIENTES.length) {
      lista.innerHTML = '<p class="am-cli-empty">No hay clientes registrados todavía.</p>';
    }
    if (typeof amToast === 'function') amToast('Cliente eliminado', 'ok');
    if (typeof amRenderSelectLotes === 'function') amRenderSelectLotes();
  };

  window.amCliResetForm = function () {
    ['am-cli-nombre','am-cli-localidad','am-cli-telefono','am-cli-email','am-cli-edit-id'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.value = ''; el.style.borderColor = ''; }
    });
  };

  // ── Helpers ──────────────────────────────────────────
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Inicializar
  cargarClientes();
  window.amClientesCargar   = cargarClientes;
  window.amClientesGuardar  = guardarClientes;

})();
