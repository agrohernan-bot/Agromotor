-- Acceso exclusivo del proceso backend que genera pronosticos y calibraciones.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.hydric_forecasts,
  public.hydric_calibrations,
  public.hydric_latest,
  public.hydric_events
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.hydric_forecasts_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.hydric_events_id_seq TO service_role;
