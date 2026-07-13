// AgroMotor - control liviano de salud de fuentes externas
(function() {
  'use strict';

  var CACHE_KEY = 'am_fuentes_health_v1';
  var TTL_MS = 30 * 60 * 1000;

  function coords() {
    var lote = typeof window.amGetLoteActivo === 'function' ? window.amGetLoteActivo() : null;
    var raw = lote && lote.data && lote.data.coord ? lote.data.coord : '-31.4699,-58.1770';
    var p = String(raw).replace(/\s/g, '').split(',');
    return { lat: parseFloat(p[0]) || -31.4699, lon: parseFloat(p[1]) || -58.1770 };
  }

  function withTimeout(url, ms, options) {
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, ms || 12000);
    return fetch(url, Object.assign({ signal: ctrl.signal, cache: 'no-store' }, options || {}))
      .then(function(res) {
        clearTimeout(timer);
        return { ok: res.ok, status: res.status };
      })
      .catch(function(e) {
        clearTimeout(timer);
        return { ok: false, status: 0, error: e.message };
      });
  }

  function fuentes() {
    var c = coords();
    return [
      {
        id: 'openmeteo',
        nombre: 'Open-Meteo clima/suelo',
        critica: true,
        url: 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat.toFixed(4) + '&longitude=' + c.lon.toFixed(4) + '&current=temperature_2m,soil_moisture_3_to_9cm&forecast_days=1&timezone=auto'
      },
      {
        id: 'nasa',
        nombre: 'NASA POWER historico',
        critica: true,
        url: 'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,PRECTOTCORR,EVPTRNS&community=AG&longitude=' + c.lon.toFixed(4) + '&latitude=' + c.lat.toFixed(4) + '&format=JSON'
      },
      {
        id: 'soilgrids',
        nombre: 'SoilGrids ISRIC',
        critica: true,
        url: 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + c.lon.toFixed(4) + '&lat=' + c.lat.toFixed(4) + '&property=phh2o&property=clay&property=sand&depth=0-5cm&value=mean'
      },
      {
        id: 'olm',
        nombre: 'OpenLandMap P/K/Zn',
        critica: false,
        fallback: 'DB regional / IDECOR si corresponde',
        url: 'https://api.openlandmap.org/query/point?lat=' + c.lat.toFixed(4) + '&lon=' + c.lon.toFixed(4) + '&coll=predicted250m&regex=sol_(phosphorus.extractable|potassium.exchangeable|zinc.extractable)&format=json'
      },
      {
        id: 'enso',
        nombre: 'NOAA/CPC ENSO',
        critica: true,
        url: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/'
      }
    ];
  }

  function leerCache() {
    try {
      var obj = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!obj || !Array.isArray(obj.rows)) return null;
      if (Date.now() - obj.ts > TTL_MS) return null;
      return obj;
    } catch(_) { return null; }
  }

  function guardar(rows) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows: rows })); } catch(_) {}
  }

  function estadoTexto(r) {
    if (r.ok) return 'OK';
    return r.critica ? 'Revisar' : 'Fallback';
  }

  function render(rows) {
    var el = document.getElementById('am-fuentes-health');
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '';
      return;
    }
    var html = '<div class="card" style="margin-top:1rem;border:1px solid rgba(42,90,140,.18)">'
      + '<div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:.65rem">'
      + '<div style="font-size:.78rem;font-weight:800;color:#2A5A8C">Salud de fuentes de datos</div>'
      + '<button type="button" class="btn" style="padding:.35rem .65rem;font-size:.72rem" onclick="window.amFuentesHealthCheck(true)">Actualizar</button>'
      + '</div>';
    rows.forEach(function(r) {
      var col = r.ok ? '#2A7A4A' : r.critica ? '#C94A2A' : '#B87A20';
      html += '<div style="display:flex;justify-content:space-between;gap:.7rem;border-top:1px solid rgba(74,46,26,.08);padding:.42rem 0;font-size:.75rem">'
        + '<span>' + r.nombre + (r.fallback && !r.ok ? ' · ' + r.fallback : '') + '</span>'
        + '<strong style="color:' + col + '">' + estadoTexto(r) + (r.status ? ' ' + r.status : '') + '</strong>'
        + '</div>';
    });
    html += '<div style="font-size:.64rem;color:rgba(74,46,26,.48);line-height:1.35;margin-top:.45rem">Control no bloqueante: si una fuente falla, AgroMotor usa cascadas y conserva trazabilidad.</div></div>';
    el.innerHTML = html;
  }

  async function check(force) {
    var cached = !force && leerCache();
    if (cached) {
      render(cached.rows);
      return cached.rows;
    }
    var rows = await Promise.all(fuentes().map(function(f) {
      return withTimeout(f.url, 12000).then(function(r) {
        return Object.assign({}, f, r);
      });
    }));
    guardar(rows);
    render(rows);
    return rows;
  }

  window.amFuentesHealthCheck = check;
  window.amFuentesHealthRender = render;
})();
