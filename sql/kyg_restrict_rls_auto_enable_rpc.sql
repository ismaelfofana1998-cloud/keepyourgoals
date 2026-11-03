-- Prevent public API clients from invoking the RLS auto-enable SECURITY DEFINER event-trigger function directly.
-- Does not drop/disable the event trigger.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
