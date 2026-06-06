// AGROMOTOR - clientes.js
// Catalogo local de clientes, aislado por usuario cuando hay sesion.
(function () {
  'use strict';

  var LEGACY_KEY = 'am_clientes_v1';
  var KEY_PREFIX = 'am_clientes_v1_';
  window.AM_CLIENTES = window.AM_CLIENTES || [];

  function uidActual() {
    try {
      if (window.AM_SESION && window.AM_SESION.uid) return String(window.AM_SESION.uid);
      if (window.AM_SESION && window.AM_SESION.user && window.AM_SESION.user.id) return String(window.AM_SESION.user.id);
      var raw = localStorage.getItem('am_sesion');
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.uid) return String(s.uid);
        if (s && s.user && s.user.id) return String(s.user.id);
      }
    } catch (_) {}
    return '';
  }

  function clientesKey() {
    var uid = uidActual();
    return uid ? KEY_PREFIX + uid : LEGACY_KEY;
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  function cargarClientes() {
    var key = clientesKey();
    try {
      var raw = localStorage.getItem(key);
      if (!raw && key !== LEGACY_KEY) {
        raw = localStorage.getItem(LEGACY_KEY);
        if (raw) localStorage.setItem(key, raw);
      }
      window.AM_CLIENTES = raw ? (JSON.parse(raw) || []) : [];
    } catch (_) {
      window.AM_CLIENTES = [];
    }
    if (!Array.isArray(window.AM_CLIENTES)) window.AM_CLIENTES = [];
    return window.AM_CLIENTES;
  }

  function guardarClientes() {
    try { localStorage.setItem(clientesKey(), JSON.stringify(window.AM_CLIENTES || [])); } catch (_) {}
  }

  function clientePorId(id) {
    return (window.AM_CLIENTES || []).find(function (c) { return c.id === id; }) || null;
  }

  function sincronizarLotesCliente(clienteId) {
    var cli = clientePorId(clienteId);
    var changed = false;
    (window.AM_LOTES || []).forEach(function (lote) {
      var d = lote.data || {};
      if (d.clienteId !== clienteId) return;
      lote.data = d;
      d.clienteNombre = cli ? cli.nombre : '';
      if (!cli) d.clienteId = '';
      changed = true;
    });
    if (changed && typeof window.amGuardarLotesEstado === 'function') window.amGuardarLotesEstado();
  }

  window.amClienteOptions = function (clienteIdActual) {
    cargarClientes();
    var opts = ['<option value="">Sin cliente asignado</option>'];
    (window.AM_CLIENTES || []).slice().sort(function (a, b) {
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    }).forEach(function (c) {
      var sel = c.id === clienteIdActual ? ' selected' : '';
      opts.push('<option value="' + escAttr(c.id) + '"' + sel + '>' + esc(c.nombre) + '</option>');
    });
    opts.push('<option value="__nuevo__">+ Nuevo cliente...</option>');
    return opts.join('');
  };

  function renderLista() {
    if (!window.AM_CLIENTES.length) return '<p class="am-cli-empty">No hay clientes registrados todavia.</p>';
    return window.AM_CLIENTES.map(function (c) {
      var meta = [c.empresa, c.email, c.telefono].filter(Boolean).map(esc).join(' · ');
      return '<div class="am-cli-item">' +
        '<div><strong>' + esc(c.nombre) + '</strong>' +
        (meta ? '<span>' + meta + '</span>' : '') + '</div>' +
        '<div class="am-cli-actions">' +
          '<button class="am-cli-btn-edit" onclick="amClienteEditar(\'' + escAttr(c.id) + '\')">Editar</button>' +
          '<button class="am-cli-btn-del" onclick="amClienteEliminar(\'' + escAttr(c.id) + '\')">Eliminar</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.amMostrarModalClientes = function () {
    cargarClientes();
    var old = document.getElementById('am-cli-overlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'am-cli-overlay';
    overlay.className = 'am-cli-overlay';
    overlay.innerHTML =
      '<div class="am-cli-box">' +
        '<div class="am-cli-head"><span>Mis clientes</span><button onclick="amCerrarModalClientes()" title="Cerrar">x</button></div>' +
        '<div class="am-cli-body">' +
          '<div class="am-cli-section-title">Clientes registrados</div>' +
          '<div id="am-cli-lista" class="am-cli-lista">' + renderLista() + '</div>' +
          '<div class="am-cli-section-title">Agregar / editar cliente</div>' +
          '<input id="am-cli-id" type="hidden">' +
          '<div class="am-cli-grid">' +
            '<input id="am-cli-nombre" class="am-cli-input" placeholder="Nombre o razon social">' +
            '<input id="am-cli-empresa" class="am-cli-input" placeholder="Empresa / campo">' +
            '<input id="am-cli-email" class="am-cli-input" type="email" placeholder="cliente@email.com">' +
            '<input id="am-cli-telefono" class="am-cli-input" placeholder="Telefono">' +
          '</div>' +
          '<textarea id="am-cli-notas" class="am-cli-input am-cli-textarea" placeholder="Notas internas"></textarea>' +
        '</div>' +
        '<div class="am-cli-footer">' +
          '<button class="am-cli-btn-sec" onclick="amClienteLimpiarForm()">Limpiar</button>' +
          '<button class="am-cli-btn-guardar" onclick="amClienteGuardar()">Guardar cliente</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) window.amCerrarModalClientes();
    });
    document.body.appendChild(overlay);
    setTimeout(function () {
      var inp = document.getElementById('am-cli-nombre');
      if (inp) inp.focus();
    }, 50);
  };

  window.amCerrarModalClientes = function () {
    var el = document.getElementById('am-cli-overlay');
    if (el) el.remove();
  };

  window.amClienteLimpiarForm = function () {
    ['am-cli-id','am-cli-nombre','am-cli-empresa','am-cli-email','am-cli-telefono','am-cli-notas'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
  };

  window.amClienteGuardar = function () {
    cargarClientes();
    var id = (document.getElementById('am-cli-id') || {}).value || '';
    var nombre = ((document.getElementById('am-cli-nombre') || {}).value || '').trim();
    if (!nombre) {
      if (typeof amToast === 'function') amToast('Ingresá el nombre del cliente.', 'error');
      return;
    }
    var data = {
      id: id || ('cli_' + Date.now()),
      nombre: nombre,
      empresa: ((document.getElementById('am-cli-empresa') || {}).value || '').trim(),
      email: ((document.getElementById('am-cli-email') || {}).value || '').trim(),
      telefono: ((document.getElementById('am-cli-telefono') || {}).value || '').trim(),
      notas: ((document.getElementById('am-cli-notas') || {}).value || '').trim(),
      ts: Date.now()
    };
    var idx = window.AM_CLIENTES.findIndex(function (c) { return c.id === data.id; });
    if (idx >= 0) window.AM_CLIENTES[idx] = Object.assign({}, window.AM_CLIENTES[idx], data);
    else window.AM_CLIENTES.push(data);
    guardarClientes();
    sincronizarLotesCliente(data.id);
    var lista = document.getElementById('am-cli-lista');
    if (lista) lista.innerHTML = renderLista();
    var loteSelect = document.getElementById('lnv-cliente-sel');
    if (loteSelect && typeof window.amClienteOptions === 'function') {
      loteSelect.innerHTML = window.amClienteOptions(data.id);
      loteSelect.value = data.id;
    }
    window.amClienteLimpiarForm();
    if (typeof amRenderSelectLotes === 'function') amRenderSelectLotes();
    if (typeof dlRefrescar === 'function') dlRefrescar();
    if (typeof amToast === 'function') amToast('Cliente guardado.', 'ok');
  };

  window.amClienteEditar = function (id) {
    cargarClientes();
    var c = clientePorId(id);
    if (!c) return;
    var map = {
      'am-cli-id': c.id,
      'am-cli-nombre': c.nombre,
      'am-cli-empresa': c.empresa,
      'am-cli-email': c.email,
      'am-cli-telefono': c.telefono,
      'am-cli-notas': c.notas
    };
    Object.keys(map).forEach(function (idEl) {
      var el = document.getElementById(idEl);
      if (el) el.value = map[idEl] || '';
    });
  };

  window.amClienteEliminar = function (id) {
    cargarClientes();
    var c = clientePorId(id);
    if (!c) return;
    if (!confirm('Eliminar cliente "' + c.nombre + '"?\nLos lotes asignados quedaran sin cliente.')) return;
    window.AM_CLIENTES = window.AM_CLIENTES.filter(function (cli) { return cli.id !== id; });
    guardarClientes();
    sincronizarLotesCliente(id);
    var lista = document.getElementById('am-cli-lista');
    if (lista) lista.innerHTML = renderLista();
    if (typeof amRenderSelectLotes === 'function') amRenderSelectLotes();
    if (typeof dlRefrescar === 'function') dlRefrescar();
  };

  cargarClientes();
  window.amClientesCargar = cargarClientes;
  window.amClientesGuardar = guardarClientes;
})();
