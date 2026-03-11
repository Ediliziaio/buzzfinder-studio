

# Piano: Sidebar con Macrocategorie Collassabili

## Struttura proposta

Raggruppare i 15 item in 5 macrocategorie con collapsible accordion:

| Categoria | Icona | Voci |
|-----------|-------|------|
| **Overview** | LayoutDashboard | Dashboard |
| **Acquisizione** | Search | Scraper Maps, Scraper Siti, Contatti, Liste |
| **Outreach** | Send | Campagne, Template, Follow-up, Unibox |
| **Vendite** | Kanban | Pipeline CRM, Analytics |
| **Infrastruttura** | Settings | Pool Mittenti, Deliverability, Suppression, Impostazioni |

## Comportamento

- Ogni gruppo ha un header cliccabile con chevron che apre/chiude la lista dei sotto-item
- Il gruppo che contiene la route attiva resta aperto automaticamente (`defaultOpen`)
- Dashboard resta sempre visibile fuori dai gruppi (top-level)
- Quando la sidebar e' collassata (`w-[52px]`), mostra solo le icone dei singoli item senza le intestazioni dei gruppi (comportamento attuale invariato)
- Le label dei gruppi sono in stile `terminal-header` (uppercase, piccole, tracking ampio) coerente col design system

## File da modificare

| File | Azione |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Riscrivere la struttura nav con gruppi collassabili usando stato locale per ogni gruppo aperto/chiuso |

## Implementazione

- Usare un semplice stato `Record<string, boolean>` per gestire apertura/chiusura dei gruppi
- Auto-espandere il gruppo della route corrente
- Animazione CSS `max-height` + `overflow-hidden` per transizione fluida
- Nessuna nuova dipendenza necessaria (no Collapsible/Accordion, basta CSS + stato)

