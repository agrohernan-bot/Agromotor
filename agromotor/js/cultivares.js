// ════════════════════════════════════════════════════════
// AGROMOTOR — cultivares.js
// DB RECSO/INTA 2024-25 · Ranking · Zonas agroecológicas
// Comparador lado a lado · Densidad de siembra
// Ventana óptima · Filtros por empresa/tecnología
// ════════════════════════════════════════════════════════

const CV_ZONAS = {
  pampeana_norte: {
    label: 'Pampeana Norte',
    desc: 'Sur de Santa Fe, Este de Córdoba, Norte de Buenos Aires · Zona núcleo',
    latMin: -35, latMax: -29,
    cultivos: {
      Soja:    { gms: ['III corto','III largo','IV corto','IV largo','V corto'],
                 ventana: { primera:'15-sep al 15-nov', segunda:'20-nov al 20-dic', temprana:'1-sep al 14-sep', tardia:'16-dic al 10-ene' },
                 gmPorTipo: { primera:['IV corto','IV largo'], segunda:['III corto','III largo'], temprana:['III corto','III largo'], tardia:['V corto','IV largo'] },
                 gmPorAmbiente: { alto:['III corto','III largo','IV corto'], medio:['IV corto','IV largo'], bajo:['IV largo','V corto'] } },
      Maíz:   { gms: ['Precoz','Intermedio','Tardío'],
                 ventana: { primera:'15-sep al 15-oct', segunda:'15-oct al 15-nov', temprana:'1-sep al 14-sep', tardia:'16-nov al 10-dic' },
                 gmPorTipo: { primera:['Intermedio','Tardío'], segunda:['Precoz','Intermedio'], temprana:['Precoz'], tardia:['Precoz'] },
                 gmPorAmbiente: { alto:['Tardío','Intermedio'], medio:['Intermedio'], bajo:['Precoz','Intermedio'] } },
      Trigo:  { gms: ['Subregión IV','Subregión V'],
                 ventana: { primera:'10-jun al 10-jul', segunda:'11-jul al 31-jul', temprana:'1-jun al 9-jun', tardia:'1-ago al 31-ago' },
                 gmPorTipo: { primera:['Subregión IV'], segunda:['Subregión IV','Subregión V'], temprana:['Subregión V'], tardia:['Subregión IV'] },
                 gmPorAmbiente: { alto:['Subregión IV'], medio:['Subregión IV'], bajo:['Subregión V'] } },
      Girasol:{ gms: ['Precoz','Intermedio'],
                 ventana: { primera:'1-oct al 15-nov', segunda:'16-nov al 10-dic', temprana:'15-sep al 30-sep', tardia:'16-nov al 30-nov' },
                 gmPorTipo: { primera:['Intermedio'], segunda:['Precoz'], temprana:['Precoz'], tardia:['Precoz'] },
                 gmPorAmbiente: { alto:['Intermedio'], medio:['Intermedio'], bajo:['Precoz'] } },
    }
  },
  pampeana_sur: {
    label: 'Pampeana Sur',
    desc: 'Centro y Sur de Buenos Aires · La Pampa norte',
    latMin: -39, latMax: -35,
    cultivos: {
      Soja:   { gms: ['II largo','III corto','III largo','IV corto'],
                ventana: { primera:'1-nov al 20-dic', segunda:'15-nov al 31-dic', temprana:'15-oct al 31-oct', tardia:'21-dic al 15-ene' },
                gmPorTipo: { primera:['III corto','III largo'], segunda:['II largo','III corto'], temprana:['II largo'], tardia:['IV corto'] },
                gmPorAmbiente: { alto:['III corto','III largo'], medio:['III corto'], bajo:['II largo','III corto'] } },
      Maíz:  { gms: ['Precoz','Intermedio'],
                ventana: { primera:'1-oct al 31-oct', segunda:'1-nov al 20-nov', temprana:'15-sep al 30-sep', tardia:'1-nov al 20-nov' },
                gmPorTipo: { primera:['Precoz','Intermedio'], segunda:['Precoz'], temprana:['Precoz'], tardia:['Precoz'] },
                gmPorAmbiente: { alto:['Intermedio'], medio:['Precoz','Intermedio'], bajo:['Precoz'] } },
      Trigo: { gms: ['Subregión II','Subregión III'],
                ventana: { primera:'1-jun al 30-jun', segunda:'1-jul al 31-jul', temprana:'15-may al 31-may', tardia:'1-ago al 15-ago' },
                gmPorTipo: { primera:['Subregión II'], segunda:['Subregión II','Subregión III'], temprana:['Subregión III'], tardia:['Subregión II'] },
                gmPorAmbiente: { alto:['Subregión II'], medio:['Subregión II'], bajo:['Subregión III'] } },
      Girasol:{ gms: ['Precoz','Intermedio'],
                 ventana: { primera:'15-oct al 15-nov', segunda:'16-nov al 30-nov', temprana:'1-oct al 14-oct', tardia:'1-dic al 15-dic' },
                 gmPorTipo: { primera:['Intermedio'], segunda:['Precoz'], temprana:['Precoz'], tardia:['Precoz'] },
                 gmPorAmbiente: { alto:['Intermedio'], medio:['Precoz','Intermedio'], bajo:['Precoz'] } },
    }
  },
  nea: {
    label: 'NEA',
    desc: 'Entre Ríos, Corrientes, Misiones · Norte húmedo',
    latMin: -32, latMax: -27,
    cultivos: {
      Soja:   { gms: ['IV largo','V corto','V largo','VI corto'],
                ventana: { primera:'15-oct al 30-nov', segunda:'1-dic al 10-ene', temprana:'1-oct al 14-oct', tardia:'11-ene al 31-ene' },
                gmPorTipo: { primera:['V corto','V largo'], segunda:['IV largo','V corto'], temprana:['IV largo'], tardia:['VI corto'] },
                gmPorAmbiente: { alto:['V largo','VI corto'], medio:['V corto','V largo'], bajo:['IV largo','V corto'] } },
      Maíz:  { gms: ['Intermedio','Tardío'],
                ventana: { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'1-sep al 14-sep', tardia:'1-dic al 20-dic' },
                gmPorTipo: { primera:['Tardío','Intermedio'], segunda:['Intermedio'], temprana:['Intermedio'], tardia:['Precoz'] },
                gmPorAmbiente: { alto:['Tardío'], medio:['Intermedio','Tardío'], bajo:['Intermedio'] } },
      Trigo: { gms: ['Subregión V','Subregión VI'],
                ventana: { primera:'15-jun al 15-jul', segunda:'16-jul al 15-ago', temprana:'1-jun al 14-jun', tardia:'16-ago al 31-ago' },
                gmPorTipo: { primera:['Subregión V'], segunda:['Subregión VI'], temprana:['Subregión VI'], tardia:['Subregión V'] },
                gmPorAmbiente: { alto:['Subregión V'], medio:['Subregión V'], bajo:['Subregión VI'] } },
      Girasol:{ gms: ['Intermedio','Tardío'],
                 ventana: { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'1-sep al 14-sep', tardia:'1-dic al 15-dic' },
                 gmPorTipo: { primera:['Intermedio'], segunda:['Intermedio'], temprana:['Tardío'], tardia:['Intermedio'] },
                 gmPorAmbiente: { alto:['Tardío'], medio:['Intermedio'], bajo:['Intermedio'] } },
    }
  },
  noa: {
    label: 'NOA',
    desc: 'Salta, Tucumán, Santiago del Estero, Chaco · Región norte',
    latMin: -28, latMax: -22,
    cultivos: {
      Soja:   { gms: ['VI corto','VI largo','VII','VIII'],
                ventana: { primera:'15-oct al 30-nov', segunda:'1-dic al 31-dic', temprana:'1-ago al 30-sep', tardia:'1-ene al 31-ene' },
                gmPorTipo: { primera:['VII','VIII'], segunda:['VI corto','VI largo'], temprana:['VI corto'], tardia:['VIII'] },
                gmPorAmbiente: { alto:['VIII','VII'], medio:['VI largo','VII'], bajo:['VI corto','VI largo'] } },
      Maíz:  { gms: ['Tardío'],
                ventana: { primera:'15-oct al 30-nov', segunda:'1-dic al 15-dic', temprana:'1-sep al 14-oct', tardia:'1-ene al 15-ene' },
                gmPorTipo: { primera:['Tardío'], segunda:['Tardío'], temprana:['Tardío'], tardia:['Tardío'] },
                gmPorAmbiente: { alto:['Tardío'], medio:['Tardío'], bajo:['Tardío'] } },
      Trigo: { gms: ['Subregión VI','Subregión VII'],
                ventana: { primera:'1-jul al 15-ago', segunda:'16-ago al 30-sep', temprana:'15-jun al 30-jun', tardia:'1-oct al 31-oct' },
                gmPorTipo: { primera:['Subregión VII'], segunda:['Subregión VI'], temprana:['Subregión VI'], tardia:['Subregión VII'] },
                gmPorAmbiente: { alto:['Subregión VII'], medio:['Subregión VI','Subregión VII'], bajo:['Subregión VI'] } },
      Girasol:{ gms: ['Tardío'],
                 ventana: { primera:'15-sep al 31-oct', segunda:'1-nov al 30-nov', temprana:'1-sep al 14-sep', tardia:'1-dic al 15-dic' },
                 gmPorTipo: { primera:['Tardío'], segunda:['Tardío'], temprana:['Tardío'], tardia:['Tardío'] },
                 gmPorAmbiente: { alto:['Tardío'], medio:['Tardío'], bajo:['Tardío'] } },
    }
  },
  semiarida: {
    label: 'Semiárida Pampeana',
    desc: 'Oeste de Buenos Aires · La Pampa sur · San Luis',
    latMin: -38, latMax: -34,
    cultivos: {
      Soja:   { gms: ['III corto','III largo','IV corto'],
                ventana: { primera:'15-nov al 15-dic', segunda:'15-dic al 10-ene', temprana:'1-nov al 14-nov', tardia:'16-dic al 31-dic' },
                gmPorTipo: { primera:['III corto','III largo'], segunda:['III corto'], temprana:['III corto'], tardia:['IV corto'] },
                gmPorAmbiente: { alto:['III largo','IV corto'], medio:['III corto','III largo'], bajo:['III corto'] } },
      Maíz:  { gms: ['Precoz'],
                ventana: { primera:'15-oct al 15-nov', segunda:'16-nov al 30-nov', temprana:'1-oct al 14-oct', tardia:'1-dic al 15-dic' },
                gmPorTipo: { primera:['Precoz'], segunda:['Precoz'], temprana:['Precoz'], tardia:['Precoz'] },
                gmPorAmbiente: { alto:['Precoz'], medio:['Precoz'], bajo:['Precoz'] } },
      Trigo: { gms: ['Subregión II','Subregión III'],
                ventana: { primera:'1-jun al 15-jul', segunda:'16-jul al 15-ago', temprana:'15-may al 31-may', tardia:'16-ago al 15-sep' },
                gmPorTipo: { primera:['Subregión II'], segunda:['Subregión III'], temprana:['Subregión III'], tardia:['Subregión II'] },
                gmPorAmbiente: { alto:['Subregión II'], medio:['Subregión II'], bajo:['Subregión III'] } },
      Girasol:{ gms: ['Precoz','Intermedio'],
                 ventana: { primera:'15-oct al 15-nov', segunda:'16-nov al 30-nov', temprana:'1-oct al 14-oct', tardia:'1-dic al 15-dic' },
                 gmPorTipo: { primera:['Precoz','Intermedio'], segunda:['Precoz'], temprana:['Precoz'], tardia:['Precoz'] },
                 gmPorAmbiente: { alto:['Intermedio'], medio:['Precoz'], bajo:['Precoz'] } },
    }
  },
};

// ── BASE DE CULTIVARES ────────────────────────────────
// Datos RECSO 2024/25 (INTA Oliveros) + RET-INASE 2024/25
// Campos: nombre, empresa, gm, tecnologia, zonas[], rend_relativo (% vs testigo),
//         estabilidad (A=alta/B=media/C=baja), sanidad (1-5), precoz (bool),
//         nota, campanas_ensayo, destacado
const CV_DB = {
  Soja: [
    // GM III CORTO — Zona núcleo
    { nombre:'DM 33E22 SE',     empresa:'Don Mario',    gm:'III corto', tec:'STS',    zonas:['pampeana_norte','pampeana_sur'], rend:108, est:'A', san:4, precoz:true,  nota:'Top 3 en zona núcleo 3 campañas consecutivas · Alta estabilidad · Ciclo ultra corto', camp:3, dest:true },
    { nombre:'STINE 33EA52 STS',empresa:'Stine',        gm:'III corto', tec:'STS',    zonas:['pampeana_norte'],              rend:107, est:'A', san:4, precoz:true,  nota:'Excelente rendimiento y estabilidad · Muy buena sanidad foliar', camp:3, dest:true },
    { nombre:'BRV3324SE',       empresa:'Brevant',      gm:'III corto', tec:'STS',    zonas:['pampeana_norte'],              rend:109, est:'B', san:3, precoz:true,  nota:'Líder campaña 2024/25 en GM III corto zona núcleo · Material nuevo de alto potencial', camp:1, dest:true },
    { nombre:'SY 3x4 STS',     empresa:'Syngenta',     gm:'III corto', tec:'STS',    zonas:['pampeana_norte','semiarida'],   rend:104, est:'B', san:4, precoz:true,  nota:'Buen comportamiento en ambientes medios y bajos', camp:2, dest:false },
    // GM III LARGO
    { nombre:'DM 36E18 SE',     empresa:'Don Mario',    gm:'III largo', tec:'STS+Enlist', zonas:['pampeana_norte','pampeana_sur','semiarida'], rend:110, est:'A', san:4, precoz:true,  nota:'Mejor cultivar zona núcleo GM III largo 2024/25 · Tecnología doble trait · Alta adaptación', camp:2, dest:true },
    { nombre:'ACA 3776 STS',    empresa:'ACA',          gm:'III largo', tec:'STS',    zonas:['pampeana_norte','pampeana_sur'], rend:105, est:'A', san:5, precoz:true,  nota:'Excelente sanidad · Alta estabilidad · Preferencia cooperativas', camp:3, dest:false },
    { nombre:'NS 3989 IPRO',    empresa:'Nidera/BASF',  gm:'III largo', tec:'IPRO',   zonas:['pampeana_norte','semiarida'],   rend:103, est:'B', san:4, precoz:true,  nota:'Buena tolerancia a sequía · Recomendado ambientes medios a bajos', camp:2, dest:false },
    { nombre:'BRV3649SE',       empresa:'Brevant',      gm:'III largo', tec:'STS',    zonas:['pampeana_norte'],              rend:108, est:'B', san:3, precoz:true,  nota:'Alto potencial de rendimiento · Menor estabilidad en ambientes bajos', camp:2, dest:false },
    // GM IV CORTO
    { nombre:'DM 4.2 SE',       empresa:'Don Mario',    gm:'IV corto',  tec:'STS',    zonas:['pampeana_norte','pampeana_sur','nea'], rend:111, est:'A', san:4, precoz:false, nota:'Cultivar referencia zona núcleo · Máximo rendimiento GM IV corto · Alta estabilidad multicampaña', camp:4, dest:true },
    { nombre:'ACA 4220 STS',    empresa:'ACA',          gm:'IV corto',  tec:'STS',    zonas:['pampeana_norte','nea'],        rend:106, est:'A', san:5, precoz:false, nota:'Excelente sanidad foliares · Alta preferencia en Entre Ríos', camp:3, dest:false },
    { nombre:'NS 4251 IPRO',    empresa:'Nidera/BASF',  gm:'IV corto',  tec:'IPRO',   zonas:['pampeana_norte','semiarida'],  rend:104, est:'B', san:4, precoz:false, nota:'Tolerancia intermedia a sequía · Buena adaptación zona semiárida', camp:3, dest:false },
    { nombre:'STINE 44EA55',    empresa:'Stine',        gm:'IV corto',  tec:'Enlist', zonas:['pampeana_norte'],              rend:109, est:'B', san:3, precoz:false, nota:'Alto potencial · Tecnología Enlist para control de malezas', camp:1, dest:false },
    // GM IV LARGO
    { nombre:'DM 4670 SE',      empresa:'Don Mario',    gm:'IV largo',  tec:'STS+Enlist', zonas:['pampeana_norte','pampeana_sur','nea','semiarida'], rend:112, est:'A', san:4, precoz:false, nota:'Cultivar más sembrado Argentina · Referencia absoluta GM IV largo · 4 campañas de datos', camp:4, dest:true },
    { nombre:'ACA 4940 STS',    empresa:'ACA',          gm:'IV largo',  tec:'STS',    zonas:['pampeana_norte','nea'],        rend:107, est:'A', san:5, precoz:false, nota:'Mejor sanidad GM IV largo · Alta estabilidad · Preferencia sur Santa Fe', camp:3, dest:false },
    { nombre:'NS 4990 IPRO',    empresa:'Nidera/BASF',  gm:'IV largo',  tec:'IPRO',   zonas:['pampeana_norte','semiarida','nea'], rend:105, est:'A', san:4, precoz:false, nota:'Muy buena estabilidad en todos los ambientes · Recomendado para ambientes variables', camp:3, dest:false },
    { nombre:'BRV4972SE',       empresa:'Brevant',      gm:'IV largo',  tec:'STS',    zonas:['pampeana_norte'],              rend:108, est:'B', san:3, precoz:false, nota:'Nuevo material alto rendimiento · Datos limitados por ser reciente', camp:1, dest:false },
    { nombre:'SY 4x5 IPRO',    empresa:'Syngenta',     gm:'IV largo',  tec:'IPRO',   zonas:['pampeana_norte','pampeana_sur'],rend:104, est:'B', san:4, precoz:false, nota:'Buena adaptación zona sur · Buen comportamiento sanitario', camp:2, dest:false },
    // GM V CORTO
    { nombre:'DM 52E68 SE',     empresa:'Don Mario',    gm:'V corto',   tec:'STS',    zonas:['pampeana_norte','nea'],        rend:108, est:'A', san:4, precoz:false, nota:'Mejor GM V corto zona núcleo · Floración que escapa a estreses tardíos', camp:3, dest:true },
    { nombre:'NS 5208 IPRO',    empresa:'Nidera/BASF',  gm:'V corto',   tec:'IPRO',   zonas:['pampeana_norte','nea'],        rend:105, est:'B', san:4, precoz:false, nota:'Buena tolerancia a estrés · Recomendado posición tardía', camp:2, dest:false },
    { nombre:'ACA 5020 STS',    empresa:'ACA',          gm:'V corto',   tec:'STS',    zonas:['nea','pampeana_norte'],        rend:104, est:'A', san:5, precoz:false, nota:'Excelente sanidad · Preferencia Entre Ríos y norte', camp:2, dest:false },
    // GM V LARGO — NEA
    { nombre:'DM 56i68 SE',     empresa:'Don Mario',    gm:'V largo',   tec:'STS',    zonas:['nea'],                         rend:110, est:'A', san:4, precoz:false, nota:'Referencia GM V largo Entre Ríos · Alta productividad en zona húmeda', camp:3, dest:true },
    { nombre:'NS 5959 IPRO',    empresa:'Nidera/BASF',  gm:'V largo',   tec:'IPRO',   zonas:['nea'],                         rend:106, est:'B', san:4, precoz:false, nota:'Buena adaptación norte · Potencial en ambientes húmedos', camp:2, dest:false },
    // GM VI+ — NOA
    { nombre:'DM 60i62',        empresa:'Don Mario',    gm:'VI corto',  tec:'RR',     zonas:['noa','nea'],                   rend:108, est:'A', san:4, precoz:false, nota:'Referencia GM VI zona norte · Muy alta adaptación a condiciones tropicales', camp:3, dest:true },
    { nombre:'NS 6419',         empresa:'Nidera/BASF',  gm:'VI largo',  tec:'RR',     zonas:['noa'],                         rend:106, est:'B', san:3, precoz:false, nota:'Alto potencial zona norte · Ciclo largo bien adaptado', camp:2, dest:false },
    // HB4
    { nombre:'HB4 AW1402',      empresa:'Bioceres',     gm:'IV largo',  tec:'HB4',    zonas:['pampeana_norte','semiarida','pampeana_sur'], rend:108, est:'A', san:4, precoz:false, nota:'Tolerancia a sequía genética · Ventaja en años Niña · Aprobado INASE 2022 · Primeros datos multicampañas', camp:2, dest:false },
  ],

  Maíz: [
    // PRECOCES
    { nombre:'NK Asgrow 860 MG', empresa:'Syngenta',   gm:'Precoz', tec:'VT3P', zonas:['pampeana_sur','semiarida','pampeana_norte'], rend:108, est:'A', san:4, precoz:true, nota:'Referencia maíz precoz zona sur · Alta estabilidad · Buen comportamiento ante sequía', camp:4, dest:true },
    { nombre:'DK 72-10 VT3P',   empresa:'Brevant',     gm:'Precoz', tec:'VT3P', zonas:['pampeana_sur','semiarida'],              rend:105, est:'A', san:4, precoz:true, nota:'Muy buena estabilidad · Recomendado para ambientes variables zona sur', camp:3, dest:false },
    { nombre:'ACA 470 VT3P',    empresa:'ACA',         gm:'Precoz', tec:'VT3P', zonas:['pampeana_sur','semiarida'],              rend:103, est:'B', san:5, precoz:true, nota:'Excelente sanidad · Buena tolerancia a fusariosis · Preferencia cooperativas', camp:3, dest:false },
    // INTERMEDIOS
    { nombre:'P1319 VYHR',      empresa:'Brevant',     gm:'Intermedio', tec:'VT3PRO', zonas:['pampeana_norte','nea','pampeana_sur'], rend:112, est:'A', san:4, precoz:false, nota:'Uno de los maíces más rendidores del mercado · Alta productividad · Referencia campaña 2024/25', camp:3, dest:true },
    { nombre:'DK 7210 VT3P',    empresa:'Brevant',     gm:'Intermedio', tec:'VT3P',  zonas:['pampeana_norte','pampeana_sur'],      rend:108, est:'A', san:4, precoz:false, nota:'Clásico de alta estabilidad · 5+ campañas de datos · Muy confiable', camp:5, dest:true },
    { nombre:'NK 880 VIPTERA',  empresa:'Syngenta',    gm:'Intermedio', tec:'VT3P',  zonas:['pampeana_norte','nea'],              rend:106, est:'A', san:4, precoz:false, nota:'Alta estabilidad en zona núcleo · Tolerancia moderada a sequía', camp:4, dest:false },
    { nombre:'ACA 499 VT3P',    empresa:'ACA',         gm:'Intermedio', tec:'VT3P',  zonas:['pampeana_norte'],                    rend:105, est:'B', san:5, precoz:false, nota:'Excelente sanidad · Comportamiento cooperativismo', camp:3, dest:false },
    { nombre:'SY Zeltos',       empresa:'Syngenta',    gm:'Intermedio', tec:'VT3P',  zonas:['pampeana_norte','pampeana_sur'],     rend:107, est:'B', san:4, precoz:false, nota:'Alto potencial en siembras de primera · Buena tolerancia a fusariosis', camp:2, dest:false },
    // TARDÍOS
    { nombre:'P2088 PWUR',      empresa:'Brevant',     gm:'Tardío', tec:'VT3PRO', zonas:['pampeana_norte','nea'],               rend:115, est:'B', san:3, precoz:false, nota:'Máximo potencial rendimiento en ambientes de alta calidad · Exigente en manejo · Ciclo largo', camp:2, dest:true },
    { nombre:'DK 7823 VT3P',    empresa:'Brevant',     gm:'Tardío', tec:'VT3P',   zonas:['pampeana_norte','nea'],               rend:110, est:'A', san:4, precoz:false, nota:'Muy buena estabilidad · Mejor tardío en relación rendimiento/estabilidad', camp:3, dest:true },
    { nombre:'NS 8240 VT3P',    empresa:'Nidera/BASF', gm:'Tardío', tec:'VT3P',   zonas:['pampeana_norte','nea'],               rend:108, est:'B', san:4, precoz:false, nota:'Alto rendimiento en ambientes húmedos · Excelente en NEA', camp:3, dest:false },
  ],

  Trigo: [
    // SUBREGIÓN II (Sur de Buenos Aires, La Pampa)
    { nombre:'SY 100',          empresa:'Syngenta',    gm:'Subregión II', tec:'Conv', zonas:['pampeana_sur','semiarida'], rend:112, est:'A', san:4, precoz:false, nota:'Líder rendimiento subregión II campaña 2024/25 · Excelente calidad panadera · Alta estabilidad', camp:3, dest:true },
    { nombre:'Buck Ciprés',     empresa:'Buck',        gm:'Subregión II', tec:'Conv', zonas:['pampeana_sur'],             rend:108, est:'A', san:5, precoz:true,  nota:'Mejor comportamiento sanitario subregión II · Alta resistencia a roya amarilla y fusariosis', camp:4, dest:true },
    { nombre:'Klein Tauro',     empresa:'Klein',       gm:'Subregión II', tec:'Conv', zonas:['pampeana_sur','semiarida'], rend:106, est:'A', san:4, precoz:false, nota:'Muy buena estabilidad · Calidad W2 · Preferencia zona sur', camp:4, dest:false },
    { nombre:'Baguette 750',    empresa:'Baguette',    gm:'Subregión II', tec:'Conv', zonas:['pampeana_sur'],             rend:104, est:'B', san:4, precoz:false, nota:'Buen comportamiento ante sequía · Recomendado fechas tardías', camp:3, dest:false },
    // SUBREGIÓN III (Norte de Buenos Aires, sur Santa Fe)
    { nombre:'ACA 303 PLUS',    empresa:'ACA',         gm:'Subregión III', tec:'Conv', zonas:['pampeana_norte','pampeana_sur'], rend:110, est:'A', san:4, precoz:false, nota:'Referencia subregión III · Alta estabilidad · Calidad panadera óptima', camp:3, dest:true },
    { nombre:'Klein Geminis',   empresa:'Klein',       gm:'Subregión III', tec:'Conv', zonas:['pampeana_norte'],              rend:108, est:'A', san:5, precoz:false, nota:'Excelente resistencia a enfermedades · Alto contenido proteico', camp:3, dest:false },
    { nombre:'Buck Guapo',      empresa:'Buck',        gm:'Subregión III', tec:'Conv', zonas:['pampeana_norte','pampeana_sur'],rend:106, est:'B', san:4, precoz:true, nota:'Precocidad ventajosa en fechas tardías · Escape a estreses', camp:2, dest:false },
    // SUBREGIÓN IV-V (Santa Fe norte, Entre Ríos, Córdoba)
    { nombre:'SY 120',          empresa:'Syngenta',    gm:'Subregión IV', tec:'Conv', zonas:['pampeana_norte','nea'],        rend:111, est:'A', san:4, precoz:false, nota:'Líder zona núcleo norte · Adaptado a mayor humedad · Gran estabilidad', camp:3, dest:true },
    { nombre:'BioINTA 3004',    empresa:'INTA',        gm:'Subregión IV', tec:'Conv', zonas:['pampeana_norte','nea'],        rend:105, est:'A', san:5, precoz:false, nota:'Cultivar público INTA · Excelente sanidad · Recomendado productores de bajo insumo', camp:5, dest:false },
    { nombre:'Klein Guerrero',  empresa:'Klein',       gm:'Subregión V',  tec:'Conv', zonas:['nea','pampeana_norte'],        rend:108, est:'B', san:4, precoz:false, nota:'Adaptado a zonas húmedas · Buen comportamiento en Entre Ríos', camp:3, dest:false },
    // SUBREGIÓN VI-VII (NOA)
    { nombre:'SY Matteo',       empresa:'Syngenta',    gm:'Subregión VI', tec:'Conv', zonas:['noa'],                        rend:110, est:'A', san:4, precoz:false, nota:'Referencia trigo NOA · Alta tolerancia a calor · Adaptación subtropical', camp:3, dest:true },
    { nombre:'BioINTA 1001',    empresa:'INTA',        gm:'Subregión VII', tec:'Conv', zonas:['noa'],                       rend:106, est:'B', san:4, precoz:false, nota:'Cultivar público INTA · Resistencia a enfermedades tropicales · Buena calidad industrial', camp:3, dest:false },
    // HB4 TRIGO
    { nombre:'SY 211 HB4',      empresa:'Syngenta+Bioceres', gm:'Subregión III', tec:'HB4', zonas:['pampeana_norte','semiarida'], rend:112, est:'A', san:4, precoz:false, nota:'Primer trigo HB4 del mundo · Tolerancia genética a sequía · Ventaja en años Niña · Aprobado UE 2024', camp:2, dest:true },
  ],

  Girasol: [
    { nombre:'Paraíso 20',      empresa:'Advanta',     gm:'Intermedio', tec:'CL',  zonas:['pampeana_norte','pampeana_sur','semiarida'], rend:110, est:'A', san:4, precoz:false, nota:'Referencia absoluta girasol pampeana · Alta oleicidad · ClearField para control malezas', camp:5, dest:true },
    { nombre:'SY 4045 CL',      empresa:'Syngenta',    gm:'Intermedio', tec:'CL',  zonas:['pampeana_norte','pampeana_sur'],             rend:108, est:'A', san:4, precoz:false, nota:'Muy buena estabilidad · Alto aceite · Resistente a Orobanche en CL', camp:4, dest:true },
    { nombre:'DK 4040 CL',      empresa:'Brevant',     gm:'Intermedio', tec:'CL',  zonas:['pampeana_sur','semiarida'],                  rend:106, est:'A', san:4, precoz:false, nota:'Excelente en zona sur · Tolerancia a sequía intermedia', camp:3, dest:false },
    { nombre:'Ambar CL',        empresa:'Don Mario',   gm:'Precoz',     tec:'CL',  zonas:['pampeana_sur','semiarida'],                  rend:104, est:'B', san:4, precoz:true, nota:'Alta precocidad · Escape a stress tardío · Recomendado fechas tardías', camp:2, dest:false },
    { nombre:'M6 Alto Oleico',  empresa:'Nidera/BASF', gm:'Tardío',     tec:'Conv',zonas:['pampeana_norte','nea'],                      rend:112, est:'B', san:3, precoz:false, nota:'Máximo oleico · Premium de precio · Requiere contrato con aceitera', camp:3, dest:false },
  ],
};

// ── LÓGICA DE RECOMENDACIÓN ──────────────────────────
function cvDetectarZona(lat) {
  if (lat === null) return null;
  if (lat > -29) return 'noa';
  if (lat > -32) return 'nea';
  if (lat > -35) return 'pampeana_norte';
  if (lat > -38) return 'pampeana_sur';
  return 'semiarida';
}

function cvActualizar() {
  const cultivo  = gv('cv-cultivo')    || 'Soja';
  const zona     = gv('cv-zona')       || 'pampeana_norte';
  const tipo     = gv('cv-tipo-siem')  || 'primera';
  const ambiente = gv('cv-ambiente')   || 'medio';
  const tec      = gv('cv-tecnologia') || 'todas';
  const empresa  = gv('cv-empresa')    || 'todas';
  const prior    = gv('cv-prioridad')  || 'rendimiento';
  const fechaStr = gv('cv-fecha')      || new Date().toISOString().split('T')[0];
  const fecha    = new Date(fechaStr);

  const zonaInfo = CV_ZONAS[zona];
  if (!zonaInfo) return;

  const cultivoCfg = zonaInfo.cultivos[cultivo];
  if (!cultivoCfg) {
    $('cv-zona-info').innerHTML = `<div class="alert warn"><span class="ai">⚠️</span><div class="ac">El cultivo ${cultivo} no tiene datos para la zona seleccionada en esta versión.</div></div>`;
    return;
  }

  // GMs recomendados
  const gmsRecom = cultivoCfg.gmPorTipo[tipo] || cultivoCfg.gms.slice(0,2);
  const gmsPorAmbiente = cultivoCfg.gmPorAmbiente[ambiente] || gmsRecom;
  const gmsFinal = [...new Set([...gmsRecom, ...gmsPorAmbiente])];

  // Panel de zona
  $('cv-zona-info').innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(74,140,92,.12),rgba(74,46,26,.06));border-radius:10px;padding:1rem;margin-bottom:.8rem;border:1px solid rgba(74,140,92,.2)">
      <div style="font-weight:700;color:var(--canopy);font-size:.95rem;margin-bottom:.4rem">📍 ${zonaInfo.label}</div>
      <div style="font-size:.78rem;color:rgba(74,46,26,.65);margin-bottom:.7rem">${zonaInfo.desc}</div>
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--earth);margin-bottom:.4rem">Grupos de Madurez recomendados:</div>
      <div style="display:flex;flex-wrap:wrap;gap:.4rem">
        ${gmsFinal.map(gm=>`<span style="background:${gmsRecom.includes(gm)?'var(--canopy)':'rgba(74,140,92,.3)'};color:${gmsRecom.includes(gm)?'white':'var(--field)'};padding:.25rem .7rem;border-radius:12px;font-size:.75rem;font-weight:600">${gm}${gmsRecom.includes(gm)?' ★':''}</span>`).join('')}
      </div>
      <div style="margin-top:.6rem;font-size:.72rem;color:rgba(74,46,26,.5)">★ = recomendado para siembra ${tipo} en ambiente ${ambiente} · Fuente: Andrade/Enrico (INTA Oliveros) 2024</div>
    </div>`;

  // Ventana de siembra
  const ventana = cultivoCfg.ventana[tipo] || cultivoCfg.ventana.primera;
  $('cv-ventana-card').classList.remove('hidden');

  // Calcular si la fecha ingresada está dentro de la ventana
  const mesNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const mesFecha = mesNombres[fecha.getMonth()];
  $('cv-ventana-info').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem;margin-bottom:.7rem">
      <div style="background:rgba(74,140,92,.08);border-radius:8px;padding:.8rem;border:1px solid rgba(74,140,92,.2)">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--leaf);font-weight:700;margin-bottom:.3rem">Ventana óptima</div>
        <div style="font-size:1rem;font-weight:700;color:var(--canopy)">${ventana}</div>
        <div style="font-size:.7rem;color:rgba(74,46,26,.5);margin-top:.2rem">Siembra de ${tipo}</div>
      </div>
      <div style="background:rgba(74,46,26,.05);border-radius:8px;padding:.8rem;border:1px solid var(--border)">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--earth);font-weight:700;margin-bottom:.3rem">Fecha planificada</div>
        <div style="font-size:1rem;font-weight:700;color:var(--ink)">${fecha.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}</div>
        <div style="font-size:.7rem;color:rgba(74,46,26,.5);margin-top:.2rem">${mesFecha} · verificar vs. ventana</div>
      </div>
    </div>
    <div class="alert info"><span class="ai">📅</span><div class="ac">
      <strong>GMs más precoces (ciclo corto)</strong> para fechas tardías o en ambientes de bajo potencial hídrico — escapan mejor al estrés de fin de ciclo.<br>
      <strong>GMs más tardíos (ciclo largo)</strong> para fechas tempranas y ambientes de alta calidad — mayor aprovechamiento de la radiación.
    </div></div>`;

  // RANKING DE CULTIVARES
  let cultivares = CV_DB[cultivo] || [];

  // Filtrar por zona
  cultivares = cultivares.filter(c => c.zonas.includes(zona));

  // Filtrar por GM recomendado para este tipo/ambiente
  const cultivaresPrincipales = cultivares.filter(c => gmsFinal.includes(c.gm));
  const cultivaresOtros = cultivares.filter(c => !gmsFinal.includes(c.gm));

  // Filtrar por tecnología
  if (tec !== 'todas') cultivares = cultivares.filter(c => c.tec.includes(tec));

  // Filtrar por empresa
  if (empresa !== 'todas') cultivares = cultivares.filter(c => c.empresa === empresa);

  // Recalcular después de filtros
  let listaFinal = cultivares.filter(c => gmsFinal.includes(c.gm));
  if (listaFinal.length === 0) listaFinal = cultivares;

  // Ordenar según prioridad
  listaFinal = listaFinal.sort((a, b) => {
    if (prior === 'rendimiento') return b.rend - a.rend;
    if (prior === 'estabilidad') return a.est.localeCompare(b.est) || b.rend - a.rend;
    if (prior === 'sanidad')    return b.san - a.san || b.rend - a.rend;
    if (prior === 'precoz')     return (b.precoz?1:0) - (a.precoz?1:0) || b.rend - a.rend;
    return b.rend - a.rend;
  });

  // Render ranking
  if (listaFinal.length === 0) {
    $('cv-ranking-content').innerHTML = `<div class="alert warn"><span class="ai">⚠️</span><div class="ac">No hay cultivares con esos filtros. Ampliá la búsqueda cambiando tecnología o empresa.</div></div>`;
    return;
  }

  $('cv-ranking-badge').textContent = `${listaFinal.length} cultivares · RECSO/RET 2024-25`;

  const estLabel = {'A':'🟢 Alta','B':'🟡 Media','C':'🔴 Baja'};
  const cards = listaFinal.map((c, i) => {
    const pos = i + 1;
    const medallla = pos===1?'🥇':pos===2?'🥈':pos===3?'🥉':`#${pos}`;
    const rendBar = Math.min(100, (c.rend - 95) * 10); // 95-115 → 0-100%
    const sanStars = '★'.repeat(c.san)+'☆'.repeat(5-c.san);
    return `
    <div style="border:${c.dest?'2px solid var(--grain)':'1px solid var(--border)'};border-radius:12px;padding:.9rem;margin-bottom:.7rem;background:${c.dest?'rgba(200,162,85,.05)':'white'}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.5rem">
        <div style="display:flex;align-items:center;gap:.6rem">
          <span style="font-size:1.2rem;min-width:28px">${medallla}</span>
          <div>
            <div style="font-weight:700;font-size:.92rem;color:var(--ink)">${c.nombre} ${c.dest?'⭐':''}</div>
            <div style="font-size:.72rem;color:rgba(74,46,26,.55)">${c.empresa} · ${c.gm} · ${c.tec}</div>
          </div>
        </div>
        <div style="text-align:right;min-width:60px">
          <div style="font-size:1.2rem;font-weight:700;color:${c.rend>=108?'var(--ok)':c.rend>=104?'var(--caution)':'var(--ink)'}">${c.rend}%</div>
          <div style="font-size:.65rem;color:rgba(74,46,26,.4)">vs. testigo</div>
        </div>
      </div>

      <!-- Barra de rendimiento -->
      <div style="height:6px;background:rgba(74,46,26,.08);border-radius:3px;margin-bottom:.5rem">
        <div style="height:100%;width:${rendBar}%;background:${c.rend>=108?'var(--ok)':c.rend>=104?'var(--caution)':'var(--blue)'};border-radius:3px;transition:width .5s"></div>
      </div>

      <div style="display:flex;gap:1rem;font-size:.72rem;color:rgba(74,46,26,.6);margin-bottom:.4rem;flex-wrap:wrap">
        <span>Estabilidad: ${estLabel[c.est]||c.est}</span>
        <span>Sanidad: <span style="color:${c.san>=4?'var(--ok)':c.san>=3?'var(--caution)':'var(--warn)'}">${sanStars}</span></span>
        ${c.precoz?'<span style="background:rgba(42,90,140,.1);color:#2A5A8C;padding:.1rem .5rem;border-radius:8px;font-weight:600">⚡ Precoz</span>':''}
        <span style="background:rgba(74,46,26,.07);padding:.1rem .5rem;border-radius:8px">${c.camp} camp. datos</span>
      </div>

      <div style="font-size:.73rem;color:rgba(74,46,26,.6);font-style:italic;line-height:1.4">${c.nota}</div>

      ${c.zonas.length>1?`<div style="margin-top:.4rem;font-size:.68rem;color:rgba(74,46,26,.4)">También recomendado en: ${c.zonas.filter(z=>z!==zona).map(z=>CV_ZONAS[z]?.label||z).join(', ')}</div>`:''}

      <!-- BOTONES ACCIÓN -->
      <div style="margin-top:.65rem;padding-top:.55rem;border-top:1px solid var(--border);display:flex;gap:.5rem;flex-wrap:wrap">
        <button onclick="dcSeleccionarCultivar('${c.nombre}','${c.empresa}','${cultivo}')"
          style="display:inline-flex;align-items:center;gap:.4rem;background:linear-gradient(135deg,#1A5C2A,#2D7A3A);color:white;border:none;border-radius:8px;padding:.4rem .9rem;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">
          🏪 ¿Dónde comprar?
        </button>
        <button onclick="cvAgregarComparador('${c.nombre}')"
          id="btn-comp-${c.nombre.replace(/\s/g,'_')}"
          style="display:inline-flex;align-items:center;gap:.4rem;background:rgba(42,90,140,.1);color:#2A5A8C;border:1px solid rgba(42,90,140,.25);border-radius:8px;padding:.4rem .9rem;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">
          ⚖️ Comparar
        </button>
      </div>
    </div>`;
  }).join('');

  // Alerta ENSO si está disponible
  let alertaEnso = '';
  if (ENSO_DATA.fase === 'nina' && cultivo === 'Soja') {
    alertaEnso = `<div class="alert warn" style="margin-bottom:.8rem"><span class="ai">🌊</span><div class="ac">
      <strong>Año Niña detectado</strong> — Priorizar cultivares con mayor precocidad o genética de tolerancia a sequía (HB4). Los GMs más cortos escapan mejor al déficit hídrico típico de fin de ciclo en años Niña.
    </div></div>`;
  } else if (ENSO_DATA.fase === 'nino' && cultivo === 'Soja') {
    alertaEnso = `<div class="alert ok" style="margin-bottom:.8rem"><span class="ai">🌊</span><div class="ac">
      <strong>Año Niño detectado</strong> — Mayor disponibilidad hídrica esperada. Los GMs más tardíos pueden aprovechar mejor la mayor radiación y agua disponible para maximizar rendimiento.
    </div></div>`;
  }

  $('cv-ranking-content').innerHTML = alertaEnso + cards;

  // Nota metodológica al final
  $('cv-ranking-content').innerHTML += `
    <div style="padding:.6rem .8rem;background:rgba(74,46,26,.04);border-radius:8px;font-size:.7rem;color:rgba(74,46,26,.4);margin-top:.5rem">
      📊 <strong>Metodología:</strong> Rendimiento relativo promedio (%) vs. testigo regional · RECSO (INTA Oliveros/Oliveros) campaña 2024/25 · 
      RET-INASE 2024/25 para trigo · Estabilidad = comportamiento en ambientes alto/medio/bajo · 
      Base de datos actualizable campaña por campaña.
    </div>`;
}

// ── SELECTOR DE CULTIVAR → DONDE COMPRAR ─────────────
function dcSeleccionarCultivar(cultivar, empresa, especie) {
  // Obtener coordenadas del lote si están disponibles
  let lat = null, lon = null;
  const coordTxt = $('s-coord')?.value || $('suelo-coord')?.value;
  if (coordTxt) {
    const parsed = parsCoord(coordTxt);
    lat = parsed[0]; lon = parsed[1];
  }
  cvRenderDondeComprar(cultivar, empresa, especie, lat, lon);
}

// ════════════════════════════════════════════════════════
// MÓDULO DÓNDE COMPRAR — DB DE DISTRIBUIDORES
// ════════════════════════════════════════════════════════
// Fuentes: RNCyFS-INASE + enriquecimiento manual
// Campos: nombre, tipo, provincia, partido, localidad,
//         lat, lon, tel, email, whatsapp, web,
//         empresas[], especies[], destacado, verified
// ════════════════════════════════════════════════════════
