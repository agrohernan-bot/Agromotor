-- El proceso diario solo necesita leer los lotes sincronizados.
GRANT SELECT ON public.lotes TO service_role;
