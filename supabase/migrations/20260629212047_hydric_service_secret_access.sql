-- La funcion hidrica usa service_role para leer el token privado del cron.
-- anon y authenticated siguen sin acceso a esta tabla.
GRANT SELECT ON public.system_secrets TO service_role;
