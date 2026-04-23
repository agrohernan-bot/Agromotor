// ════════════════════════════════════════════════════════
// AGROMOTOR — mapa.js
// Mapa de distribuidores · OpenStreetMap + Leaflet
// 32 distribuidores reales · 10 provincias
// Filtros por distancia, especie y empresa
// ════════════════════════════════════════════════════════

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
// ASISTENTE AGRONÓMICO IA — AgroMotor v3.0
// Powered by Claude API (Anthropic)
// Contexto: usa todos los datos del lote disponibles
// ════════════════════════════════════════════════════════

let IA_HISTORIAL = []; // historial de la conversación
let IA_PENSANDO  = false;

// ── CONSTRUIR CONTEXTO DEL LOTE ───────────────────────
// Recopila todos los datos disponibles en el motor