
-- Fix search_path su tutte le funzioni create nella migration precedente
ALTER FUNCTION public.increment_step_stat(UUID, TEXT, INTEGER) SET search_path = public;
ALTER FUNCTION public.calculate_health_score(NUMERIC, NUMERIC) SET search_path = public;
ALTER FUNCTION public.update_health_score() SET search_path = public;
ALTER FUNCTION public.sync_risposta_at() SET search_path = public;
