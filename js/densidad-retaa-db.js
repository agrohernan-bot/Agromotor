// ════════════════════════════════════════════════════════
// js/densidad-retaa-db.js
// Base de datos ReTAA (Relevamiento de Tecnología Agrícola Aplicada,
// Bolsa de Cereales de Buenos Aires) — densidad de siembra OBSERVADA
// a campo por subregión, dosis N/P, nivel tecnológico y tendencia
// multicampaña. NO son recomendaciones teóricas: son datos relevados.
//
// Calidad del dato (campo `f`):
//   ◉ REAL     — número leído del PDF/mapa ReTAA
//   ◎ ESTIMADO — interpolado por comportamiento zonal
//   ◈ SORGO    — nacional confirmado, regional estimado por metodología ReTAA
//
// Fuente: prototipo retaa-v3 (H. Ferrari · Leaf Agrotronics / Crucianelli).
// Portado a AgroMotor como global de solo lectura. No escribe estado.
// ════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Subregiones ReTAA (bounding boxes lat/lon) ──────────
  var SR = [
    { id: 'noa',     nm: 'NOA',            color: '#F5A623', lat: [-28, -22],     lon: [-67, -62],   prov: 'Salta, Tucumán, Sgo. del Estero' },
    { id: 'nea_o',   nm: 'NEA OESTE',      color: '#E8682C', lat: [-28, -23],     lon: [-64, -60],   prov: 'Chaco, Santiago del Estero este, Formosa' },
    { id: 'nea_e',   nm: 'NEA ESTE',       color: '#D9701F', lat: [-28, -23],     lon: [-60, -55],   prov: 'Chaco este, Corrientes, Misiones' },
    { id: 'cn_cba',  nm: 'CENTRO-NORTE CBA', color: '#C2521C', lat: [-32, -29],   lon: [-65, -62],   prov: 'Córdoba norte' },
    { id: 'n_sf',    nm: 'NORTE SANTA FE', color: '#D9701F', lat: [-30, -27],     lon: [-63, -59],   prov: 'Norte Santa Fe' },
    { id: 's_cba',   nm: 'SUR CÓRDOBA',    color: '#B84A1A', lat: [-34, -32],     lon: [-65, -62],   prov: 'Sur Córdoba, Río Cuarto' },
    { id: 'nuc_n',   nm: 'NÚCLEO NORTE',   color: '#C2521C', lat: [-33.5, -31.5], lon: [-62.5, -60], prov: 'Sur Santa Fe, Córdoba SE' },
    { id: 'nuc_s',   nm: 'NÚCLEO SUR',     color: '#8B1A00', lat: [-34.8, -33],   lon: [-62, -59.5], prov: 'Norte Bs.As., Pergamino, San Nicolás' },
    { id: 'nlp_oba', nm: 'N.LA PAMPA–O.BA', color: '#E8682C', lat: [-37, -34.5],  lon: [-64, -62],   prov: 'Norte La Pampa, Oeste Bs.As.' },
    { id: 'o_ba',    nm: 'OESTE BS.AS.',   color: '#F5A623', lat: [-38, -35],     lon: [-63, -61],   prov: 'Oeste Bs.As., 9 de Julio' },
    { id: 'c_ba',    nm: 'CENTRO BS.AS.',  color: '#D9701F', lat: [-37, -35],     lon: [-61, -58.5], prov: 'Centro Bs.As., Bolívar, Azul' },
    { id: 'se_ba',   nm: 'SUDESTE BS.AS.', color: '#C2521C', lat: [-38.5, -36.5], lon: [-60, -57],   prov: 'Balcarce, Tandil, Necochea' },
    { id: 'so_ba',   nm: 'SUDOESTE BA–S.LP', color: '#D9701F', lat: [-40, -38],   lon: [-63.5, -61], prov: 'Bahía Blanca, Tres Arroyos, Sur LP' },
    { id: 'sal',     nm: 'CUENCA SALADO',  color: '#F5A623', lat: [-37, -35],     lon: [-59, -57],   prov: 'SE Bs.As., Dolores, Maipú' },
    { id: 'er',      nm: 'CENTRO-ESTE ER', color: '#8BC34A', lat: [-33, -30],     lon: [-60, -57.5], prov: 'Entre Ríos centro-este' }
  ];

  // ── Base ReTAA por cultivo ──────────────────────────────
  // Cada cultivo expone accesores puros (rv, adj, tendVal, f1, f2, rows)
  // que reciben (srData, fechaActiva, [ajuste]). Sin DOM, sin estado.
  var DB = {

    maiz: {
      emoji: '🌽', label: 'Maíz', unit: 'mil pl/ha', f1l: 'Nitrógeno',
      nac: [{ c: '2019/20', v: 49.3 }, { c: '2020/21', v: 51.4 }, { c: '2021/22', v: 63.0 }],
      nt: { a: 46, m: 52, b: 2 }, campActual: '2021/22', infActual: 'Nro.61',
      nota: '2021/22: 7.7 M ha (récord). Rinde 69.9 qq/ha (↓ sequía enero). Temprano 65.4k · Tardío 61.0k. SD 92%.',
      fechas: ['t', 'd'], flab: ['🌱 Temprano', '🍂 Tardío'],
      sr: {
        noa:     { camps: [{ c: '2021/22', t: 54.3, d: 51.2, f: '◉' }], n: 22, p: 4, nt: 'Medio' },
        nea_o:   { camps: [{ c: '2021/22', t: 55.7, d: 51.2, f: '◎' }], n: 22, p: 4, nt: 'Medio' },
        nea_e:   { camps: [{ c: '2021/22', t: 55.7, d: 64.3, f: '◉' }], n: 19, p: 2, nt: 'Medio' },
        cn_cba:  { camps: [{ c: '2021/22', t: 58.5, d: 62.5, f: '◉' }], n: 59, p: 7, nt: 'Medio' },
        n_sf:    { camps: [{ c: '2021/22', t: 59.8, d: 70.2, f: '◉' }], n: 35, p: 17, nt: 'Medio' },
        s_cba:   { camps: [{ c: '2021/22', t: 65.6, d: 64.0, f: '◉' }], n: 64, p: 19, nt: 'Alto' },
        nuc_n:   { camps: [{ c: '2021/22', t: 65.6, d: 64.0, f: '◉' }], n: 64, p: 19, nt: 'Alto' },
        nuc_s:   { camps: [{ c: '2021/22', t: 75.4, d: 70.2, f: '◉' }], n: 116, p: 25, nt: 'Alto' },
        nlp_oba: { camps: [{ c: '2021/22', t: 66.1, d: 61.4, f: '◉' }], n: 84, p: 21, nt: 'Alto' },
        o_ba:    { camps: [{ c: '2021/22', t: 69.0, d: 62.5, f: '◎' }], n: 62, p: 16, nt: 'Alto' },
        c_ba:    { camps: [{ c: '2021/22', t: 69.7, d: 69.6, f: '◉' }], n: 122, p: 25, nt: 'Alto' },
        se_ba:   { camps: [{ c: '2021/22', t: 77.3, d: 63.9, f: '◉' }], n: 92, p: 20, nt: 'Alto' },
        so_ba:   { camps: [{ c: '2021/22', t: 71.9, d: 60.0, f: '◉' }], n: 82, p: 15, nt: 'Medio-A' },
        sal:     { camps: [{ c: '2021/22', t: 68.0, d: 62.0, f: '◎' }], n: 74, p: 20, nt: 'Medio-A' },
        er:      { camps: [{ c: '2021/22', t: 66.1, d: 61.4, f: '◎' }], n: 60, p: 15, nt: 'Medio' }
      },
      rv: function (sr, fa) { return fa === 't' ? sr.camps[0].t : sr.camps[0].d; },
      adj: function (v, a, h) { return +(v * (a === 'a' ? 1.08 : a === 'b' ? 0.88 : 1) * (h === 's' ? 0.92 : h === 'h' ? 1.06 : 1)).toFixed(1); },
      tendVal: function (sr, fa) { return sr.camps.map(function (c) { return { c: c.c, v: fa === 't' ? c.t : c.d, f: c.f }; }); },
      f1: function (sr) { return sr.n; }, f2: function (sr) { return sr.p; },
      rows: function (sr, fa, adj) {
        return [
          { l: 'Densidad observada', v: (fa === 't' ? sr.camps[0].t : sr.camps[0].d) + ' mil pl/ha', f: sr.camps[0].f },
          { l: 'Ajustada a tu lote', v: adj + ' mil pl/ha' },
          { l: 'Semillas (logro 92%)', v: (adj / 0.92).toFixed(1) + ' mil sem/ha' },
          { l: 'N subregión', v: sr.n + ' kg N/ha' },
          { l: 'P subregión', v: sr.p + ' kg P/ha' },
          { l: 'Nivel tecnológico', v: sr.nt },
          { l: 'SD campaña', v: '92% del área ◉' },
          { l: 'Campaña', v: '2021/22 — disponible' }
        ];
      }
    },

    soja: {
      emoji: '🫛', label: 'Soja', unit: 'kg sem/ha', f1l: 'Fósforo (P)',
      nac: [{ c: '2019/20', v: 66 }, { c: '2020/21', v: 65 }, { c: '2021/22', v: 65 }, { c: '2022/23', v: 64 }],
      nt: { a: 31, m: 67, b: 3 }, campActual: '2021/22', infActual: 'Nro.62',
      nota: 'Tendencia nacional: densidad bajando paulatinamente (mejores semillas). 1°<2° por menor desarrollo vegetativo. P: 6 kg/ha 21/22 → 9 kg/ha 22/23.',
      fechas: ['p', 's'], flab: ['🌱 1° (temprana)', '🍂 2° (sobre trigo)'],
      sr: {
        noa:     { camps: [{ c: '2021/22', p: 59, s: 62, fP: 6, f: '◉' }, { c: '2022/23', p: 57, s: 60, fP: 6, f: '◎' }], n: 0, p: 6, nt: 'Medio' },
        nea_o:   { camps: [{ c: '2021/22', p: 59, s: 62, fP: 6, f: '◎' }, { c: '2022/23', p: 57, s: 60, fP: 6, f: '◎' }], n: 0, p: 6, nt: 'Medio' },
        nea_e:   { camps: [{ c: '2021/22', p: 53, s: 54, fP: 1, f: '◉' }, { c: '2022/23', p: 51, s: 52, fP: 1, f: '◎' }], n: 0, p: 1, nt: 'Medio' },
        cn_cba:  { camps: [{ c: '2021/22', p: 47, s: 47, fP: 2, f: '◉' }, { c: '2022/23', p: 45, s: 45, fP: 2, f: '◎' }], n: 0, p: 2, nt: 'Medio' },
        n_sf:    { camps: [{ c: '2021/22', p: 58, s: 65, fP: 3, f: '◉' }, { c: '2022/23', p: 56, s: 63, fP: 3, f: '◎' }], n: 0, p: 3, nt: 'Medio' },
        s_cba:   { camps: [{ c: '2021/22', p: 60, s: 62, fP: 3, f: '◉' }, { c: '2022/23', p: 58, s: 60, fP: 3, f: '◎' }], n: 0, p: 3, nt: 'Medio-A' },
        nuc_n:   { camps: [{ c: '2021/22', p: 63, s: 68, fP: 8, f: '◉' }, { c: '2022/23', p: 61, s: 66, fP: 9, f: '◎' }], n: 0, p: 8, nt: 'Alto' },
        nuc_s:   { camps: [{ c: '2021/22', p: 67, s: 73, fP: 13, f: '◉' }, { c: '2022/23', p: 65, s: 71, fP: 14, f: '◎' }], n: 0, p: 13, nt: 'Alto' },
        nlp_oba: { camps: [{ c: '2021/22', p: 62, s: 65, fP: 6, f: '◉' }, { c: '2022/23', p: 60, s: 63, fP: 7, f: '◎' }], n: 0, p: 6, nt: 'Medio-A' },
        o_ba:    { camps: [{ c: '2021/22', p: 62, s: 58, fP: 4, f: '◉' }, { c: '2022/23', p: 60, s: 56, fP: 5, f: '◎' }], n: 0, p: 4, nt: 'Medio' },
        c_ba:    { camps: [{ c: '2021/22', p: 70, s: 75, fP: 8, f: '◉' }, { c: '2022/23', p: 68, s: 73, fP: 9, f: '◎' }], n: 0, p: 8, nt: 'Alto' },
        se_ba:   { camps: [{ c: '2021/22', p: 74, s: 82, fP: 7, f: '◉' }, { c: '2022/23', p: 72, s: 80, fP: 8, f: '◎' }], n: 0, p: 7, nt: 'Alto' },
        so_ba:   { camps: [{ c: '2021/22', p: 54, s: 62, fP: 7, f: '◉' }, { c: '2022/23', p: 52, s: 60, fP: 8, f: '◎' }], n: 0, p: 7, nt: 'Medio' },
        sal:     { camps: [{ c: '2021/22', p: 61, s: 75, fP: 5, f: '◉' }, { c: '2022/23', p: 59, s: 73, fP: 6, f: '◎' }], n: 0, p: 5, nt: 'Medio' },
        er:      { camps: [{ c: '2021/22', p: 78, s: 84, fP: 6, f: '◉' }, { c: '2022/23', p: 76, s: 82, fP: 7, f: '◎' }], n: 0, p: 6, nt: 'Medio-A' }
      },
      rv: function (sr, fa) { return fa === 'p' ? sr.camps[0].p : sr.camps[0].s; },
      adj: function (v, a, h) { return Math.round(v * (a === 'a' ? 0.93 : a === 'b' ? 1.10 : 1) * (h === 's' ? 1.08 : h === 'h' ? 0.95 : 1)); },
      tendVal: function (sr, fa) { return sr.camps.map(function (c) { return { c: c.c, v: fa === 'p' ? c.p : c.s, f: c.f }; }); },
      f1: function (sr) { return sr.p; }, f2: function (sr) { return sr.p; },
      rows: function (sr, fa, adj) {
        return [
          { l: 'Densidad observada', v: (fa === 'p' ? sr.camps[0].p : sr.camps[0].s) + ' kg sem/ha', f: sr.camps[0].f },
          { l: 'Ajustada a tu lote', v: adj + ' kg sem/ha' },
          { l: 'P promedio subregión', v: sr.p + ' kg P/ha' },
          { l: 'Tendencia densidad', v: '↓ Nacional: 66→64 kg/ha (19/20→22/23)' },
          { l: 'NT 2021/22', v: 'Alto 31% · Medio 67% ◉' },
          { l: 'SD', v: '93% del área ◉' },
          { l: 'ER vs núcleo', v: '78/84 kg/ha — mayor del país ◉' },
          { l: 'Campañas en base', v: '2021/22 ◉ + 2022/23 ◎' }
        ];
      }
    },

    girasol: {
      emoji: '🌻', label: 'Girasol', unit: 'mil pl/ha', f1l: 'Nitrógeno (N)',
      nac: [{ c: '2019/20', v: 49.3 }, { c: '2020/21', v: 51.4 }, { c: '2021/22', v: 50.4 }, { c: '2022/23', v: 47.2 }, { c: '2023/24', v: 46.1 }],
      nt: { a: 33, m: 63, b: 4 }, campActual: '2022/23 + 2023/24', infActual: 'Nro.70 + Nro.77',
      nota: 'Tendencia nacional: densidad bajando 5 campañas consecutivas (51.4→46.1 mil pl/ha). 2022/23: sequía y escasez semillas. 2023/24: ↓2.4% adicional. TH 82% (máximo histórico). Alto oleico 19%.',
      fechas: ['a', 'b'], flab: ['🌻 Campaña 2022/23', '🌻 Campaña 2023/24'],
      sr: {
        noa:     { camps: [{ c: '2022/23', a: null, b: null, n22: null, p22: null, n23: null, p23: null, f: '◎' }], nt: 'Bajo' },
        nea_o:   { camps: [{ c: '2022/23', a: null, b: null, f: '◎' }], nt: 'Bajo' },
        nea_e:   { camps: [{ c: '2022/23', a: 48.385, b: 48.0, n22: 34, p22: 3, n23: 27, p23: 15, f: '◉' }], nt: 'Medio' },
        cn_cba:  { camps: [{ c: '2022/23', a: 54.800, b: 47.0, n22: 25, p22: 6, n23: 23, p23: 4, f: '◉' }], nt: 'Medio' },
        n_sf:    { camps: [{ c: '2022/23', a: 50.375, b: 50.2, n22: 35, p22: 9, n23: 38, p23: 7, f: '◉' }], nt: 'Medio' },
        s_cba:   { camps: [{ c: '2022/23', a: 52.729, b: 52.3, n22: 43, p22: 9, n23: 38, p23: 6, f: '◉' }], nt: 'Medio-A' },
        nuc_n:   { camps: [{ c: '2022/23', a: 50.270, b: 47.0, n22: 26, p22: 15, n23: 23, p23: 4, f: '◉' }], nt: 'Medio' },
        nuc_s:   { camps: [{ c: '2022/23', a: 50.000, b: 48.2, n22: 25, p22: 10, n23: 13, p23: 11, f: '◉' }], nt: 'Medio' },
        nlp_oba: { camps: [{ c: '2022/23', a: 50.270, b: 50.5, n22: 13, p22: 10, n23: 13, p23: 11, f: '◉' }], nt: 'Medio' },
        o_ba:    { camps: [{ c: '2022/23', a: 49.025, b: 48.6, n22: 13, p22: 10, n23: 13, p23: 11, f: '◉' }], nt: 'Medio' },
        c_ba:    { camps: [{ c: '2022/23', a: 49.025, b: 48.6, n22: 20, p22: 10, n23: 22, p23: 11, f: '◉' }], nt: 'Medio' },
        se_ba:   { camps: [{ c: '2022/23', a: 55.664, b: 50.5, n22: 20, p22: 12, n23: 20, p23: 13, f: '◉' }], nt: 'Alto' },
        so_ba:   { camps: [{ c: '2022/23', a: 38.180, b: 46.2, n22: 13, p22: 11, n23: 18, p23: 12, f: '◉' }], nt: 'Medio' },
        sal:     { camps: [{ c: '2022/23', a: 47.720, b: 40.9, n22: 20, p22: 11, n23: 16, p23: 12, f: '◉' }], nt: 'Medio' },
        er:      { camps: [{ c: '2022/23', a: null, b: null, f: '◎' }], nt: 'Bajo-M' }
      },
      rv: function (sr, fa) { var v = fa === 'a' ? sr.camps[0].a : sr.camps[0].b; return v || 47.0; },
      adj: function (v, a, h) { return +(v * (a === 'a' ? 1.05 : a === 'b' ? 0.88 : 1) * (h === 's' ? 0.90 : h === 'h' ? 1.06 : 1)).toFixed(1); },
      tendVal: function (sr, fa) { return sr.camps.map(function (c) { return { c: c.c, v: fa === 'a' ? (c.a || 47.2) : (c.b || 46.1), f: c.f }; }); },
      f1: function (sr, fa) { return fa === 'a' ? sr.camps[0].n22 : sr.camps[0].n23; },
      f2: function (sr, fa) { return fa === 'a' ? sr.camps[0].p22 : sr.camps[0].p23; },
      rows: function (sr, fa, adj) {
        var v = fa === 'a' ? sr.camps[0].a : sr.camps[0].b;
        var n = fa === 'a' ? sr.camps[0].n22 : sr.camps[0].n23;
        var p = fa === 'a' ? sr.camps[0].p22 : sr.camps[0].p23;
        return [
          { l: 'Densidad observada', v: v ? v + ' mil pl/ha' : 'Sin área relevada', f: sr.camps[0].f },
          { l: 'Ajustada a tu lote', v: adj + ' mil pl/ha' },
          { l: 'Semillas (logro 88%)', v: (adj / 0.88).toFixed(1) + ' mil sem/ha' },
          { l: 'N promedio subregión', v: n ? n + ' kg N/ha' : 'Sin datos' },
          { l: 'P promedio subregión', v: p ? p + ' kg P/ha' : 'Sin datos' },
          { l: 'NT campaña', v: sr.nt },
          { l: 'TH 2023/24', v: '82% — máximo histórico ◉' },
          { l: 'Tendencia densidad', v: '↓ 5 campañas consecutivas' }
        ];
      }
    },

    trigo: {
      emoji: '🌾', label: 'Trigo', unit: 'kg sem/ha', f1l: 'Nitrógeno (N)',
      nac: [{ c: '2017/18', v: 105 }, { c: '2018/19', v: 106 }, { c: '2019/20', v: 108 }, { c: '2020/21', v: 109 }, { c: '2021/22', v: 113 }, { c: '2022/23', v: 110 }, { c: '2023/24', v: 116 }],
      nt: { a: 32, m: 54, b: 14 }, campActual: '2023/24', infActual: 'Nro.75',
      nota: 'Tendencia ↑: densidad nacional subió 11 kg/ha en 7 campañas (105→116). 2023/24: retraso de fecha → mayor densidad compensatoria. N 78 kg/ha · P 14 kg/ha. SE Bs.As. = mayor densidad del país (157 kg/ha).',
      fechas: ['o', 't'], flab: ['📅 Fecha óptima', '📅 Fecha tardía (+densidad)'],
      sr: {
        noa:     { camps: [{ c: '2023/24', o: 70, t: 80, n: 16, p: 7, f: '◉' }], nt: 'Bajo' },
        nea_o:   { camps: [{ c: '2023/24', o: 70, t: 80, n: 16, p: 7, f: '◎' }], nt: 'Bajo' },
        nea_e:   { camps: [{ c: '2023/24', o: 68, t: 78, n: 43, p: 1, f: '◉' }], nt: 'Bajo-M' },
        cn_cba:  { camps: [{ c: '2023/24', o: 78, t: 90, n: 36, p: 2, f: '◉' }], nt: 'Medio' },
        n_sf:    { camps: [{ c: '2023/24', o: 100, t: 115, n: 44, p: 7, f: '◉' }], nt: 'Medio' },
        s_cba:   { camps: [{ c: '2023/24', o: 115, t: 130, n: 44, p: 6, f: '◉' }], nt: 'Medio-A' },
        nuc_n:   { camps: [{ c: '2023/24', o: 112, t: 127, n: 61, p: 9, f: '◉' }], nt: 'Medio-A' },
        nuc_s:   { camps: [{ c: '2023/24', o: 136, t: 152, n: 107, p: 14, f: '◉' }], nt: 'Alto' },
        nlp_oba: { camps: [{ c: '2023/24', o: 124, t: 140, n: 73, p: 7, f: '◉' }], nt: 'Medio-A' },
        o_ba:    { camps: [{ c: '2023/24', o: 120, t: 136, n: 60, p: 13, f: '◉' }], nt: 'Medio' },
        c_ba:    { camps: [{ c: '2023/24', o: 129, t: 145, n: 108, p: 21, f: '◉' }], nt: 'Alto' },
        se_ba:   { camps: [{ c: '2023/24', o: 157, t: 175, n: 97, p: 21, f: '◉' }], nt: 'Alto' },
        so_ba:   { camps: [{ c: '2023/24', o: 84, t: 96, n: 92, p: 17, f: '◉' }], nt: 'Medio-A' },
        sal:     { camps: [{ c: '2023/24', o: 117, t: 132, n: 104, p: 17, f: '◉' }], nt: 'Medio' },
        er:      { camps: [{ c: '2023/24', o: 118, t: 133, n: 54, p: 13, f: '◉' }], nt: 'Medio' }
      },
      rv: function (sr, fa) { return fa === 'o' ? sr.camps[0].o : sr.camps[0].t; },
      adj: function (v, a, h) { return Math.round(v * (a === 'a' ? 0.96 : a === 'b' ? 1.07 : 1) * (h === 's' ? 1.04 : h === 'h' ? 0.97 : 1)); },
      tendVal: function (sr, fa) { return sr.camps.map(function (c) { return { c: c.c, v: fa === 'o' ? c.o : c.t, f: c.f }; }); },
      f1: function (sr) { return sr.camps[0].n; }, f2: function (sr) { return sr.camps[0].p; },
      rows: function (sr, fa, adj) {
        return [
          { l: 'Densidad referencia', v: (fa === 'o' ? sr.camps[0].o : sr.camps[0].t) + ' kg sem/ha', f: sr.camps[0].f },
          { l: 'Ajustada a tu lote', v: adj + ' kg sem/ha' },
          { l: 'Nacional 2023/24', v: '116 kg/ha ◉' },
          { l: 'N promedio subregión', v: sr.camps[0].n + ' kg N/ha' },
          { l: 'P promedio subregión', v: sr.camps[0].p + ' kg P/ha' },
          { l: 'NT', v: sr.nt },
          { l: 'SD', v: '88% del área ◉' },
          { l: 'Clave rendimiento', v: 'Fecha siembra > densidad' }
        ];
      }
    },

    cebada: {
      emoji: '🍺', label: 'Cebada', unit: 'kg sem/ha', f1l: 'Nitrógeno (N)',
      nac: [{ c: '2016/17', v: 119 }, { c: '2017/18', v: 113 }, { c: '2018/19', v: 112 }, { c: '2019/20', v: 115 }, { c: '2020/21', v: 116 }, { c: '2021/22', v: 119 }, { c: '2022/23', v: 116 }],
      nt: { a: 42, m: 56, b: 2 }, campActual: '2022/23', infActual: 'Nro.69',
      nota: 'Densidad nacional muy estable históricamente (112-119 kg/ha en 7 campañas). 2022/23: ↓3 kg/ha por sequía. Solo 5 regiones con área relevante. SO BA–S.LP: 99 kg/ha (menor del país). Centro BA: 132 kg/ha (mayor). Calidad maltera: proteína 9-11.5%.',
      fechas: ['o', 't'], flab: ['📅 Fecha óptima', '📅 Fecha tardía'],
      sr: {
        noa:     { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' },
        nea_o:   { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' },
        nea_e:   { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' },
        cn_cba:  { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' },
        n_sf:    { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' },
        s_cba:   { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' },
        nuc_n:   { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' },
        nuc_s:   { camps: [{ c: '2022/23', o: 123, t: 135, n: 99, p: 24, f: '◉' }], nt: 'Alto' },
        nlp_oba: { camps: [{ c: '2022/23', o: 117, t: 128, n: 82, p: 17, f: '◉' }], nt: 'Medio-A' },
        o_ba:    { camps: [{ c: '2022/23', o: 115, t: 126, n: 80, p: 15, f: '◎' }], nt: 'Medio' },
        c_ba:    { camps: [{ c: '2022/23', o: 127, t: 139, n: 87, p: 16, f: '◉' }], nt: 'Alto' },
        se_ba:   { camps: [{ c: '2022/23', o: 118, t: 130, n: 98, p: 19, f: '◉' }], nt: 'Alto' },
        so_ba:   { camps: [{ c: '2022/23', o: 99, t: 110, n: 70, p: 12, f: '◉' }], nt: 'Medio' },
        sal:     { camps: [{ c: '2022/23', o: 113, t: 124, n: 80, p: 15, f: '◎' }], nt: 'Medio' },
        er:      { camps: [{ c: '2022/23', o: null, t: null, n: null, p: null, f: '◎' }], nt: '—' }
      },
      rv: function (sr, fa) { var v = fa === 'o' ? sr.camps[0].o : sr.camps[0].t; return v || 116; },
      adj: function (v, a, h) { return Math.round(v * (a === 'a' ? 0.96 : a === 'b' ? 1.07 : 1) * (h === 's' ? 1.05 : h === 'h' ? 0.97 : 1)); },
      tendVal: function (sr, fa) { return sr.camps.map(function (c) { return { c: c.c, v: (fa === 'o' ? c.o : c.t) || 116, f: c.f }; }); },
      f1: function (sr) { return sr.camps[0].n; }, f2: function (sr) { return sr.camps[0].p; },
      rows: function (sr, fa, adj) {
        var v = fa === 'o' ? sr.camps[0].o : sr.camps[0].t;
        return [
          { l: 'Densidad referencia', v: v ? v + ' kg sem/ha' : 'Sin área (zona marginal)', f: sr.camps[0].f },
          { l: 'Ajustada a tu lote', v: adj + ' kg sem/ha' },
          { l: 'Nacional 2022/23', v: '116 kg/ha ◉ (histórico estable)' },
          { l: 'N promedio', v: sr.camps[0].n ? sr.camps[0].n + ' kg N/ha' : 'Sin datos' },
          { l: 'P promedio', v: sr.camps[0].p ? sr.camps[0].p + ' kg P/ha' : 'Sin datos' },
          { l: 'NT', v: sr.nt || 'Sin datos' },
          { l: 'Calidad maltera', v: 'Proteína 9-11.5%, calibre >2.5mm' },
          { l: 'Tendencia densidad', v: 'Muy estable 7 campañas (±7 kg/ha)' }
        ];
      }
    },

    sorgo: {
      emoji: '🌿', label: 'Sorgo', unit: 'mil pl/ha', f1l: 'Nitrógeno (N)',
      nac: [{ c: '2019/20', v: 220 }, { c: '2020/21', v: 211.5 }, { c: '2021/22', v: 200 }, { c: '2022/23', v: 195 }, { c: '2023/24', v: 190 }],
      nt: { a: 8, m: 61, b: 31 }, campActual: '2023/24', infActual: '◈ Estimado (nacional ◉)',
      nota: 'Nacional 2023/24: 190.000 pl/ha ◉ (Bolsa de Cereales vía Infocampo, nov 2024). 2020/21: 211.500 pl/ha ◉. Tendencia: ↓ 21.5k en 4 campañas. "Densidades más bajas en ciclos largos y zonas de baja disponibilidad hídrica" (ReTAA). N: 26 kg/ha (+7 vs campaña previa) · P: 6 kg/ha. SD 88%. NT bajo: 31% (el más alto de todos los cultivos). Valores regionales estimados por metodología ReTAA.',
      fechas: null,
      sr: {
        noa:     { camps: [{ c: '2023/24', v: 155, n: 18, p: 5, f: '◈' }], nt: 'Bajo' },
        nea_o:   { camps: [{ c: '2023/24', v: 165, n: 20, p: 5, f: '◈' }], nt: 'Bajo-M' },
        nea_e:   { camps: [{ c: '2023/24', v: 170, n: 20, p: 5, f: '◈' }], nt: 'Bajo-M' },
        cn_cba:  { camps: [{ c: '2023/24', v: 185, n: 24, p: 6, f: '◈' }], nt: 'Medio' },
        n_sf:    { camps: [{ c: '2023/24', v: 180, n: 22, p: 5, f: '◈' }], nt: 'Medio' },
        s_cba:   { camps: [{ c: '2023/24', v: 190, n: 26, p: 6, f: '◈' }], nt: 'Medio' },
        nuc_n:   { camps: [{ c: '2023/24', v: 195, n: 27, p: 6, f: '◈' }], nt: 'Medio' },
        nuc_s:   { camps: [{ c: '2023/24', v: 200, n: 28, p: 7, f: '◈' }], nt: 'Medio-A' },
        nlp_oba: { camps: [{ c: '2023/24', v: 185, n: 25, p: 6, f: '◈' }], nt: 'Medio' },
        o_ba:    { camps: [{ c: '2023/24', v: 188, n: 25, p: 6, f: '◈' }], nt: 'Medio' },
        c_ba:    { camps: [{ c: '2023/24', v: 192, n: 26, p: 6, f: '◈' }], nt: 'Medio' },
        se_ba:   { camps: [{ c: '2023/24', v: 195, n: 27, p: 6, f: '◈' }], nt: 'Medio' },
        so_ba:   { camps: [{ c: '2023/24', v: 185, n: 24, p: 6, f: '◈' }], nt: 'Medio' },
        sal:     { camps: [{ c: '2023/24', v: 188, n: 25, p: 6, f: '◈' }], nt: 'Bajo-M' },
        er:      { camps: [{ c: '2023/24', v: 178, n: 22, p: 5, f: '◈' }], nt: 'Bajo-M' }
      },
      // Valores `v` ya están en mil pl/ha (190 = 190.000 pl/ha), como maíz.
      rv: function (sr) { return sr.camps[0].v; },
      adj: function (v, a, h) { return +(v * (a === 'a' ? 1.10 : a === 'b' ? 0.85 : 1) * (h === 's' ? 0.88 : h === 'h' ? 1.08 : 1)).toFixed(1); },
      tendVal: function (sr) { return sr.camps.map(function (c) { return { c: c.c, v: c.v, f: c.f }; }); },
      f1: function (sr) { return sr.camps[0].n; }, f2: function (sr) { return sr.camps[0].p; },
      rows: function (sr, _fa, adj) {
        return [
          { l: 'Densidad estimada subregión', v: sr.camps[0].v.toFixed(1) + ' mil pl/ha', f: sr.camps[0].f },
          { l: 'Ajustada a tu lote', v: adj + ' mil pl/ha' },
          { l: 'Semillas (logro 80%)', v: (adj / 0.80).toFixed(1) + ' mil sem/ha' },
          { l: 'Nacional 2023/24', v: '190 mil pl/ha ◉' },
          { l: 'N promedio subregión', v: sr.camps[0].n + ' kg N/ha' },
          { l: 'P promedio subregión', v: sr.camps[0].p + ' kg P/ha' },
          { l: 'NT', v: sr.nt + ' (◈ estimado)' },
          { l: 'Advertencia', v: 'Datos regionales estimados — pedir PDF ReTAA sorgo' }
        ];
      }
    }

  };

  // Exponer como global de solo lectura (patrón AgroMotor).
  if (typeof window !== 'undefined') window.AM_RETAA_DB = { SR: SR, DB: DB };

  // Soporte de test en node (module.exports si existe).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SR: SR, DB: DB };
  }
})();
