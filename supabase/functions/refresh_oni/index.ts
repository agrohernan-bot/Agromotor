import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONI_URL = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';

Deno.serve(async (req) => {
  try {
    const res = await fetch(ONI_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch ONI data: ${res.statusText}`);
    }
    const text = await res.text();
    const lines = text.trim().split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      throw new Error('NOAA ONI data file is empty');
    }

    // Última fila con datos (ej: 'MAM 2026   17.2   23.4  -0.4')
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.trim().split(/\s+/);
    
    // Formato de columnas esperado: SEAS YR TOTAL ANOM
    if (parts.length < 3) {
      throw new Error(`Invalid line format in ONI file: ${lastLine}`);
    }
    
    const season = parts[0];
    const year = parts[1];
    // En las columnas de NOAA: 
    // YR SEAS TOTAL ANOM (ej: '2026 DJF 26.82 -0.18') 
    // o SEAS YR TOTAL ANOM. El parser debe validar dónde está el trimestre/año
    let seasonStr = season;
    let yearStr = year;
    let anomVal = 0.0;

    // Si el año es numérico de 4 dígitos y está en la primera columna
    if (/^\d{4}$/.test(parts[0])) {
      yearStr = parts[0];
      seasonStr = parts[1];
      anomVal = parseFloat(parts[parts.length - 1]);
    } else if (/^\d{4}$/.test(parts[1])) {
      seasonStr = parts[0];
      yearStr = parts[1];
      anomVal = parseFloat(parts[parts.length - 1]);
    } else {
      anomVal = parseFloat(parts[parts.length - 1]);
    }

    if (isNaN(anomVal)) {
      throw new Error(`Could not parse ONI anomaly value from line: ${lastLine}`);
    }

    let fase = 'Neutral';
    if (anomVal >= 0.5) fase = 'ElNino';
    else if (anomVal <= -0.5) fase = 'LaNina';

    // Inicializar cliente Supabase con privilegios admin de service_role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabase.from('oni_cache').upsert({
      id: 1,
      fase_actual: fase,
      oni_valor: anomVal,
      trimestre: `${seasonStr} ${yearStr}`,
      actualizado_en: new Date().toISOString()
    });

    if (error) {
      throw new Error(`Failed to upsert cache: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, fase, anom: anomVal, season: seasonStr, year: yearStr }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
