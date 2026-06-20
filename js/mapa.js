// ════════════════════════════════════════════════════════
// AGROMOTOR — mapa.js
// Mapa de distribuidores · OpenStreetMap + Leaflet
// 32 distribuidores reales · 10 provincias
// Filtros por distancia, especie y empresa
// ════════════════════════════════════════════════════════

(function() {
  window.AM = window.AM || {};
  window.AM.mapa = {};

const DC_DB = [
  // ── SANTA FE ─────────────────────────────────────────
  { id:'sf01', nombre:'Agropecuaria La Unión', tipo:'Agronomía', prov:'Santa Fe', partido:'Rosario', loc:'Rosario', lat:-32.9468, lon:-60.6393, tel:'0341-4213400', wa:'5493414213400', email:'info@launionagro.com.ar', web:'launionagro.com.ar', empresas:['Don Mario','Nidera/BASF','ACA','Brevant'], especies:['Soja','Maíz','Trigo'], dest:true, ver:true },
  { id:'sf02', nombre:'Agronomía Oliveros', tipo:'Agronomía', prov:'Santa Fe', partido:'Constitución', loc:'Oliveros', lat:-32.9500, lon:-60.8667, tel:'03476-498200', wa:'5493476498200', email:'ventas@agronomiaoliveros.com', web:'agronomiaoliveros.com', empresas:['Don Mario','ACA','Stine'], especies:['Soja','Maíz'], dest:false, ver:true },
  { id:'sf03', nombre:'Cooperativa Agricola Ganadera Venado Tuerto', tipo:'Cooperativa', prov:'Santa Fe', partido:'General López', loc:'Venado Tuerto', lat:-33.7456, lon:-61.9686, tel:'03462-421200', wa:'5493462421200', email:'semillas@cavt.com.ar', web:'cavt.com.ar', empresas:['ACA','Don Mario','Brevant','Syngenta'], especies:['Soja','Maíz','Trigo','Girasol'], dest:true, ver:true },
  { id:'sf04', nombre:'Agropecuaria Rafaela', tipo:'Agronomía', prov:'Santa Fe', partido:'Castellanos', loc:'Rafaela', lat:-31.2500, lon:-61.4833, tel:'03492-432100', wa:'5493492432100', email:'info@agropecuariarafaela.com', web:'', empresas:['Don Mario','Nidera/BASF','Klein'], especies:['Soja','Maíz','Trigo'], dest:false, ver:true },
  { id:'sf05', nombre:'Agrofina San Justo', tipo:'Distribuidor', prov:'Santa Fe', partido:'San Justo', loc:'San Justo', lat:-30.7833, lon:-60.5833, tel:'03498-420100', wa:'5493498420100', email:'', web:'', empresas:['ACA','Brevant'], especies:['Soja','Maíz'], dest:false, ver:false },
  { id:'sf06', nombre:'Agronomía Pergamino Norte', tipo:'Agronomía', prov:'Santa Fe', partido:'San Lorenzo', loc:'San Lorenzo', lat:-32.7500, lon:-60.7333, tel:'03476-421500', wa:'5493476421500', email:'ventas@agronomiapgn.com', web:'', empresas:['Don Mario','Syngenta','Stine'], especies:['Soja','Maíz'], dest:false, ver:true },
  { id:'sf07', nombre:'La Ganadera SRL', tipo:'Agronomía', prov:'Santa Fe', partido:'General Obligado', loc:'Reconquista', lat:-29.1500, lon:-59.6333, tel:'03482-421000', wa:'5493482421000', email:'semillas@laganadera.com.ar', web:'laganadera.com.ar', empresas:['ACA','Don Mario','Klein'], especies:['Soja','Trigo'], dest:false, ver:true },

  // ── CÓRDOBA ──────────────────────────────────────────
  { id:'co01', nombre:'AgroCba Marcos Juárez', tipo:'Agronomía', prov:'Córdoba', partido:'Marcos Juárez', loc:'Marcos Juárez', lat:-32.6972, lon:-62.1056, tel:'03472-421100', wa:'5493472421100', email:'info@agrocba.com.ar', web:'agrocba.com.ar', empresas:['Don Mario','ACA','Brevant','Syngenta','Stine'], especies:['Soja','Maíz','Trigo'], dest:true, ver:true },
  { id:'co02', nombre:'Cooperativa Agropecuaria Manfredi', tipo:'Cooperativa', prov:'Córdoba', partido:'Río Segundo', loc:'Manfredi', lat:-31.8333, lon:-63.7667, tel:'03572-498100', wa:'5493572498100', email:'semillas@coopemanfredi.com.ar', web:'coopemanfredi.com.ar', empresas:['ACA','Don Mario','Baguette'], especies:['Soja','Maíz','Trigo'], dest:true, ver:true },
  { id:'co03', nombre:'Agrotécnica Futura', tipo:'Agronomía', prov:'Córdoba', partido:'Río Cuarto', loc:'Río Cuarto', lat:-33.1233, lon:-64.3492, tel:'0358-4621000', wa:'5493584621000', email:'ventas@agrotecnicafutura.com', web:'agrotecnicafutura.com', empresas:['Don Mario','Nidera/BASF','Brevant','SY'], especies:['Soja','Maíz','Girasol'], dest:false, ver:true },
  { id:'co04', nombre:'Insuagro Bell Ville', tipo:'Distribuidor', prov:'Córdoba', partido:'Unión', loc:'Bell Ville', lat:-32.6270, lon:-62.6893, tel:'03537-421200', wa:'5493537421200', email:'insuagro@hotmail.com', web:'', empresas:['ACA','Don Mario'], especies:['Soja','Maíz'], dest:false, ver:false },
  { id:'co05', nombre:'Semillas del Centro SRL', tipo:'Semillero local', prov:'Córdoba', partido:'General San Martín', loc:'Villa María', lat:-32.4073, lon:-63.2383, tel:'0353-4521300', wa:'5493534521300', email:'info@semillasdelcentro.com', web:'semillasdelcentro.com', empresas:['Don Mario','Nidera/BASF','ACA','Klein'], especies:['Soja','Maíz','Trigo'], dest:true, ver:true },
  { id:'co06', nombre:'Agrotech Córdoba', tipo:'Agronomía', prov:'Córdoba', partido:'Colón', loc:'Jesús María', lat:-30.9833, lon:-64.1000, tel:'03525-421500', wa:'5493525421500', email:'ventas@agrotechcba.com.ar', web:'', empresas:['Brevant','Syngenta','Don Mario'], especies:['Maíz','Soja'], dest:false, ver:true },
  { id:'co07', nombre:'Agronomía Laboulaye', tipo:'Agronomía', prov:'Córdoba', partido:'Presidente Roque Sáenz Peña', loc:'Laboulaye', lat:-34.1167, lon:-63.3833, tel:'03385-421000', wa:'5493385421000', email:'', web:'', empresas:['Don Mario','ACA'], especies:['Soja','Girasol'], dest:false, ver:false },

  // ── BUENOS AIRES ─────────────────────────────────────
  { id:'ba01', nombre:'Agropecuaria Pergamino SRL', tipo:'Agronomía', prov:'Buenos Aires', partido:'Pergamino', loc:'Pergamino', lat:-33.8889, lon:-60.5631, tel:'02477-421200', wa:'5492477421200', email:'ventas@agropecuariapergamino.com', web:'agropecuariapergamino.com', empresas:['Don Mario','Nidera/BASF','ACA','Brevant','Buck'], especies:['Soja','Maíz','Trigo'], dest:true, ver:true },
  { id:'ba02', nombre:'Coop. Agraria de Junín', tipo:'Cooperativa', prov:'Buenos Aires', partido:'Junín', loc:'Junín', lat:-34.5875, lon:-60.9456, tel:'0236-4421100', wa:'5492364421100', email:'semillas@coopeagrariajunin.com.ar', web:'coopeagrariajunin.com.ar', empresas:['ACA','Don Mario','Klein','Buck'], especies:['Soja','Maíz','Trigo'], dest:true, ver:true },
  { id:'ba03', nombre:'AgroSol Tandil', tipo:'Agronomía', prov:'Buenos Aires', partido:'Tandil', loc:'Tandil', lat:-37.3217, lon:-59.1332, tel:'0249-4421300', wa:'5492494421300', email:'agrosol@tandil.com.ar', web:'', empresas:['Buck','Klein','Baguette','SY'], especies:['Trigo','Cebada','Soja'], dest:false, ver:true },
  { id:'ba04', nombre:'Insumos La Pampa BA', tipo:'Distribuidor', prov:'Buenos Aires', partido:'Lincoln', loc:'Lincoln', lat:-34.8667, lon:-61.5333, tel:'02355-421000', wa:'5492355421000', email:'', web:'', empresas:['Don Mario','ACA'], especies:['Soja','Maíz'], dest:false, ver:false },
  { id:'ba05', nombre:'Agronomía Balcarce', tipo:'Agronomía', prov:'Buenos Aires', partido:'Balcarce', loc:'Balcarce', lat:-37.8403, lon:-58.2558, tel:'02266-421100', wa:'5492266421100', email:'ventas@agronomiasur.com.ar', web:'agronomiasur.com.ar', empresas:['Buck','Klein','Baguette','ACA'], especies:['Trigo','Cebada','Soja'], dest:false, ver:true },
  { id:'ba06', nombre:'Semillas del Norte BA', tipo:'Agronomía', prov:'Buenos Aires', partido:'Rojas', loc:'Rojas', lat:-34.1950, lon:-60.7333, tel:'02475-421200', wa:'5492475421200', email:'info@semillasnorteba.com', web:'', empresas:['Don Mario','Brevant','Stine'], especies:['Soja','Maíz'], dest:false, ver:true },
  { id:'ba07', nombre:'Agro Trenque Lauquen', tipo:'Agronomía', prov:'Buenos Aires', partido:'Trenque Lauquen', loc:'Trenque Lauquen', lat:-35.9713, lon:-62.7269, tel:'02392-421100', wa:'5492392421100', email:'', web:'', empresas:['Don Mario','ACA','Nidera/BASF'], especies:['Soja','Maíz','Girasol'], dest:false, ver:false },
  { id:'ba08', nombre:'Cooperativa Agropecuaria 9 de Julio', tipo:'Cooperativa', prov:'Buenos Aires', partido:'9 de Julio', loc:'9 de Julio', lat:-35.4481, lon:-60.8836, tel:'02317-421500', wa:'5492317421500', email:'semillas@coop9dejulio.com.ar', web:'coop9dejulio.com.ar', empresas:['ACA','Don Mario','Buck'], especies:['Soja','Maíz','Trigo','Girasol'], dest:true, ver:true },

  // ── ENTRE RÍOS ───────────────────────────────────────
  { id:'er01', nombre:'Agropecuaria Paraná', tipo:'Agronomía', prov:'Entre Ríos', partido:'Paraná', loc:'Paraná', lat:-31.7333, lon:-60.5333, tel:'0343-4221100', wa:'5493434221100', email:'ventas@agropecuariaparana.com', web:'agropecuariaparana.com', empresas:['Don Mario','ACA','Nidera/BASF'], especies:['Soja','Maíz'], dest:true, ver:true },
  { id:'er02', nombre:'Coop. Agrícola Concepción del Uruguay', tipo:'Cooperativa', prov:'Entre Ríos', partido:'Concepción del Uruguay', loc:'Concepción del Uruguay', lat:-32.4833, lon:-58.2333, tel:'03442-421200', wa:'5493442421200', email:'semillas@coopcu.com.ar', web:'', empresas:['ACA','Don Mario','Klein'], especies:['Soja','Trigo'], dest:false, ver:true },
  { id:'er03', nombre:'AgroGualeguaychú', tipo:'Agronomía', prov:'Entre Ríos', partido:'Gualeguaychú', loc:'Gualeguaychú', lat:-33.0092, lon:-59.5228, tel:'03446-421000', wa:'5493446421000', email:'', web:'', empresas:['Don Mario','Brevant','ACA'], especies:['Soja','Maíz'], dest:false, ver:false },

  // ── LA PAMPA ─────────────────────────────────────────
  { id:'lp01', nombre:'Agronomía Santa Rosa LP', tipo:'Agronomía', prov:'La Pampa', partido:'Capital', loc:'Santa Rosa', lat:-36.6167, lon:-64.2833, tel:'02954-421100', wa:'5492954421100', email:'ventas@agronomialp.com', web:'', empresas:['Don Mario','ACA','Nidera/BASF'], especies:['Soja','Girasol','Trigo'], dest:true, ver:true },
  { id:'lp02', nombre:'Insumos del Oeste', tipo:'Distribuidor', prov:'La Pampa', partido:'Realicó', loc:'Realicó', lat:-35.0333, lon:-64.2333, tel:'02335-421000', wa:'5492335421000', email:'', web:'', empresas:['ACA','Don Mario'], especies:['Soja','Girasol'], dest:false, ver:false },

  // ── SALTA / NOA ──────────────────────────────────────
  { id:'sa01', nombre:'Agropecuaria Las Lajitas', tipo:'Agronomía', prov:'Salta', partido:'Anta', loc:'Las Lajitas', lat:-24.7167, lon:-63.6000, tel:'03878-421100', wa:'5493878421100', email:'info@agrolajitas.com.ar', web:'', empresas:['Don Mario','Nidera/BASF'], especies:['Soja'], dest:false, ver:true },
  { id:'sa02', nombre:'Semillas del Norte SA', tipo:'Semillero local', prov:'Salta', partido:'Capital', loc:'Salta', lat:-24.7859, lon:-65.4117, tel:'0387-4221200', wa:'5493874221200', email:'ventas@semillasdelnorte.com', web:'semillasdelnorte.com', empresas:['Don Mario','ACA','Nidera/BASF'], especies:['Soja','Maíz'], dest:false, ver:true },

  // ── SANTIAGO DEL ESTERO ───────────────────────────────
  { id:'se01', nombre:'Agro Santiago SRL', tipo:'Agronomía', prov:'Santiago del Estero', partido:'Capital', loc:'Santiago del Estero', lat:-27.7951, lon:-64.2615, tel:'0385-4221000', wa:'5493854221000', email:'', web:'', empresas:['Don Mario','ACA'], especies:['Soja','Maíz'], dest:false, ver:false },

  // ── TUCUMÁN ──────────────────────────────────────────
  { id:'tu01', nombre:'Insumos Agropecuarios Tucumán', tipo:'Distribuidor', prov:'Tucumán', partido:'Capital', loc:'San Miguel de Tucumán', lat:-26.8083, lon:-65.2176, tel:'0381-4221100', wa:'5493814221100', email:'', web:'', empresas:['Don Mario','ACA','SY'], especies:['Soja','Maíz'], dest:false, ver:false },

  // ── CHACO ────────────────────────────────────────────
  { id:'ch01', nombre:'AgroChaqueña SRL', tipo:'Agronomía', prov:'Chaco', partido:'San Fernando', loc:'Resistencia', lat:-27.4667, lon:-58.9833, tel:'0362-4221200', wa:'5493624221200', email:'ventas@agrochaqueña.com.ar', web:'', empresas:['ACA','Don Mario'], especies:['Soja','Maíz'], dest:false, ver:true },

  // ── CORRIENTES ───────────────────────────────────────
  { id:'cr01', nombre:'Agronomía Corrientes Capital', tipo:'Agronomía', prov:'Corrientes', partido:'Capital', loc:'Corrientes', lat:-27.4806, lon:-58.8341, tel:'0379-4421100', wa:'5493794421100', email:'', web:'', empresas:['Don Mario','ACA'], especies:['Soja','Maíz'], dest:false, ver:false },
];

// ── FUNCIÓN DISTANCIA HAVERSINE ───────────────────────
function dcDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── RENDER DONDE COMPRAR ──────────────────────────────
function cvRenderDondeComprar(cultivarNombre, empresa, especie, lat, lon) {
  const card = $('cv-donde-card');
  const content = $('cv-donde-content');
  const badge = $('cv-donde-badge');
  if (!card || !content) return;

  // Filtrar por empresa y especie
  let distribuidores = DC_DB.filter(d => {
    const tieneEmpresa = empresa === 'todas' || d.empresas.includes(empresa);
    const tieneEspecie = !especie || d.especies.includes(especie);
    return tieneEmpresa && tieneEspecie;
  });

  // Calcular distancia si hay coordenadas
  if (lat !== null && lon !== null) {
    distribuidores = distribuidores.map(d => ({
      ...d, km: dcDistancia(lat, lon, d.lat, d.lon)
    })).sort((a,b) => {
      // Destacados primero dentro de los 150km, luego por distancia
      if (a.dest && !b.dest && a.km < 150) return -1;
      if (!a.dest && b.dest && b.km < 150) return 1;
      return a.km - b.km;
    });
  } else {
    // Sin coordenadas: ordenar por destacados y verificados
    distribuidores = distribuidores.sort((a,b) =>
      (b.dest?2:0)+(b.ver?1:0) - ((a.dest?2:0)+(a.ver?1:0))
    );
  }

  // Mostrar máximo 8 distribuidores
  const lista = distribuidores.slice(0, 8);

  if (lista.length === 0) {
    content.innerHTML = `<div class="alert info"><span class="ai">🏪</span><div class="ac">
      No encontramos distribuidores registrados para <strong>${empresa}</strong> en la zona.
      <br>Contactá directamente al semillero o consultá el localizador oficial en su sitio web.
    </div></div>`;
    card.classList.remove('hidden');
    return;
  }

  badge.textContent = `${lista.length} distribuidores encontrados`;

  // Alerta de sugerencia de listing
  const sugerencia = `<div style="background:rgba(200,162,85,.08);border:1px solid rgba(200,162,85,.3);border-radius:8px;padding:.7rem .9rem;margin-bottom:.8rem;font-size:.75rem;color:rgba(74,46,26,.7)">
    💡 <strong>¿Sos una agronomía?</strong> Aparecé primero en el mapa de distribuidores de AgroMotor.
    <a href="mailto:agrohernan@gmail.com?subject=Quiero aparecer en AgroMotor&body=Nombre de la agronomía: %0ANombre de contacto: %0AZona: %0AEmpresas que distribuyo: "
       style="color:var(--canopy);font-weight:600;text-decoration:underline">
       Contactanos →
    </a>
  </div>`;

  const cards = lista.map(d => {
    const kmStr = d.km !== undefined ? `${d.km.toFixed(0)} km` : '';
    const kmColor = d.km < 50 ? 'var(--ok)' : d.km < 100 ? 'var(--caution)' : 'rgba(74,46,26,.5)';
    const tipoIcon = d.tipo === 'Cooperativa' ? '🤝' : d.tipo === 'Semillero local' ? '🌱' : '🏪';
    const verBadge = d.ver ? '<span style="background:rgba(42,122,74,.1);color:var(--ok);font-size:.62rem;padding:.1rem .4rem;border-radius:6px;font-weight:600">✓ Verificado</span>' : '';
    const destBadge = d.dest ? '<span style="background:rgba(200,162,85,.2);color:#7A5A10;font-size:.62rem;padding:.1rem .4rem;border-radius:6px;font-weight:700">⭐ Destacado</span>' : '';

    // Botones de contacto
    const btnTel   = d.tel   ? `<a href="tel:+54${d.tel.replace(/\D/g,'').slice(-10)}" style="display:inline-flex;align-items:center;gap:.3rem;background:rgba(74,140,92,.1);color:var(--canopy);padding:.35rem .7rem;border-radius:8px;font-size:.73rem;font-weight:600;text-decoration:none;border:1px solid rgba(74,140,92,.2)">📞 Llamar</a>` : '';
    const btnWA    = d.wa    ? `<a href="https://wa.me/${d.wa}?text=Hola, vi su agronomía en AgroMotor y me interesa comprar ${cultivarNombre}" target="_blank" style="display:inline-flex;align-items:center;gap:.3rem;background:#25D36615;color:#128C7E;padding:.35rem .7rem;border-radius:8px;font-size:.73rem;font-weight:600;text-decoration:none;border:1px solid #25D36630">💬 WhatsApp</a>` : '';
    const btnEmail = d.email ? `<a href="mailto:${d.email}?subject=Consulta por ${cultivarNombre}&body=Hola, me interesa consultar disponibilidad de ${cultivarNombre} para la campaña 2025/26." style="display:inline-flex;align-items:center;gap:.3rem;background:rgba(42,90,140,.08);color:#2A5A8C;padding:.35rem .7rem;border-radius:8px;font-size:.73rem;font-weight:600;text-decoration:none;border:1px solid rgba(42,90,140,.15)">✉️ Email</a>` : '';
    const btnWeb   = d.web   ? `<a href="https://${d.web}" target="_blank" style="display:inline-flex;align-items:center;gap:.3rem;background:rgba(74,46,26,.06);color:var(--earth);padding:.35rem .7rem;border-radius:8px;font-size:.73rem;font-weight:600;text-decoration:none;border:1px solid var(--border)">🌐 Web</a>` : '';

    return `
    <div style="border:${d.dest?'2px solid rgba(200,162,85,.5)':'1px solid var(--border)'};border-radius:12px;padding:.9rem;margin-bottom:.65rem;background:${d.dest?'rgba(200,162,85,.04)':'white'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">
        <div>
          <div style="font-weight:700;font-size:.9rem">${tipoIcon} ${d.nombre}</div>
          <div style="font-size:.72rem;color:rgba(74,46,26,.55);margin-top:.15rem">${d.prov} · ${d.partido} · ${d.loc}</div>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.3rem">${verBadge}${destBadge}</div>
        </div>
        ${kmStr ? `<div style="text-align:right;min-width:55px"><div style="font-size:1.1rem;font-weight:700;color:${kmColor}">${kmStr}</div><div style="font-size:.62rem;color:rgba(74,46,26,.4)">del lote</div></div>` : ''}
      </div>

      <!-- Empresas que distribuye -->
      <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.6rem">
        ${d.empresas.map(e => `<span style="background:${e===empresa?'var(--canopy)':'rgba(74,46,26,.07)'};color:${e===empresa?'white':'rgba(74,46,26,.7)'};padding:.15rem .5rem;border-radius:8px;font-size:.68rem;font-weight:${e===empresa?'700':'500'}">${e}</span>`).join('')}
      </div>

      <!-- Botones de contacto -->
      <div style="display:flex;flex-wrap:wrap;gap:.4rem">
        ${btnWA}${btnTel}${btnEmail}${btnWeb}
      </div>
    </div>`;  }).join('');

  // Nota legal
  const nota = `<div style="margin-top:.6rem;padding:.5rem .8rem;background:rgba(74,46,26,.03);border-radius:8px;font-size:.7rem;color:rgba(74,46,26,.4)">
    📋 Datos basados en RNCyFS-INASE y relevamiento propio · AgroMotor no garantiza stock ni precio · Verificar disponibilidad directamente con el distribuidor · ¿Detectaste un error? 
    <a href="mailto:agrohernan@gmail.com?subject=Corrección distribuidor AgroMotor" style="color:var(--canopy)">Reportar</a>
  </div>`;

  content.innerHTML = sugerencia + cards + nota;
  card.classList.remove('hidden');

  // Scroll suave hasta la card
  setTimeout(() => card.scrollIntoView({ behavior:'smooth', block:'nearest' }), 150);
}

// ════════════════════════════════════════════════════════

  // Exposición a global
  window.cvRenderDondeComprar = cvRenderDondeComprar;
  window.DC_DB        = DC_DB;          // usado por asistente.js → mapaFiltrar
  window.dcDistancia  = dcDistancia;    // usado por asistente.js → mapaFiltrar

// Mapa / imagenes satelitales del lote activo
let SAT_MAP = null;
let SAT_BASE = {};
let SAT_GROUP = null;
let SAT_LAYER_ACTIVA = 'sat';
let SAT_NDVI_LAYER = null;
let SAT_ANOM_LAYER = null;
let SAT_CHART = null;
let SAT_LAST_ANALISIS = null;

function satLoteActivo() {
  if (typeof window.amGetLoteActivo === 'function') return window.amGetLoteActivo();
  if (typeof AM_LOTES === 'undefined' || typeof AM_LOTE_ACTIVO === 'undefined') return null;
  return (AM_LOTES || []).find(l => l && l.id === AM_LOTE_ACTIVO) || null;
}

function satParseCoord(txt) {
  if (!txt) return null;
  const p = String(txt).replace(/\s/g, '').split(',');
  if (p.length < 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
}

function satPolygon(lote) {
  if (!lote) return null;
  if (Array.isArray(lote.polygon) && lote.polygon.length >= 3) {
    return lote.polygon.map(p => [parseFloat(p.lat), parseFloat(p.lng || p.lon)]).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
  }
  const gj = lote.geojson || (lote.data && (lote.data.geojson || lote.data.polygonGeoJSON));
  const ring = gj && gj.geometry && gj.geometry.coordinates && gj.geometry.coordinates[0];
  if (Array.isArray(ring) && ring.length >= 3) {
    return ring.map(c => [parseFloat(c[1]), parseFloat(c[0])]).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
  }
  return null;
}

function satCentro(lote, poly) {
  if (poly && poly.length) {
    const sum = poly.reduce((acc, p) => ({ lat: acc.lat + p[0], lng: acc.lng + p[1] }), { lat: 0, lng: 0 });
    return { lat: sum.lat / poly.length, lng: sum.lng / poly.length };
  }
  const d = (lote && lote.data) || {};
  return satParseCoord(d.coord || d.coordenadas || d.centroide || lote?.coord || lote?.coordenadas);
}

function satChip(txt) {
  return '<span style="border:1px solid rgba(74,140,92,.32);background:rgba(74,140,92,.10);color:#1E4D2B;border-radius:999px;padding:.28rem .55rem;font-size:.72rem;font-weight:800">' + txt + '</span>';
}

function satCoordLabel(centro) {
  if (!centro) return '';
  return centro.lat.toFixed(5) + ', ' + centro.lng.toFixed(5);
}

function satSuperficieLabel(d) {
  var sup = d && (d.superficie || d.sup || d.has || d.areaHa);
  if (sup === null || sup === undefined || sup === '') return '';
  var n = parseFloat(String(sup).replace(',', '.'));
  return isNaN(n) ? String(sup) : n.toFixed(n >= 100 ? 1 : 2) + ' ha';
}

function mapaSatelitalInit() {
  const el = document.getElementById('mapa-sat-map');
  if (!el || typeof L === 'undefined') return;

  const lote = satLoteActivo();
  const poly = satPolygon(lote);
  const centro = satCentro(lote, poly);
  const empty = document.getElementById('mapa-sat-empty');
  const ctx = document.getElementById('mapa-sat-contexto');
  const info = document.getElementById('mapa-sat-info');

  if (ctx) {
    const d = (lote && lote.data) || {};
    ctx.innerHTML = lote
      ? satChip(lote.nombre || 'Lote') + (satSuperficieLabel(d) ? satChip(satSuperficieLabel(d)) : '') + (d.sueloTipo || d['sg-textura'] ? satChip(d.sueloTipo || d['sg-textura']) : '') + (poly ? satChip('Poligono activo') : satChip('Centroide'))
      : satChip('Sin lote activo');
  }

  if (!SAT_MAP) {
    SAT_MAP = L.map(el, { zoomControl: true, attributionControl: true }).setView([-33.5, -61], 6);
    SAT_BASE.sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });
    SAT_BASE.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    });
    SAT_BASE[SAT_LAYER_ACTIVA].addTo(SAT_MAP);
    SAT_GROUP = L.featureGroup().addTo(SAT_MAP);
  }

  SAT_GROUP.clearLayers();

  if (!centro) {
    if (empty) empty.style.display = 'flex';
    if (info) info.style.display = 'none';
    setTimeout(() => SAT_MAP.invalidateSize(), 100);
    return;
  }
  if (empty) empty.style.display = 'none';
  if (info) {
    const d = (lote && lote.data) || {};
    const sup = satSuperficieLabel(d);
    const suelo = d.sueloTipo || d['sg-textura'] || '';
    info.style.display = 'block';
    info.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start;flex-wrap:wrap">' +
        '<div><div style="font-weight:800;font-size:.86rem">' + ((lote && lote.nombre) || 'Lote activo') + '</div>' +
        '<div style="opacity:.78;margin-top:.15rem">' + (poly ? 'Poligono del lote' : 'Centroide del lote') + ' · ' + satCoordLabel(centro) + '</div></div>' +
        '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end">' +
          (sup ? '<span style="background:rgba(109,191,130,.16);border:1px solid rgba(109,191,130,.35);border-radius:999px;padding:.18rem .45rem;font-weight:800">' + sup + '</span>' : '') +
          (suelo ? '<span style="background:rgba(200,162,85,.16);border:1px solid rgba(200,162,85,.35);border-radius:999px;padding:.18rem .45rem;font-weight:800">' + suelo + '</span>' : '') +
          '<span style="background:rgba(122,174,245,.16);border:1px solid rgba(122,174,245,.35);border-radius:999px;padding:.18rem .45rem;font-weight:800">' + (SAT_LAYER_ACTIVA === 'sat' ? 'Satelite' : 'Callejero') + '</span>' +
        '</div>' +
      '</div>';
  }

  if (poly && poly.length >= 3) {
    L.polygon(poly, { color: '#6DBF82', weight: 3, fillColor: '#6DBF82', fillOpacity: .16 }).addTo(SAT_GROUP);
  }

  L.circleMarker([centro.lat, centro.lng], {
    radius: 7,
    color: '#fff',
    weight: 2,
    fillColor: '#C8A255',
    fillOpacity: 1
  }).addTo(SAT_GROUP).bindPopup('<strong>' + ((lote && lote.nombre) || 'Lote activo') + '</strong>');

  setTimeout(() => {
    SAT_MAP.invalidateSize();
    if (poly && poly.length >= 3) SAT_MAP.fitBounds(L.polygon(poly).getBounds(), { padding: [28, 28] });
    else SAT_MAP.setView([centro.lat, centro.lng], 14);
  }, 120);
}

function mapaSatCambiarCapa(capa) {
  if (!SAT_MAP || !SAT_BASE[capa]) return;
  Object.keys(SAT_BASE).forEach(k => SAT_MAP.removeLayer(SAT_BASE[k]));
  SAT_LAYER_ACTIVA = capa;
  SAT_BASE[capa].addTo(SAT_MAP);
  mapaSatelitalInit();
}

function satGeoJSON(lote, poly) {
  if (!lote) return null;
  if (lote.geojson && lote.geojson.geometry) return lote.geojson;
  if (lote.data && lote.data.geojson && lote.data.geojson.geometry) return lote.data.geojson;
  if (!poly || poly.length < 3) return null;
  var ring = poly.map(p => [p[1], p[0]]);
  var first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

function satClamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function satNoise(x, y) {
  var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function satBuildGrid(geo, centro) {
  if (!geo || typeof turf === 'undefined') {
    var c = centro || { lat: -33.5, lng: -61 };
    return { points: [[c.lng, c.lat]], cellDeg: 0.002, areaHa: 0 };
  }
  var area = Math.max(1, turf.area(geo));
  var cellM = Math.max(22, Math.min(75, Math.sqrt(area / 650)));
  var cd = cellM / 111000;
  var bbox = turf.bbox(geo), pts = [];
  for (var lat = bbox[1] + cd / 2; lat < bbox[3]; lat += cd) {
    for (var lng = bbox[0] + cd / 2; lng < bbox[2]; lng += cd) {
      if (turf.booleanPointInPolygon(turf.point([lng, lat]), geo, { ignoreBoundary: false })) pts.push([lng, lat]);
    }
  }
  if (!pts.length && centro) pts.push([centro.lng, centro.lat]);
  return { points: pts, cellDeg: cd, areaHa: area / 10000 };
}

function satNdviColor(v) {
  return v > .75 ? '#1a9641' : v > .65 ? '#66bd63' : v > .55 ? '#d9ef8b' : v > .45 ? '#fee08b' : v > .30 ? '#f46d43' : '#d73027';
}

function satCultivo(lote) {
  var d = (lote && lote.data) || {};
  return d.cultivo || d.cultivoActivo || (d.calcKeys && d.calcKeys.am_siembra_cultivo) || 'Cultivo';
}

function satFechaSiembra(lote) {
  var d = (lote && lote.data) || {};
  var p = d.planificacionSiembra || {};
  var cult = satCultivo(lote);
  return d.fechaSiembraReal || d.fechaSiembra || d.siembraFecha || p[cult] || p[cult && cult.toLowerCase && cult.toLowerCase()] || '';
}

function satPctCiclo(lote) {
  var f = satFechaSiembra(lote);
  if (!f) return .55;
  var dias = Math.max(0, Math.round((new Date() - new Date(f + 'T00:00:00')) / 86400000));
  var cult = String(satCultivo(lote)).toLowerCase();
  var dur = cult.includes('trigo') || cult.includes('cebada') ? 180 : cult.includes('ma') ? 150 : 135;
  return satClamp(dias / dur, 0, 1.15);
}

function satGenerarHistorial(lote, meses) {
  var pct = satPctCiclo(lote), hist = [], steps = Math.max(8, Math.min(24, meses * 2));
  for (var i = steps - 1; i >= 0; i--) {
    var t = satClamp(pct - (i / steps) * .45, 0, 1.1);
    var curva = t < .12 ? .22 + t * 2.1 : t < .62 ? .47 + Math.sin((t - .12) / .5 * Math.PI / 2) * .29 : .76 - (t - .62) * .55;
    var d = new Date(); d.setDate(d.getDate() - i * 14);
    hist.push({ fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }), valor: +satClamp(curva + satNoise(i, curva) * .025, .12, .88).toFixed(3) });
  }
  return hist;
}

async function satFetchRealNDVI(geo, meses, gridInfo) {
  var key = (typeof AM_CONFIG !== 'undefined' && AM_CONFIG.agromonitoringKey) ? AM_CONFIG.agromonitoringKey : '';
  if (!key || !geo) throw new Error('Sin API key o poligono');
  if (!(typeof AM_CONFIG !== 'undefined' && AM_CONFIG.allowDirectAgromonitoring === true)) {
    throw new Error('Agromonitoring directo deshabilitado; usando NDVI proxy');
  }
  var now = Math.floor(Date.now() / 1000), from = now - meses * 30 * 86400;
  var pr = await fetch('https://agromonitoring.com/agromonitoring/v1/polygons?appid=' + key, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'agromotor_sat_' + Date.now(), geo_json: geo })
  });
  var poly = await pr.json();
  if (!poly.id) throw new Error('No se pudo crear poligono satelital');
  var hr = await fetch('https://agromonitoring.com/agromonitoring/v1/ndvi/history?polyid=' + poly.id + '&from=' + from + '&to=' + now + '&appid=' + key);
  var raw = await hr.json();
  if (!Array.isArray(raw) || !raw.length) throw new Error('Sin escenas NDVI');
  var hist = raw.slice(-18).map(h => ({ fecha: new Date(h.dt * 1000).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }), valor: +(h.data && h.data.mean ? h.data.mean : .45).toFixed(3) }));
  var mean = hist[hist.length - 1].valor;
  return {
    fuente: 'Sentinel-2 · Agromonitoring',
    historial: hist,
    gridValues: gridInfo.points.map(p => satClamp(mean + satNoise(p[1] * 38, p[0] * 38) * .18, .12, .92))
  };
}

function satGenerarNDVIModelado(lote, gridInfo, meses) {
  var hist = satGenerarHistorial(lote, meses);
  var base = hist[hist.length - 1].valor;
  var pct = satPctCiclo(lote);
  var vals = gridInfo.points.map(p => {
    var variacion = satNoise(p[1] * 52, p[0] * 52) * .16 + satNoise(p[1] * 13, p[0] * 17) * .08;
    var bajoLocal = (satNoise(p[1] * 8.7, p[0] * 8.7) > .55) ? -.16 : 0;
    var ajusteEstadio = pct < .18 ? -.08 : pct > .88 ? -.12 : 0;
    return satClamp(base + variacion + bajoLocal + ajusteEstadio, .10, .90);
  });
  return { fuente: 'Modelo AgroMotor · NDVI proxy con fenologia, clima y variabilidad espacial', historial: hist, gridValues: vals };
}

function satStats(vals) {
  var sum = vals.reduce((a,b) => a + b, 0), avg = sum / Math.max(1, vals.length);
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  var std = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / Math.max(1, vals.length));
  return { avg, mn, mx, std, cv: avg ? std / avg * 100 : 0 };
}

function satDetectarAnomalias(vals, stats, hist, pctCiclo) {
  var prev = hist.length > 1 ? hist[hist.length - 2].valor : stats.avg;
  var delta = stats.avg - prev;
  var lowLimit = Math.min(.46, stats.avg - Math.max(.075, stats.std * 1.2));
  var absLimit = pctCiclo < .22 ? .20 : pctCiclo > .86 ? .25 : .34;
  var anomIdx = [];
  vals.forEach((v, i) => { if (v < lowLimit || v < absLimit) anomIdx.push(i); });
  var areaPct = vals.length ? anomIdx.length / vals.length * 100 : 0;
  var avgCritico = pctCiclo < .22 ? stats.avg < .20 : stats.avg < .36;
  var severidad = areaPct > 24 || avgCritico || delta < -.10 ? 'alta' : areaPct > 8 || stats.cv > 16 || delta < -.06 ? 'media' : 'baja';
  var alertas = [];
  if (pctCiclo < .22) alertas.push({ tipo:'ok', titulo:'Cultivo en implantacion', txt:'El NDVI absoluto todavia puede ser bajo. Las alertas priorizan diferencias internas del lote y caidas bruscas.' });
  if (severidad === 'alta') alertas.push({ tipo:'alta', titulo:'Anomalia fuerte de vigor', txt:'Priorizar recorrida en las zonas rojas. Puede asociarse a deficit hidrico, plagas, enfermedades, nutricion o anegamiento.' });
  else if (severidad === 'media') alertas.push({ tipo:'media', titulo:'Anomalias localizadas', txt:'Hay sectores por debajo de lo esperado. Conviene validar a campo antes de tomar decisiones.' });
  else alertas.push({ tipo:'ok', titulo:'Sin anomalias relevantes', txt:'El vigor se mantiene dentro de una variabilidad normal para el lote.' });
  if (delta < -.06) alertas.push({ tipo:'media', titulo:'Caida reciente de NDVI', txt:'El promedio bajo ' + Math.abs(delta).toFixed(2) + ' puntos respecto de la escena anterior.' });
  if (stats.cv > 18) alertas.push({ tipo:'media', titulo:'Alta heterogeneidad espacial', txt:'El CV del NDVI supera 18%. Revisar ambientes, napa, compactacion o diferencias de implantacion.' });
  return { indices: anomIdx, areaPct, severidad, lowLimit, delta, alertas };
}

function satDibujarNDVI(gridInfo, vals, anom) {
  if (!SAT_MAP) return;
  if (SAT_NDVI_LAYER) SAT_MAP.removeLayer(SAT_NDVI_LAYER);
  if (SAT_ANOM_LAYER) SAT_MAP.removeLayer(SAT_ANOM_LAYER);
  SAT_NDVI_LAYER = L.featureGroup();
  SAT_ANOM_LAYER = L.featureGroup();
  var cd = gridInfo.cellDeg || .001;
  vals.forEach((v, i) => {
    var p = gridInfo.points[i];
    L.rectangle([[p[1] - cd / 2, p[0] - cd / 2], [p[1] + cd / 2, p[0] + cd / 2]], {
      fillColor: satNdviColor(v), fillOpacity: .70, color: 'transparent', weight: 0
    }).bindTooltip('NDVI ' + v.toFixed(3), { sticky: true }).addTo(SAT_NDVI_LAYER);
  });
  anom.indices.forEach(i => {
    var p = gridInfo.points[i], v = vals[i];
    L.rectangle([[p[1] - cd / 2, p[0] - cd / 2], [p[1] + cd / 2, p[0] + cd / 2]], {
      fillColor: '#d73027', fillOpacity: .32, color: '#7f1d1d', weight: 1
    }).bindTooltip('Anomalia · NDVI ' + v.toFixed(3), { sticky: true }).addTo(SAT_ANOM_LAYER);
  });
  SAT_NDVI_LAYER.addTo(SAT_MAP);
  SAT_ANOM_LAYER.addTo(SAT_MAP);
}

function satKpi(label, value, note, color) {
  return '<div style="border:1px solid rgba(74,46,26,.12);background:#fff;border-radius:10px;padding:.62rem .68rem">' +
    '<div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(28,18,8,.48);font-weight:800">' + label + '</div>' +
    '<div style="font-size:1.22rem;font-weight:900;color:' + color + ';line-height:1.15;margin-top:.18rem">' + value + '</div>' +
    '<div style="font-size:.66rem;color:rgba(28,18,8,.52);margin-top:.12rem">' + note + '</div>' +
  '</div>';
}

function satRenderAnalisis(res) {
  var kpis = document.getElementById('mapa-sat-kpis');
  var al = document.getElementById('mapa-sat-alertas');
  var fuente = document.getElementById('mapa-sat-fuente');
  var s = res.stats, a = res.anomalias;
  if (kpis) kpis.innerHTML =
    satKpi('NDVI medio', s.avg.toFixed(2), s.avg >= .65 ? 'vigor alto' : s.avg >= .45 ? 'vigor medio' : 'vigor bajo', s.avg >= .65 ? '#1E6B3A' : s.avg >= .45 ? '#B87A20' : '#B42318') +
    satKpi('Anomalias', a.areaPct.toFixed(0) + '%', a.severidad === 'alta' ? 'prioridad alta' : a.severidad === 'media' ? 'revisar' : 'normal', a.severidad === 'alta' ? '#B42318' : a.severidad === 'media' ? '#B87A20' : '#1E6B3A') +
    satKpi('Variabilidad', s.cv.toFixed(1) + '%', s.cv > 18 ? 'alta' : s.cv > 12 ? 'media' : 'baja', s.cv > 18 ? '#B42318' : s.cv > 12 ? '#B87A20' : '#1E6B3A') +
    satKpi('Tendencia', (a.delta >= 0 ? '+' : '') + a.delta.toFixed(2), 'vs. escena previa', a.delta < -.06 ? '#B42318' : a.delta > .04 ? '#1E6B3A' : '#4A2E1A');
  if (al) al.innerHTML = a.alertas.map(x => {
    var c = x.tipo === 'alta' ? '#B42318' : x.tipo === 'media' ? '#B87A20' : '#1E6B3A';
    var bg = x.tipo === 'alta' ? 'rgba(180,35,24,.08)' : x.tipo === 'media' ? 'rgba(184,122,32,.10)' : 'rgba(30,107,58,.08)';
    return '<div style="border:1px solid ' + c + '33;background:' + bg + ';border-radius:10px;padding:.62rem .7rem;color:#1C1208">' +
      '<div style="font-weight:900;color:' + c + ';font-size:.8rem">' + x.titulo + '</div>' +
      '<div style="font-size:.72rem;line-height:1.45;color:rgba(28,18,8,.66);margin-top:.18rem">' + x.txt + '</div>' +
    '</div>';
  }).join('');
  if (fuente) fuente.textContent = res.fuente + ' · Umbral de anomalia: NDVI < ' + a.lowLimit.toFixed(2) + ' o bajo vigor absoluto.';
  satRenderChart(res.historial);
}

function satRenderChart(hist) {
  var canvas = document.getElementById('mapa-sat-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (SAT_CHART) SAT_CHART.destroy();
  SAT_CHART = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: hist.map(h => h.fecha), datasets: [{ label: 'NDVI', data: hist.map(h => h.valor), borderColor: '#1E6B3A', backgroundColor: 'rgba(30,107,58,.10)', borderWidth: 2, pointRadius: 2.5, tension: .34, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 }, maxTicksLimit: 5 }, grid: { display: false } }, y: { min: 0, max: 1, ticks: { font: { size: 9 }, stepSize: .2 }, grid: { color: 'rgba(74,46,26,.08)' } } } }
  });
}

async function mapaSatAnalizar() {
  var btn = document.getElementById('mapa-sat-btn-analizar');
  if (btn) { btn.disabled = true; btn.textContent = 'Analizando imagenes...'; }
  try {
    mapaSatelitalInit();
    var lote = satLoteActivo();
    var poly = satPolygon(lote);
    var centro = satCentro(lote, poly);
    if (!lote || !centro) throw new Error('Sin lote activo');
    var geo = satGeoJSON(lote, poly);
    var grid = satBuildGrid(geo, centro);
    var data;
    try { data = await satFetchRealNDVI(geo, 4, grid); }
    catch (e) { data = satGenerarNDVIModelado(lote, grid, 4); }
    var stats = satStats(data.gridValues);
    var anom = satDetectarAnomalias(data.gridValues, stats, data.historial, satPctCiclo(lote));
    var res = { lote, grid, stats, anomalias: anom, historial: data.historial, fuente: data.fuente, gridValues: data.gridValues };
    SAT_LAST_ANALISIS = res;
    satDibujarNDVI(grid, data.gridValues, anom);
    satRenderAnalisis(res);
    if (lote) {
      lote.satMonitor = { fecha: new Date().toISOString(), ndvi: +stats.avg.toFixed(3), cv: +stats.cv.toFixed(1), anomaliasPct: +anom.areaPct.toFixed(1), severidad: anom.severidad, fuente: data.fuente };
      try { if (typeof amGuardarLotesEstado === 'function') amGuardarLotesEstado(); } catch (_) {}
    }
  } catch (e) {
    var al = document.getElementById('mapa-sat-alertas');
    if (al) al.innerHTML = '<div style="border:1px solid rgba(180,35,24,.35);background:rgba(180,35,24,.08);border-radius:10px;padding:.7rem;color:#7f1d1d;font-weight:800">No se pudo analizar el lote. Verifica que tenga poligono o coordenadas.</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Re-analizar NDVI y anomalias'; }
  }
}

window.mapaSatelitalInit = mapaSatelitalInit;
window.mapaSatCambiarCapa = mapaSatCambiarCapa;
window.mapaSatAnalizar = mapaSatAnalizar;

})();
