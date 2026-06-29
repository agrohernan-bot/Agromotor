const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCore() {
  const context = {
    console,
    setTimeout() { return 0; },
    clearTimeout() {},
    Event: function Event(type) { this.type = type; },
    document: {
      getElementById() { return null; },
      addEventListener() {},
    },
    navigator: {},
  };
  context.window = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'core.js' });
  return context;
}

test('convierte humedad volumetrica a agua util sin densidad aparente', () => {
  const ctx = loadCore();
  const perfil = ctx.amSoilWaterProfile([
    { theta: 23, depthCm: 6 },
    { theta: 25, depthCm: 18 },
    { theta: 29, depthCm: 54 },
  ], 'Molisol');

  assert.equal(Math.round(perfil.aguaUtilMm), 122);
  assert.equal(Math.round(perfil.capacidadUtilMm), 172);
  assert.equal(Math.round(perfil.pct), 71);
});

test('PMP es cero agua util y CC es cien por ciento', () => {
  const ctx = loadCore();
  const t = ctx.amSoilWaterThresholds('Vertisol');
  const enPmp = ctx.amSoilWaterProfile([{ theta:t.pmp, depthCm:78 }], 'Vertisol');
  const enCc = ctx.amSoilWaterProfile([{ theta:t.cc, depthCm:78 }], 'Vertisol');

  assert.equal(enPmp.pct, 0);
  assert.equal(enPmp.aguaUtilMm, 0);
  assert.equal(enCc.pct, 100);
  assert.equal(enCc.aguaUtilMm, enCc.capacidadUtilMm);
  assert.equal(enPmp.critica, t.pmp + 0.5 * (t.cc - t.pmp));
});

test('PTF SoilGrids produce umbrales fisicamente consistentes', () => {
  const ctx = loadCore();
  const t = ctx.amSoilWaterThresholds('Molisol', {
    sand: 40,
    clay: 25,
    soc: 15,
  });

  assert.ok(t.pmp >= 0.02);
  assert.ok(t.cc > t.pmp);
  assert.ok(t.cc <= 0.60);
  assert.equal(t.fuente, 'soilgrids-ptf');
});

test('prioriza CC y PMP de laboratorio y deriva humedad gravimetrica', () => {
  const ctx = loadCore();
  const perfil = ctx.amSoilWaterProfile([{ theta:0.20, depthCm:78 }], 'Molisol', {
    cc:34, pmp:12, da:1.25, sand:40, clay:25, soc:15,
  });

  assert.equal(perfil.fuenteUmbrales, 'laboratorio');
  assert.equal(perfil.cc, 0.34);
  assert.equal(perfil.pmp, 0.12);
  assert.equal(Math.round(perfil.aguaTotalMm), 156);
  assert.equal(Math.round(perfil.aguaUtilMm), 62);
  assert.equal(Math.round(perfil.humedadGravimetrica * 100), 16);
});

test('umbral de estres usa cultivo y demanda FAO-56', () => {
  const ctx = loadCore();
  const bajaDemanda = ctx.amSoilWaterDepletion('Maíz', 2, 1);
  const altaDemanda = ctx.amSoilWaterDepletion('Maíz', 7, 1);

  assert.equal(bajaDemanda.pTabla, 0.55);
  assert.ok(bajaDemanda.p > altaDemanda.p);
  assert.equal(Number(bajaDemanda.p.toFixed(2)), 0.67);
  assert.equal(Number(altaDemanda.p.toFixed(2)), 0.47);
});

test('convierte CC y PMP gravimetricos con densidad aparente', () => {
  const ctx = loadCore();
  const t = ctx.amSoilWaterThresholds('Molisol', {
    cc:25,
    pmp:10,
    da:1.30,
    retencionBase:'gravimetrica',
  });

  assert.equal(t.fuente, 'laboratorio');
  assert.equal(Number(t.cc.toFixed(3)), 0.325);
  assert.equal(Number(t.pmp.toFixed(3)), 0.130);
});

test('pondera propiedades SoilGrids por profundidad', () => {
  const ctx = loadCore();
  const sg = {
    horizontes:[
      {top:0,bottom:5,clay:20,sand:50,soc:20,da:1.20},
      {top:5,bottom:15,clay:30,sand:40,soc:15,da:1.30},
    ],
  };
  const capa = ctx.amSoilAtDepth(sg, 3, 9);

  assert.equal(Number(capa.clay.toFixed(2)), 26.67);
  assert.equal(Number(capa.sand.toFixed(2)), 43.33);
  assert.equal(Number(capa.da.toFixed(3)), 1.267);
});

test('autonomia usa inicio de estres y ETc del cultivo', () => {
  const ctx = loadCore();
  const perfil = {
    aguaUtilMm:30,
    capacidadUtilMm:40,
    umbralUtilMm:20,
    pct:75,
    estado:'disponible',
  };
  const dias = Array.from({length:12}, (_, i) => ({
    fecha:`2026-07-${String(i+1).padStart(2, '0')}`,
    et0:4,
    kc:0.5,
    precipitacion:0,
    probabilidad:0,
  }));
  const out = ctx.amSoilWaterOutlook(perfil, dias, { cultivo:'trigo', horizonte:12 });

  assert.equal(out.diasSinLluvia, 9);
  assert.equal(out.diasConPronostico, 9);
  assert.equal(out.diasOperativos, 9);
  assert.equal(out.serie[0].etc, 2);
});

test('lluvia probable anterior al umbral extiende la autonomia', () => {
  const ctx = loadCore();
  const perfil = {
    aguaUtilMm:30,
    capacidadUtilMm:40,
    umbralUtilMm:20,
    pct:75,
    estado:'disponible',
  };
  const dias = Array.from({length:16}, (_, i) => ({
    fecha:`2026-07-${String(i+1).padStart(2, '0')}`,
    et0:4,
    kc:0.5,
    precipitacion:i === 2 ? 20 : 0,
    probabilidad:i === 2 ? 80 : 0,
  }));
  const out = ctx.amSoilWaterOutlook(perfil, dias, {
    cultivo:'trigo',
    horizonte:16,
    factorInfiltracion:0.8,
  });

  assert.equal(out.diasSinLluvia, 9);
  assert.ok(out.diasConPronostico == null || out.diasConPronostico > out.diasSinLluvia);
  assert.equal(out.lluviaPuente.dia, 3);
  assert.equal(out.puente, 'antes');
});

test('autonomia operativa toma el horizonte conservador si los modelos divergen', () => {
  const ctx = loadCore();
  const perfil = {
    aguaUtilMm:30,
    capacidadUtilMm:40,
    umbralUtilMm:20,
    pct:75,
    estado:'disponible',
  };
  const dias = Array.from({length:12}, (_, i) => ({
    fecha:`2026-07-${String(i+1).padStart(2, '0')}`,
    et0:4,
    kc:0.5,
    precipitacion:0,
    probabilidad:0,
    modeloPerfil:{ pct:i >= 2 ? 20 : 70, pctCritico:33 },
  }));
  const out = ctx.amSoilWaterOutlook(perfil, dias, { cultivo:'trigo', horizonte:12 });

  assert.equal(out.diasConPronostico, 9);
  assert.equal(out.diasModelo, 3);
  assert.equal(out.diasOperativos, 3);
});

test('riego registrado repone agua sin ponderacion probabilistica', () => {
  const ctx = loadCore();
  const perfil = {
    aguaUtilMm:30,
    capacidadUtilMm:40,
    umbralUtilMm:20,
    pct:75,
    estado:'disponible',
  };
  const dias = Array.from({length:12}, (_, i) => ({
    fecha:`2026-07-${String(i+1).padStart(2, '0')}`,
    et0:4,
    kc:0.5,
    precipitacion:0,
    probabilidad:0,
    riegoMm:i === 2 ? 10 : 0,
    eficienciaRiego:.8,
  }));
  const out = ctx.amSoilWaterOutlook(perfil, dias, { cultivo:'trigo', horizonte:12 });

  assert.equal(out.diasSinLluvia, 9);
  assert.ok(out.diasConPronostico == null || out.diasConPronostico > 9);
  assert.equal(out.serie[2].riegoEfectivo, 8);
});

test('etapa hidrica ajusta Kc y profundidad radicular con el avance', () => {
  const ctx = loadCore();
  const inicial = ctx.amCropWaterStage('trigo', 5, 190);
  const macollaje = ctx.amCropWaterStage('trigo', 45, 190);
  const llenado = ctx.amCropWaterStage('trigo', 120, 190);

  assert.ok(macollaje.raizCm > inicial.raizCm);
  assert.ok(macollaje.kc > inicial.kc);
  assert.ok(llenado.raizCm >= macollaje.raizCm);
});
