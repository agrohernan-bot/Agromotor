-- ═══════════════════════════════════════════════════════════════
-- AGROMOTOR — Módulo Alertas de Plagas
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ═══════════════════════════════════════════════════════════════

-- Habilitar extensión PostGIS para consultas geoespaciales (si no está activa)
-- create extension if not exists postgis;

-- ───────────────────────────────────────────────────────────────
-- TABLA 1: pest_reports
-- Reportes comunitarios de plagas enviados por ingenieros en campo
-- ───────────────────────────────────────────────────────────────
create table if not exists pest_reports (
  id            uuid default gen_random_uuid() primary key,
  lat           float not null,
  lon           float not null,
  cultivo       text not null check (cultivo in ('soja','maiz','trigo','girasol')),
  plaga         text not null,          -- ID interno de la plaga (ej: 'chinche_cuernos')
  plaga_nombre  text not null,          -- Nombre legible (ej: 'Chinche de los Cuernos')
  severidad     int  not null check (severidad between 1 and 5),
  nota          text,                   -- Observación libre del ingeniero (opcional)
  reporter_name text not null,          -- Nombre del profesional
  created_at    timestamptz default now()
);

-- Índices para búsquedas por cultivo y fecha
create index if not exists pest_reports_cultivo_idx   on pest_reports (cultivo);
create index if not exists pest_reports_created_at_idx on pest_reports (created_at desc);

-- RLS: cualquiera puede insertar y leer (red abierta)
alter table pest_reports enable row level security;

create policy "Lectura pública de reportes"
  on pest_reports for select using (true);

create policy "Inserción pública de reportes"
  on pest_reports for insert with check (true);


-- ───────────────────────────────────────────────────────────────
-- TABLA 2: inta_alerts
-- Alertas procesadas por la Edge Function diaria desde boletines INTA
-- ───────────────────────────────────────────────────────────────
create table if not exists inta_alerts (
  id            uuid default gen_random_uuid() primary key,
  zona          text not null,          -- Nombre EEA INTA (ej: 'Marcos Juárez')
  zona_lat      float not null,         -- Coordenadas de la EEA
  zona_lon      float not null,
  cultivo       text not null check (cultivo in ('soja','maiz','trigo','girasol','todos')),
  plaga         text not null,          -- Nombre de la plaga reportada
  nivel_alerta  text not null check (nivel_alerta in ('bajo','medio','alto')),
  resumen       text not null,          -- Texto procesado por Claude API
  fuente_url    text,                   -- URL del boletín INTA original
  fecha_boletin date not null,          -- Fecha de publicación del boletín
  created_at    timestamptz default now()
);

-- Índices
create index if not exists inta_alerts_zona_idx         on inta_alerts (zona);
create index if not exists inta_alerts_cultivo_idx       on inta_alerts (cultivo);
create index if not exists inta_alerts_fecha_boletin_idx on inta_alerts (fecha_boletin desc);

-- RLS: lectura pública, escritura solo desde service_role (Edge Function)
alter table inta_alerts enable row level security;

create policy "Lectura pública de alertas INTA"
  on inta_alerts for select using (true);

-- NOTA: La Edge Function debe usar la SERVICE_ROLE key para insertar en inta_alerts


-- ───────────────────────────────────────────────────────────────
-- DATOS DE PRUEBA — borrar en producción
-- ───────────────────────────────────────────────────────────────

-- Ejemplo de reporte comunitario (Concepción del Uruguay, soja)
insert into pest_reports (lat, lon, cultivo, plaga, plaga_nombre, severidad, nota, reporter_name)
values (-32.48, -58.23, 'soja', 'chinche_cuernos', 'Chinche de los Cuernos', 3,
        'Borde norte del lote, cerca del monte. Presencia moderada en R4.', 'Ing. Pérez');

-- Ejemplo de reporte (Paraná, soja)
insert into pest_reports (lat, lon, cultivo, plaga, plaga_nombre, severidad, nota, reporter_name)
values (-31.75, -60.48, 'soja', 'anticarsia', 'Oruga de la Soja', 2,
        'Defoliación leve en lotes de primera. Sin umbral alcanzado.', 'Ing. González');

-- Ejemplo de alerta INTA (para testear antes de activar Edge Function)
insert into inta_alerts (zona, zona_lat, zona_lon, cultivo, plaga, nivel_alerta, resumen, fuente_url, fecha_boletin)
values (
  'Concepción del Uruguay', -32.48, -58.23, 'soja',
  'Chinche de los Cuernos (Dichelops furcatus)',
  'medio',
  'Se registra aumento poblacional de chinche de los cuernos en lotes de soja en R3-R4 en el sudeste de Entre Ríos. Se recomienda monitoreo en bordes con manga entomológica. Umbral orientativo: 5 individuos por metro lineal.',
  'https://inta.gob.ar/concepcion',
  current_date - interval '5 days'
);

-- ───────────────────────────────────────────────────────────────
-- REFERENCIA: Zonas INTA y coordenadas
-- (para uso en la Edge Function)
-- ───────────────────────────────────────────────────────────────
-- Marcos Juárez          -32.70  -62.10
-- Pergamino              -33.89  -60.57
-- Paraná                 -31.75  -60.48
-- Oliveros               -32.55  -60.87
-- Manfredi               -31.83  -63.77
-- Anguil                 -36.53  -64.02
-- Bordenave              -37.84  -63.01
-- Balcarce               -37.75  -58.30
-- General Villegas       -35.03  -63.02
-- Reconquista            -29.15  -59.65
-- Corrientes             -27.47  -58.83
-- Salta                  -24.78  -65.42
-- Concepción del Uruguay -32.48  -58.23
-- Concordia              -31.39  -58.02
