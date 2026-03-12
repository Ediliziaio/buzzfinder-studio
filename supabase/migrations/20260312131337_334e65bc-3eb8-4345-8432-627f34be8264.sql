
-- Fix: make call_analytics view use invoker's permissions (not definer)
DROP VIEW IF EXISTS public.call_analytics;
CREATE VIEW public.call_analytics WITH (security_invoker = true) AS
SELECT
  c.id AS campaign_id,
  c.nome,
  COUNT(cs.id) AS totale_chiamate,
  COUNT(cs.id) FILTER (WHERE cs.stato = 'completed') AS completate,
  COUNT(cs.id) FILTER (WHERE cs.stato = 'no_answer') AS no_risposta,
  COUNT(cs.id) FILTER (WHERE cs.esito = 'interessato') AS interessati,
  COUNT(cs.id) FILTER (WHERE cs.esito = 'appuntamento') AS appuntamenti,
  COUNT(cs.id) FILTER (WHERE cs.esito = 'richiama') AS da_richiamare,
  ROUND(AVG(cs.durata_secondi) FILTER (WHERE cs.stato = 'completed'), 0) AS durata_media_sec,
  ROUND(SUM(cs.costo_eur), 4) AS costo_totale_eur,
  ROUND(
    COUNT(cs.id) FILTER (WHERE cs.esito = 'interessato')::NUMERIC /
    NULLIF(COUNT(cs.id) FILTER (WHERE cs.stato = 'completed'), 0) * 100, 2
  ) AS tasso_interesse
FROM public.campaigns c
LEFT JOIN public.call_sessions cs ON cs.campaign_id = c.id
GROUP BY c.id, c.nome;

GRANT SELECT ON public.call_analytics TO authenticated;
