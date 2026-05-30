-- Fix RLS recursion on public.profiles.
-- The admin policy calls app_private.is_admin(); that function must read
-- profiles with row security disabled, otherwise Postgres re-enters the same
-- profiles policies and raises 42P17 "infinite recursion detected".

CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND rol = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION app_private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_admin() TO authenticated;
