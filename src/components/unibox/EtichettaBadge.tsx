import { cn } from "@/lib/utils";

const ETICHETTE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  interessato:          { label: "Interessato",       icon: "🔥", color: "bg-green-100 text-green-800 border-green-200" },
  appuntamento_fissato: { label: "Meeting",           icon: "📅", color: "bg-blue-100 text-blue-800 border-blue-200" },
  richiesta_info:       { label: "Richiesta info",    icon: "❓", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  referral:             { label: "Referral",          icon: "👥", color: "bg-purple-100 text-purple-800 border-purple-200" },
  fuori_ufficio:        { label: "Fuori ufficio",     icon: "✈️", color: "bg-gray-100 text-gray-600 border-gray-200" },
  obiezione:            { label: "Obiezione",         icon: "🤔", color: "bg-orange-100 text-orange-800 border-orange-200" },
  non_interessato:      { label: "Non interessato",   icon: "❌", color: "bg-red-100 text-red-700 border-red-200" },
  disiscrizione:        { label: "Disiscritto",       icon: "🚫", color: "bg-red-200 text-red-900 border-red-300" },
  non_categorizzato:    { label: "Non categorizzato", icon: "⚪", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function getEtichettaConfig(etichetta: string) {
  return ETICHETTE_CONFIG[etichetta] || ETICHETTE_CONFIG.non_categorizzato;
}

export function EtichettaBadge({ etichetta, small = false }: { etichetta: string; small?: boolean }) {
  const config = getEtichettaConfig(etichetta);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-medium",
      small ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
      config.color
    )}>
      {config.icon} {config.label}
    </span>
  );
}
