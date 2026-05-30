// ════════════════════════════════════════════════════════
// AGROMOTOR — dashboard.js  v1.0
// Panel de Campaña Activa del Dashboard
//
// Widgets:
//   · Cabecera de campaña (lote · cultivo · fecha siembra)
//   · Etapa fenológica actual (nombre · días transcurridos · % ciclo)
//   · Balance hídrico coloreado (agua actual vs CC · déficit · estrés)
//   · Alertas activas (máx. 3 + "ver todas")
//   · Días hasta la próxima etapa fenológica
//
// Actualización: setInterval 30 s + evento 'storage'
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── CLAVES LOCALSTORAGE ──────────────────────────────
  var LS = {
    loteNombre:      'am_lote_nombre',
    cultivo:         'am_siembra_cultivo',
    fechaSiembra:    'am_siembra_fecha',
    fenEtapaHoy:     'am_fen_etapa_hoy',
    fenFechaFinEtapa:'am_fen_fecha_etapa_fin',
    fenDurCiclo:     'am_fen_duracion_ciclo',
    hidroAguaMm:     'am_hidrico_agua_actual_mm',
    hidroDeficitAcum:'am_hidrico_deficit_acum_mm',
    hidroDiasEstres: 'am_hidrico_dias_estres',
    ensoFase:        'am_enso_fase',
    ensoFactor:      'am_enso_factor',
    campanaId:       'am_campana_id',
    alertasActivas:  'am_alertas_activas',
    hidroCapMax:     'am_hidrico_cap_max_mm',
  };

  // ── UTILIDADES ───────────────────────────────────────
  function ls(key) {
    try { return localStorage.getItem(key) || ''; }
    catch(e) { return ''; }
  }
  function lsJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch(e) { return null; }
  }
  function $(id) { return document.getElementById(id); }

  function fechaDias(isoStr) {
    if (!isoStr) return null;
    var d = new Date(isoStr + 'T12:00:00');
    var hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    return Math.round((hoy - d) / 86400000);
  }

  function diasHasta(isoStr) {
    if (!isoStr) return null;
    var d = new Date(isoStr + 'T12:00:00');
    var hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    return Math.round((d - hoy) / 86400000);
  }

  function cultEmoji(c) {
    var map = { maiz:'🌽', maíz:'🌽', soja:'🟡', trigo:'🌾', girasol:'🌻', sorgo:'🔴', cebada:'🟤', colza:'🌼' };
    return map[(c||'').toLowerCase()] || '🌱';
  }

  function ensoLabel(fase) {
    var f = (fase||'').toLowerCase();
    if (f === 'nino' || f === 'niño') return { txt:'🌊 El Niño', col:'#2A5A8C' };
    if (f === 'nina' || f === 'niña') return { txt:'❄️ La Niña', col:'#7A1A0A' };
    return { txt:'⚖️ Neutro', col:'#3A7A4A' };
  }

  // ── ESTADO DEL BALANCE HÍDRICO ──────────────────────
  function hidroEstado(aguaMm, capMax) {
    var agua = parseFloat(aguaMm) || 0;
    var cap  = parseFloat(capMax) || 180;
    var pct  = cap > 0 ? Math.min(100, Math.round(agua / cap * 100)) : 0;

    if (pct >= 60) return { pct: pct, color: '#2A7A4A', label: 'Óptimo', emoji: '💧' };
    if (pct >= 35) return { pct: pct, color: '#B87A20', label: 'Moderado', emoji: '⚠️' };
    return { pct: pct, color: '#D4522A', label: 'Estrés', emoji: '🔴' };
  }

  // ── RENDER PRINCIPAL ─────────────────────────────────
  function render() {
    var wrap = $('dash-campana-panel');
    if (!wrap) return;

    // Leer datos
    var loteNombre    = ls(LS.loteNombre);
    var cultivo       = ls(LS.cultivo) || ls('s-cultivo-val');
    var fechaSiembra  = ls(LS.fechaSiembra);
    var fenEtapa      = ls(LS.fenEtapaHoy);
    var fenFinEtapa   = ls(LS.fenFechaFinEtapa);
    var fenDurCiclo   = parseInt(ls(LS.fenDurCiclo)) || 0;
    var hidroAgua     = ls(LS.hidroAguaMm);
    var hidroDeficit  = ls(LS.hidroDeficitAcum);
    var hidroEstres   = ls(LS.hidroDiasEstres);
    var ensoFase      = ls(LS.ensoFase);
    var campanaId     = ls(LS.campanaId);
    var capMax        = ls(LS.hidroCapMax);

    // Si no hay ningún dato relevante → panel colapsado
    var hasDatos = loteNombre || cultivo || fechaSiembra || hidroAgua;
    if (!hasDatos) {
      wrap.innerHTML = _renderEmpty();
      return;
    }

    // Dias sembrado
    var diasSembrado = fechaDias(fechaSiembra);

    // Fenología
    var pctCiclo = 0;
    if (fenDurCiclo > 0 && diasSembrado !== null) {
      pctCiclo = Math.min(100, Math.max(0, Math.round(diasSembrado / fenDurCiclo * 100)));
    }
    var diasHastaProx = diasHasta(fenFinEtapa);

    // Hídrico
    var hidro = hidroEstado(hidroAgua, capMax);

    // ENSO
    var enso = ensoLabel(ensoFase);

    // Alertas
    var alertas = lsJSON(LS.alertasActivas) || [];
    var alertasShow = alertas.slice(0, 3);

    // ── HTML ──────────────────────────────────────────
    var html = '<div class="dcp-inner">';

    // — CABECERA DE CAMPAÑA ——————————————————————————
    html += '<div class="dcp-header">';

    html += '<div class="dcp-lote">';
    if (loteNombre) {
      html += '<span class="dcp-lote-ico">📍</span>';
      html += '<span class="dcp-lote-nombre">' + _esc(loteNombre) + '</span>';
      if (campanaId) {
        html += '<span class="dcp-campana-badge">#' + _esc(campanaId.toString().slice(-4)) + '</span>';
      }
    } else {
      html += '<span style="color:rgba(28,18,8,.35);font-size:.82rem">Sin lote activo — configurá en el Dashboard</span>';
    }
    html += '</div>';

    if (cultivo || fechaSiembra) {
      html += '<div class="dcp-meta">';
      if (cultivo) {
        html += '<span class="dcp-chip dcp-chip-green">' + cultEmoji(cultivo) + ' ' + _esc(cultivo) + '</span>';
      }
      if (fechaSiembra) {
        var fmtFecha = _formatFecha(fechaSiembra);
        html += '<span class="dcp-chip dcp-chip-earth">📅 Siembra: ' + fmtFecha + '</span>';
        if (diasSembrado !== null && diasSembrado >= 0) {
          html += '<span class="dcp-chip dcp-chip-muted">Día ' + diasSembrado + ' de campaña</span>';
        }
      }
      if (ensoFase) {
        html += '<span class="dcp-chip" style="background:rgba(42,90,140,.1);color:' + enso.col + ';border-color:rgba(42,90,140,.2)">' + enso.txt + '</span>';
      }
      html += '</div>';
    }
    html += '</div>'; // /dcp-header

    // — GRID DE WIDGETS ——————————————————————————————
    html += '<div class="dcp-grid">';

    // Widget 1: Etapa Fenológica
    html += '<div class="dcp-widget dcp-widget-fen">';
    html += '<div class="dcp-widget-title">🌿 Etapa Fenológica</div>';
    if (fenEtapa) {
      html += '<div class="dcp-fen-etapa">' + _esc(fenEtapa) + '</div>';
      html += '<div class="dcp-progress-wrap">';
      html += '<div class="dcp-progress-bar" style="width:' + pctCiclo + '%;background:linear-gradient(90deg,var(--leaf),var(--sprout))"></div>';
      html += '</div>';
      html += '<div class="dcp-progress-meta"><span>' + pctCiclo + '% del ciclo</span>';
      if (diasHastaProx !== null && diasHastaProx >= 0) {
        html += '<span>📅 Próx. etapa en <strong>' + diasHastaProx + '</strong> días</span>';
      } else if (diasHastaProx !== null && diasHastaProx < 0) {
        html += '<span style="color:var(--warn)">Etapa finalizada</span>';
      }
      html += '</div>';
    } else {
      html += '<div class="dcp-widget-empty">Sin datos fenológicos<br><small>Abrí <strong>Fen. Planificación</strong></small></div>';
    }
    html += '</div>';

    // Widget 2: Balance Hídrico
    html += '<div class="dcp-widget dcp-widget-hidro">';
    html += '<div class="dcp-widget-title">💧 Balance Hídrico</div>';
    if (hidroAgua) {
      var agua = parseFloat(hidroAgua) || 0;
      var cap  = parseFloat(capMax) || 180;
      html += '<div class="dcp-hidro-row">';
      html += '<span class="dcp-hidro-val" style="color:' + hidro.color + '">' + hidro.emoji + ' ' + Math.round(agua) + ' mm</span>';
      html += '<span class="dcp-hidro-lbl">agua en perfil</span>';
      html += '</div>';
      // barra coloreada
      html += '<div class="dcp-progress-wrap">';
      html += '<div class="dcp-progress-bar" style="width:' + hidro.pct + '%;background:' + hidro.color + '"></div>';
      html += '</div>';
      html += '<div class="dcp-progress-meta">';
      html += '<span style="color:' + hidro.color + '">' + hidro.label + ' (' + hidro.pct + '%)</span>';
      if (cap > 0) html += '<span>Cap. máx: ' + Math.round(cap) + ' mm</span>';
      html += '</div>';
      if (hidroDeficit && parseFloat(hidroDeficit) > 0) {
        html += '<div class="dcp-hidro-deficit">⚠️ Déficit acum.: <strong>' + Math.round(parseFloat(hidroDeficit)) + ' mm</strong></div>';
      }
      if (hidroEstres && parseInt(hidroEstres) > 0) {
        html += '<div class="dcp-hidro-deficit" style="color:var(--warn)">🔴 Días en estrés: <strong>' + parseInt(hidroEstres) + '</strong></div>';
      }
    } else {
      html += '<div class="dcp-widget-empty">Sin datos hídricos<br><small>Abrí <strong>Balance Hídrico</strong></small></div>';
    }
    html += '</div>';

    // Widget 3: Alertas
    html += '<div class="dcp-widget dcp-widget-alertas">';
    html += '<div class="dcp-widget-title">🚨 Alertas activas';
    if (alertas.length > 0) {
      html += ' <span class="dcp-alerta-badge">' + alertas.length + '</span>';
    }
    html += '</div>';
    if (alertasShow.length === 0) {
      html += '<div class="dcp-widget-empty" style="color:var(--ok)">✅ Sin alertas activas</div>';
    } else {
      html += '<div class="dcp-alertas-list">';
      alertasShow.forEach(function(a) {
        var sv = a.severidad || 'info';
        var col = sv === 'critica' ? '#D4522A' : sv === 'advertencia' ? '#B87A20' : '#2A5A8C';
        var bg  = sv === 'critica' ? 'rgba(212,82,42,.08)' : sv === 'advertencia' ? 'rgba(184,122,32,.08)' : 'rgba(42,90,140,.08)';
        html += '<div class="dcp-alerta-item" style="border-left-color:' + col + ';background:' + bg + '">';
        html += '<div class="dcp-alerta-txt">' + _esc((a.mensaje || a.msg || '').slice(0, 80)) + '</div>';
        html += '</div>';
      });
      if (alertas.length > 3) {
        html += '<button class="dcp-ver-todas-btn" onclick="if(typeof switchMod===\'function\')switchMod(\'fen-seg\')">+ ' + (alertas.length - 3) + ' más → ver todas</button>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; // /dcp-grid

    html += '</div>'; // /dcp-inner
    wrap.innerHTML = html;
    wrap.classList.remove('hidden');
  }

  function _renderEmpty() {
    return '<div class="dcp-empty-state">' +
      '<span style="font-size:2rem">🌱</span>' +
      '<div>Configurá tu lote en el Dashboard para ver el resumen de campaña</div>' +
      '</div>';
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _formatFecha(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
    return iso;
  }

  // ── INICIALIZACIÓN ───────────────────────────────────
  function init() {
    // Crear contenedor si no existe (se inserta en el HTML)
    var el = $('dash-campana-panel');
    if (!el) return; // el HTML ya lo define

    render();

    // Auto-refresh cada 30 s (guardar ID para poder cancelarlo si init() se llama de nuevo)
    if (window._dashCampanaInterval) clearInterval(window._dashCampanaInterval);
    window._dashCampanaInterval = setInterval(render, 30000);

    // Reaccionar a cambios de localStorage desde otras pestañas
    window.addEventListener('storage', function(e) {
      var watched = Object.values(LS);
      if (watched.indexOf(e.key) !== -1) render();
    });

    // Reaccionar cuando se vuelve al Dashboard (visibilitychange + switchMod hook)
    document.addEventListener('am:dashboard-activado', render);

    // Fallback: también monitorear el evento de cambio de inputs clave
    ['s-coord','s-cultivo','s-fecha'].forEach(function(id) {
      var el2 = document.getElementById(id);
      if (el2) el2.addEventListener('change', function() {
        setTimeout(render, 300);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // API pública
  window.dashCampanaRefresh = render;

})();
