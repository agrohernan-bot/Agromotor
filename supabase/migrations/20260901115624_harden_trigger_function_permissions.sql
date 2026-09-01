-- Las funciones de auditoría se invocan exclusivamente mediante triggers.
-- Evitar que queden publicadas como RPC con privilegios SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.log_auth_user_created_admin_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_auth_user_created_admin_event() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.log_auth_user_deleted_admin_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_auth_user_deleted_admin_event() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.log_profile_admin_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_profile_admin_event() FROM anon, authenticated;

-- Fijar el search_path de helpers de timestamp para impedir resolución de
-- objetos desde esquemas controlables por el llamador.
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.set_lotes_updated_at() SET search_path = public;
