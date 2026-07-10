// AGROMOTOR - Guardrails universales para liquidos en surco
(function() {
  window.AM = window.AM || {};

  var SOURCE_SURCO = 'Especificacion tecnica privada - Fertilizacion liquida en surco (Drive: 1in244CzHUKhC-S07SFHi8ayRxUXs6Pyv)';
  var SOURCE_COMPAT = 'Especificacion tecnica privada - Uso y compatibilidad de productos liquidos (Drive: 1W1h6hitQ-ikbrMZ6LQi74qrUXNOq0hEf)';

  var MASSIVE_PRODUCTS = /(urea|map|dap|fosfato|nitrogen|uan|solmix|kcl|cloruro|sumag|base|reposicion|reposici[oó]n)/i;
  var STARTER_PRODUCTS = /(starter|arranque|iniciador|in.?furrow|surco|linea de siembra|l[ií]nea de siembra)/i;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(v) {
    if (v == null || v === '') return 0;
    var n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function push(out, level, code, title, reason, source, data) {
    out.push({
      level: level,
      code: code,
      title: title,
      reason: reason,
      source: source,
      data: data || {}
    });
  }

  function maxLevel(items) {
    if (items.some(function(x) { return x.level === 'bloqueo'; })) return 'bloqueo';
    if (items.some(function(x) { return x.level === 'advertencia'; })) return 'advertencia';
    if (items.some(function(x) { return x.level === 'info'; })) return 'info';
    return 'ok';
  }

  function inferUse(product) {
    var name = String(product && (product.nombre || product.producto || product.name) || '');
    var flags = product && product.surco ? product.surco : {};
    if (flags.starter === true || STARTER_PRODUCTS.test(name)) return 'starter';
    if (flags.masiva === true || MASSIVE_PRODUCTS.test(name)) return 'masiva';
    return 'no_verificado';
  }

  function evaluateProduct(product, opts) {
    opts = opts || {};
    product = product || {};
    var out = [];
    var name = product.nombre || product.producto || product.name || 'Producto';
    var flags = product.surco || {};
    var placement = opts.placement || flags.placement || 'surco_siembra';
    var dose = num(product.kgFert || product.kgHa || product.dosis || product.dosisHa || product.dosisRec);
    var use = flags.uso || inferUse(product);

    if (placement !== 'surco_siembra') {
      return { level: 'ok', use: use, alerts: out };
    }

    if (flags.solid === true || flags.suspendido === true || /wp|wg|sg|pm/i.test(product.formulacion || '')) {
      push(out, 'bloqueo', 'SURCO_SOLIDOS', 'No usar en dosificacion liquida en surco',
        name + ' presenta solidos, particulas o formulacion no completamente liquida; el criterio de compatibilidad exige soluciones liquidas homogeneas y libres de particulas.',
        SOURCE_COMPAT, { producto: name, formulacion: product.formulacion || '' });
    }
    if (flags.precipita === true || flags.sedimenta === true || flags.decanta === true) {
      push(out, 'bloqueo', 'SURCO_PRECIPITADO', 'Riesgo de precipitado o decantacion',
        name + ' queda bloqueado porque puede generar sedimentos/precipitados y alterar filtros, conductos, caudalimetros o uniformidad de distribucion.',
        SOURCE_COMPAT, { producto: name });
    }
    if (flags.agitacionPermanente === true) {
      push(out, 'bloqueo', 'SURCO_AGITACION', 'Requiere agitacion permanente',
        name + ' requiere agitacion para sostener homogeneidad; esa condicion no es compatible con una dosificacion precisa y estable en surco.',
        SOURCE_COMPAT, { producto: name });
    }
    if (flags.viscosidadAlta === true) {
      push(out, 'advertencia', 'SURCO_VISCOSIDAD', 'Viscosidad fuera de diseno',
        name + ' declara viscosidad elevada respecto del diseno del sistema; puede afectar dosificacion y uniformidad.',
        SOURCE_COMPAT, { producto: name });
    }

    if (use === 'masiva') {
      push(out, 'advertencia', 'SURCO_NUTRICION_MASIVA', 'Nutricion masiva no es starter',
        name + ' se interpreta como fertilizacion de base/reposicion. La aplicacion en surco se considera herramienta starter y no reemplaza programas para cubrir requerimientos masivos.',
        SOURCE_SURCO, { producto: name, dosis: dose });
    }
    if (use === 'no_verificado') {
      push(out, 'advertencia', 'SURCO_USO_NO_VERIFICADO', 'Uso starter no verificado',
        name + ' no tiene marca de formulacion starter ni recomendacion explicita para aplicacion localizada en linea de siembra.',
        SOURCE_SURCO, { producto: name });
    }
    if (flags.altaSalinidad === true || flags.altaCE === true || flags.indiceSalinoAlto === true || flags.altoN === true || flags.altoP === true) {
      push(out, 'advertencia', 'SURCO_FITOTOX_SEMILLA', 'Riesgo de fitotoxicidad cerca de la semilla',
        name + ' combina proximidad a semilla con alta carga salina/concentracion nutricional; esto eleva el riesgo de fitotoxicidad, menor emergencia y perdida de stand.',
        SOURCE_SURCO, { producto: name, dosis: dose });
    }
    if (dose > 0 && (dose > (flags.maxStarterKgHa || 35) || flags.dosisSuperiorStarter === true)) {
      push(out, 'advertencia', 'SURCO_DOSIS_STARTER', 'Dosis fuera de rango starter',
        name + ' figura con ' + dose + ' kg/ha; la especificacion exige dosis de starter y advierte sobre dosis superiores a las habituales cerca de la semilla.',
        SOURCE_SURCO, { producto: name, dosis: dose });
    }

    return { level: maxLevel(out), use: use, alerts: out };
  }

  function evaluateMixture(products, opts) {
    opts = opts || {};
    var alerts = [];
    (products || []).forEach(function(p) {
      var ev = evaluateProduct(p, opts);
      alerts = alerts.concat(ev.alerts);
    });
    if ((products || []).length > 1 && opts.placement === 'surco_siembra') {
      var hasUnverified = (products || []).some(function(p) {
        var f = p && p.surco;
        return f && f.mezclaValidada === false;
      });
      if (hasUnverified) {
        push(alerts, 'bloqueo', 'SURCO_MEZCLA_NO_VALIDADA', 'Mezcla no validada para aplicacion en surco',
          'La compatibilidad individual no garantiza compatibilidad de la mezcla; se bloquea porque al menos un componente no declara validacion de tanque para el equipo.',
          SOURCE_COMPAT, { cantidad: products.length });
      }
    }
    return { level: maxLevel(alerts), alerts: alerts };
  }

  function evaluateNutritionPlan(plan, opts) {
    opts = opts || {};
    var resultados = plan && plan.resultados ? plan.resultados : plan || {};
    var products = [];
    Object.keys(resultados || {}).forEach(function(k) {
      var r = resultados[k];
      if (!r || typeof r !== 'object' || !r.fertNombre) return;
      products.push({
        nombre: r.fertNombre,
        kgFert: r.kgFert,
        dosisRec: r.dosisRec,
        surco: {
          uso: 'masiva',
          altoN: k === 'N',
          altoP: k === 'P',
          altaSalinidad: /urea|kcl|cloruro/i.test(r.fertNombre || ''),
          dosisSuperiorStarter: Number(r.kgFert || 0) > 35
        }
      });
    });
    return evaluateMixture(products, Object.assign({ placement: 'surco_siembra' }, opts));
  }

  function renderAlerts(alerts, options) {
    options = options || {};
    var cls = options.compact ? ' style="margin-top:.55rem"' : '';
    return (alerts || []).map(function(a) {
      var type = a.level === 'bloqueo' ? 'danger' : a.level === 'advertencia' ? 'warn' : 'info';
      var ico = a.level === 'bloqueo' ? '🚫' : a.level === 'advertencia' ? '⚠️' : 'ℹ️';
      return '<div class="alert ' + type + '"' + cls + '><span class="ai">' + ico + '</span><div class="ac"><strong>' +
        esc(a.title) + ':</strong> ' + esc(a.reason) +
        '<div style="font-size:.66rem;color:rgba(74,46,26,.52);margin-top:.25rem">Trazabilidad: ' + esc(a.source) + ' · Regla ' + esc(a.code) + '</div></div></div>';
    }).join('');
  }

  window.AM.surcoGuardrails = {
    sources: { surco: SOURCE_SURCO, compatibilidad: SOURCE_COMPAT },
    evaluateProduct: evaluateProduct,
    evaluateMixture: evaluateMixture,
    evaluateNutritionPlan: evaluateNutritionPlan,
    renderAlerts: renderAlerts,
    _inferUse: inferUse
  };
})();
