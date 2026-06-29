import { createClient } from 'npm:@supabase/supabase-js@2.108.2'

type Json = Record<string, unknown>
type Layers = { sm39: number | null; sm927: number | null; sm2781: number | null }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function num(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function coordinates(data: Json): { lat: number; lon: number } | null {
  const raw = data.coord
  if (typeof raw === 'string') {
    const parts = raw.split(/[,\s]+/).map(Number)
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { lat: parts[0], lon: parts[1] }
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Json
    const lat = num(obj.lat ?? obj.latitude)
    const lon = num(obj.lng ?? obj.lon ?? obj.longitude)
    if (lat != null && lon != null) return { lat, lon }
  }
  const geo = data.geojson as Json | undefined
  const geometry = geo?.geometry as Json | undefined
  const coords = geometry?.coordinates
  if (Array.isArray(coords)) {
    const flat: number[][] = []
    const walk = (value: unknown) => {
      if (Array.isArray(value) && value.length >= 2 &&
          typeof value[0] === 'number' && typeof value[1] === 'number') {
        flat.push(value as number[])
      } else if (Array.isArray(value)) value.forEach(walk)
    }
    walk(coords)
    if (flat.length) {
      return {
        lat: flat.reduce((sum, p) => sum + p[1], 0) / flat.length,
        lon: flat.reduce((sum, p) => sum + p[0], 0) / flat.length,
      }
    }
  }
  return null
}

function soilThresholds(data: Json) {
  const soil = String(data['sg-textura'] || (data.calcKeys as Json | undefined)?.am_siembra_suelo || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const presets: Record<string, { cc: number; pmp: number }> = {
    molisol:{ cc:.34, pmp:.12 }, vertisol:{ cc:.36, pmp:.20 },
    alfisol:{ cc:.36, pmp:.16 }, entisol:{ cc:.18, pmp:.07 },
    oxisol:{ cc:.26, pmp:.10 },
  }
  let result = presets[soil] || { cc:.34, pmp:.14 }
  const sg = (data.sgDatos || {}) as Json
  const lab = (data.labDatos || {}) as Json
  let ccLab = num(lab.cc)
  let pmpLab = num(lab.pmp)
  if (ccLab != null && ccLab > 1) ccLab /= 100
  if (pmpLab != null && pmpLab > 1) pmpLab /= 100
  if (ccLab != null && pmpLab != null && pmpLab >= .01 && ccLab <= .7 && ccLab-pmpLab >= .03) {
    return { cc:ccLab, pmp:pmpLab, source:'laboratory' }
  }
  const sand = num(sg.sand ?? data['sg-sand'])
  const clay = num(sg.clay ?? data['sg-clay'])
  const soc = num(sg.soc ?? data['sg-soc'])
  if (sand != null && clay != null && sand >= 0 && clay >= 0 && sand+clay <= 105) {
    const S = sand/100
    const C = clay/100
    const OM = soc != null ? Math.max(0, soc*.1724) : 2.5
    const wpT = -.024*S + .487*C + .006*OM + .005*S*OM - .013*C*OM + .068*S*C + .031
    const fcT = -.251*S + .195*C + .011*OM + .006*S*OM - .027*C*OM + .452*S*C + .299
    const pmp = wpT + .14*wpT - .02
    const cc = fcT + 1.283*fcT*fcT - .374*fcT - .015
    if (Number.isFinite(cc) && Number.isFinite(pmp) && pmp >= .02 && cc <= .6 && cc-pmp >= .05) {
      result = { cc, pmp }
      return { ...result, source:'soilgrids-ptf' }
    }
  }
  return { ...result, source:'soil-type' }
}

function cropStage(data: Json, offsetDays = 0) {
  const ck = (data.calcKeys || {}) as Json
  const crop = String(data.cultivo || ck.am_siembra_cultivo || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const cfg: Record<string, { ini:number; mid:number; end:number }> = {
    soja:{ini:.30,mid:1.15,end:.35}, maiz:{ini:.30,mid:1.20,end:.40},
    trigo:{ini:.30,mid:1.15,end:.30}, cebada:{ini:.30,mid:1.10,end:.30},
    girasol:{ini:.35,mid:1.15,end:.45}, sorgo:{ini:.30,mid:1.10,end:.40},
    colza:{ini:.35,mid:1.10,end:.35},
  }
  const c = cfg[crop] || { ini:.30, mid:1.10, end:.40 }
  const sowing = String(data.fechaSiembra || ck.am_siembra_fecha || '')
  const sowingMs = Date.parse(sowing + 'T12:00:00Z')
  const elapsed = Number.isFinite(sowingMs)
    ? Math.max(0, Math.round((Date.now()-sowingMs)/86400000)+offsetDays) : offsetDays
  const cycle = Math.max(30, num(ck.am_fen_duracion_ciclo) || 150)
  const progress = Math.max(0, Math.min(1, elapsed/cycle))
  let kc = c.ini
  if (progress > .15 && progress < .40) kc = c.ini+(c.mid-c.ini)*((progress-.15)/.25)
  else if (progress >= .40 && progress <= .75) kc = c.mid
  else if (progress > .75) kc = c.mid+(c.end-c.mid)*((progress-.75)/.25)
  return { crop, kc, progress }
}

function profilePct(layers: Layers, thresholds: { cc:number; pmp:number }) {
  const values = [layers.sm39, layers.sm927, layers.sm2781]
  const depths = [6, 18, 54]
  let useful = 0
  let capacity = 0
  let total = 0
  let depth = 0
  values.forEach((theta, idx) => {
    if (theta == null || !Number.isFinite(theta)) return
    useful += Math.max(0, Math.min(theta, thresholds.cc)-thresholds.pmp)*depths[idx]*10
    capacity += (thresholds.cc-thresholds.pmp)*depths[idx]*10
    total += theta*depths[idx]*10
    depth += depths[idx]
  })
  return {
    useful_mm: useful,
    capacity_mm: capacity,
    total_mm: total,
    theta: depth ? total/(depth*10) : null,
    pct: capacity ? Math.max(0, Math.min(100, useful/capacity*100)) : null,
  }
}

function compactForecast(api: Json, data: Json, bias: Json) {
  const hourly = (api.hourly || {}) as Json
  const daily = (api.daily || {}) as Json
  const times = (hourly.time || []) as string[]
  const dayTimes = (daily.time || []) as string[]
  const thresholds = soilThresholds(data)
  const valueAt = (key: string, idx: number) => num((hourly[key] as unknown[] | undefined)?.[idx])
  const dailyAt = (key: string, idx: number) => num((daily[key] as unknown[] | undefined)?.[idx])
  const b39 = num(bias.sm39) || 0
  const b927 = num(bias.sm927) || 0
  const b2781 = num(bias.sm2781) || 0
  return dayTimes.slice(0, 16).map((date, dayIdx) => {
    let idx = times.indexOf(date + 'T12:00')
    if (idx < 0) idx = times.findIndex(t => t.startsWith(date))
    const raw: Layers = {
      sm39:valueAt('soil_moisture_3_to_9cm', idx),
      sm927:valueAt('soil_moisture_9_to_27cm', idx),
      sm2781:valueAt('soil_moisture_27_to_81cm', idx),
    }
    const calibrated: Layers = {
      sm39:raw.sm39 == null ? null : Math.max(0, raw.sm39+b39),
      sm927:raw.sm927 == null ? null : Math.max(0, raw.sm927+b927),
      sm2781:raw.sm2781 == null ? null : Math.max(0, raw.sm2781+b2781),
    }
    const profile = profilePct(calibrated, thresholds)
    const stage = cropStage(data, dayIdx)
    return {
      date,
      soil:raw,
      soil_calibrated:calibrated,
      water:profile,
      et0:dailyAt('et0_fao_evapotranspiration', dayIdx),
      precipitation:dailyAt('precipitation_sum', dayIdx),
      probability:dailyAt('precipitation_probability_max', dayIdx),
      tmax:dailyAt('temperature_2m_max', dayIdx),
      tmin:dailyAt('temperature_2m_min', dayIdx),
      kc:stage.kc,
    }
  })
}

function calibrationUpdate(existing: Json | undefined, error: Layers) {
  const samples = Math.max(0, num(existing?.samples) || 0)
  const nextSamples = samples+1
  const alpha = samples < 4 ? 1/nextSamples : .20
  const oldBias = (existing?.bias_layers || {}) as Json
  const oldMae = (existing?.mae_layers || {}) as Json
  const update = (key: keyof Layers) => {
    const e = error[key]
    const b = num(oldBias[key]) || 0
    const m = num(oldMae[key]) || 0
    return {
      bias:e == null ? b : b*(1-alpha)+e*alpha,
      mae:e == null ? m : m*(1-alpha)+Math.abs(e)*alpha,
    }
  }
  const sm39 = update('sm39')
  const sm927 = update('sm927')
  const sm2781 = update('sm2781')
  return {
    samples:nextSamples,
    bias_layers:{ sm39:sm39.bias, sm927:sm927.bias, sm2781:sm2781.bias },
    mae_layers:{ sm39:sm39.mae, sm927:sm927.mae, sm2781:sm2781.mae },
    last_error:error,
    updated_at:new Date().toISOString(),
  }
}

async function readAllLotes() {
  const rows: Json[] = []
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabase.from('lotes')
      .select('user_id,lote_id,nombre,data')
      .range(from, from+999)
    if (error) throw error
    rows.push(...((data || []) as Json[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function fetchOpenMeteo(lat: number, lon: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(5))
  url.searchParams.set('longitude', lon.toFixed(5))
  url.searchParams.set('current',
    'soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm,temperature_2m')
  url.searchParams.set('hourly',
    'soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm')
  url.searchParams.set('daily',
    'et0_fao_evapotranspiration,precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min')
  url.searchParams.set('forecast_days', '16')
  url.searchParams.set('timezone', 'auto')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`)
  return await response.json() as Json
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return json({ service:'hydric-daily', status:'ok', model:'open-meteo-best-match' })
  }
  if (req.method !== 'POST') return json({ error:'method_not_allowed' }, 405)
  try {
    const supplied = req.headers.get('x-cron-token') || ''
    const { data: secret, error: secretError } = await supabase
      .from('system_secrets').select('secret_value').eq('key', 'hydric_cron_token').single()
    if (secretError || !secret || supplied !== secret.secret_value) {
      return json({ error:'unauthorized' }, 401)
    }

    const today = new Date().toISOString().slice(0, 10)
    const previousFrom = new Date(Date.now()-3*86400000).toISOString().slice(0, 10)
    const [lotes, previousRes, calibrationRes] = await Promise.all([
      readAllLotes(),
      supabase.from('hydric_forecasts')
        .select('user_id,lote_id,run_at,forecast_days')
        .gte('run_date', previousFrom).lt('run_date', today)
        .order('run_at', { ascending:false }).limit(5000),
      supabase.from('hydric_calibrations')
        .select('user_id,lote_id,samples,bias_layers,mae_layers').limit(5000),
    ])
    if (previousRes.error) throw previousRes.error
    if (calibrationRes.error) throw calibrationRes.error

    const previous = new Map<string, Json>()
    for (const row of (previousRes.data || []) as Json[]) {
      const key = `${row.user_id}:${row.lote_id}`
      if (!previous.has(key)) previous.set(key, row)
    }
    const calibrations = new Map<string, Json>()
    for (const row of (calibrationRes.data || []) as Json[]) {
      calibrations.set(`${row.user_id}:${row.lote_id}`, row)
    }

    let processed = 0
    let skipped = 0
    const errors: Array<{ lote_id:string; error:string }> = []

    const processLote = async (row: Json) => {
      const data = (row.data || {}) as Json
      const coord = coordinates(data)
      if (!coord) { skipped++; return }
      const key = `${row.user_id}:${row.lote_id}`
      try {
        const api = await fetchOpenMeteo(coord.lat, coord.lon)
        const currentApi = (api.current || {}) as Json
        const current: Layers = {
          sm39:num(currentApi.soil_moisture_3_to_9cm),
          sm927:num(currentApi.soil_moisture_9_to_27cm),
          sm2781:num(currentApi.soil_moisture_27_to_81cm),
        }
        let calibration = calibrations.get(key)
        const prev = previous.get(key)
        if (prev) {
          const forecast = (prev.forecast_days || []) as Json[]
          const predicted = forecast.find(day => day.date === today)
          const predictedSoil = (predicted?.soil || {}) as Json
          const error: Layers = {
            sm39:current.sm39 == null || num(predictedSoil.sm39) == null
              ? null : current.sm39-num(predictedSoil.sm39)!,
            sm927:current.sm927 == null || num(predictedSoil.sm927) == null
              ? null : current.sm927-num(predictedSoil.sm927)!,
            sm2781:current.sm2781 == null || num(predictedSoil.sm2781) == null
              ? null : current.sm2781-num(predictedSoil.sm2781)!,
          }
          if (Object.values(error).some(v => v != null)) {
            const next = calibrationUpdate(calibration, error)
            const { error: upCalError } = await supabase.from('hydric_calibrations').upsert({
              user_id:row.user_id, lote_id:row.lote_id, ...next,
            }, { onConflict:'user_id,lote_id' })
            if (upCalError) throw upCalError
            calibration = { ...calibration, ...next }
            calibrations.set(key, calibration)
          }
        }

        const bias = (calibration?.bias_layers || {}) as Json
        const days = compactForecast(api, data, bias)
        const thresholds = soilThresholds(data)
        const currentProfile = profilePct(current, thresholds)
        const currentStage = cropStage(data)
        const pTable: Record<string, number> = {
          soja:.50, maiz:.55, trigo:.55, cebada:.55, girasol:.45, sorgo:.55, colza:.60,
        }
        const p = Math.max(.10, Math.min(.80,
          (pTable[currentStage.crop] ?? .50)+.04*(5-(num(days[0]?.et0) || 0)*currentStage.kc)))
        const criticalPct = (1-p)*100
        const firstStress = days.findIndex(day => num((day.water as Json)?.pct) != null &&
          num((day.water as Json).pct)! <= criticalPct)
        const summary = {
          status:'ok',
          current_pct:currentProfile.pct,
          current_theta:currentProfile.theta,
          current_useful_mm:currentProfile.useful_mm,
          critical_pct:criticalPct,
          model_stress_days:firstStress < 0 ? null : firstStress,
          model_stress_date:firstStress < 0 ? null : days[firstStress].date,
          calibration_samples:num(calibration?.samples) || 0,
          calibration_mae:calibration?.mae_layers || {},
          generated_at:new Date().toISOString(),
        }

        const { data: forecastRow, error: forecastError } = await supabase
          .from('hydric_forecasts').upsert({
            user_id:row.user_id,
            lote_id:row.lote_id,
            run_date:today,
            run_at:new Date().toISOString(),
            latitude:coord.lat,
            longitude:coord.lon,
            current_state:{ soil:current, water:currentProfile, thresholds },
            forecast_days:days,
            summary,
          }, { onConflict:'user_id,lote_id,run_date' })
          .select('id').single()
        if (forecastError) throw forecastError

        const { error: latestError } = await supabase.from('hydric_latest').upsert({
          user_id:row.user_id,
          lote_id:row.lote_id,
          forecast_id:forecastRow.id,
          summary,
          updated_at:new Date().toISOString(),
        }, { onConflict:'user_id,lote_id' })
        if (latestError) throw latestError
        processed++
      } catch (error) {
        errors.push({ lote_id:String(row.lote_id), error:error instanceof Error ? error.message : String(error) })
      }
    }

    for (let i = 0; i < lotes.length; i += 8) {
      await Promise.all(lotes.slice(i, i+8).map(processLote))
    }
    await supabase.from('hydric_forecasts')
      .delete().lt('created_at', new Date(Date.now()-120*86400000).toISOString())

    return json({ success:true, processed, skipped, errors })
  } catch (error) {
    console.error('hydric-daily', error)
    return json({ success:false, error:error instanceof Error ? error.message : String(error) }, 500)
  }
})
