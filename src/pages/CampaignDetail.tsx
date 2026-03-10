import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pause, Square, Copy, Mail, Phone, MessageSquare, Users, Send, CheckCircle, Eye, MousePointerClick, Euro, Clock } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TerminalProgress } from "@/components/shared/TerminalProgress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { triggerN8nWebhook, getN8nSettings } from "@/services/n8n";
import { toast } from "sonner";
import type { Campaign, CampaignRecipient } from "@/types";

const tipoIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-5 w-5" />,
  sms: <Phone className="h-5 w-5" />,
  whatsapp: <MessageSquare className="h-5 w-5" />,
};

interface RecipientWithContact extends CampaignRecipient {
  contacts?: { nome: string | null; cognome: string | null; azienda: string; email: string | null; telefono: string | null } | null;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<RecipientWithContact[]>([]);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadCampaign();
    loadRecipients();

    const channel = supabase
      .channel(`campaign-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns", filter: `id=eq.${id}` }, () => loadCampaign())
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_recipients", filter: `campaign_id=eq.${id}` }, () => loadRecipients())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const loadCampaign = async () => {
    const { data } = await supabase.from("campaigns").select("*").eq("id", id!).single();
    if (data) setCampaign(data as unknown as Campaign);
    setLoading(false);
  };

  const loadRecipients = async () => {
    const { data } = await supabase
      .from("campaign_recipients")
      .select("*, contacts(nome, cognome, azienda, email, telefono)")
      .eq("campaign_id", id!)
      .order("inviato_at", { ascending: false })
      .limit(500);
    setRecipients((data as unknown as RecipientWithContact[]) || []);
  };

  const handleStatusChange = async (newStato: string) => {
    if (!campaign) return;

    // Validate recipients before launch
    if (newStato === "in_corso") {
      const { count } = await supabase
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);
      if (!count || count === 0) {
        toast.error("Aggiungi almeno un destinatario prima di lanciare la campagna");
        return;
      }
    }

    const updates: Record<string, unknown> = { stato: newStato };
    if (newStato === "in_corso" && !campaign.started_at) updates.started_at = new Date().toISOString();
    if (newStato === "completata" && !campaign.completed_at) updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from("campaigns").update(updates as any).eq("id", campaign.id);
    if (error) { toast.error("Errore aggiornamento stato"); return; }

    toast.success(`Campagna ${newStato}`);
    loadCampaign();

    // Trigger n8n webhook on launch
    if (newStato === "in_corso") {
      try {
        const settings = await getN8nSettings();
        const webhookMap: Record<string, string> = {
          email: settings.n8n_webhook_send_emails || "",
          sms: settings.n8n_webhook_send_sms || "",
          whatsapp: settings.n8n_webhook_send_whatsapp || "",
        };
        const webhookPath = webhookMap[campaign.tipo];
        if (webhookPath) {
          await triggerN8nWebhook(webhookPath, {
            campaign_id: campaign.id,
            tipo: campaign.tipo,
            subject: campaign.subject,
            body_html: campaign.body_html,
            body_text: campaign.body_text,
            sender_email: campaign.sender_email,
            sender_name: campaign.sender_name,
            reply_to: campaign.reply_to,
            template_whatsapp_id: campaign.template_whatsapp_id,
            rate_per_hour: campaign.sending_rate_per_hour,
          });
          toast.success("Job di invio avviato su n8n");
        } else {
          toast.warning("Webhook n8n non configurato — configura in Impostazioni");
        }
      } catch (err: any) {
        toast.error(`Errore trigger n8n: ${err.message}`);
      }
    }
  };

  if (loading || !campaign) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="font-mono text-sm text-muted-foreground">Caricamento...</span>
      </div>
    );
  }

  const progress = campaign.totale_destinatari > 0 ? Math.round((campaign.inviati / campaign.totale_destinatari) * 100) : 0;
  const deliveryRate = campaign.inviati > 0 ? ((campaign.consegnati / campaign.inviati) * 100).toFixed(1) : "0";
  const openRate = campaign.inviati > 0 ? ((campaign.aperti / campaign.inviati) * 100).toFixed(1) : "0";
  const clickRate = campaign.inviati > 0 ? ((campaign.cliccati / campaign.inviati) * 100).toFixed(1) : "0";

  const filteredRecipients = recipientFilter === "all"
    ? recipients
    : recipients.filter((r) => r.stato === recipientFilter);

  // Phase progress
  const phases = [
    { label: "Preparazione", active: campaign.stato === "bozza" || campaign.stato === "schedulata", done: ["in_corso", "completata", "pausa"].includes(campaign.stato) },
    { label: "Invio", active: campaign.stato === "in_corso", done: campaign.stato === "completata" },
    { label: "Completata", active: campaign.stato === "completata", done: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-primary">{tipoIcons[campaign.tipo]}</span>
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">{campaign.nome}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={campaign.stato} />
              {campaign.started_at && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  Avviata: {format(new Date(campaign.started_at), "dd MMM yy HH:mm", { locale: it })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.stato === "in_corso" && (
            <>
              <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => handleStatusChange("pausa")}>
                <Pause className="h-3 w-3 mr-1" /> PAUSA
              </Button>
              <Button variant="outline" size="sm" className="font-mono text-xs text-destructive" onClick={() => handleStatusChange("completata")}>
                <Square className="h-3 w-3 mr-1" /> STOP
              </Button>
            </>
          )}
          {campaign.stato === "pausa" && (
            <Button size="sm" className="font-mono text-xs" onClick={() => handleStatusChange("in_corso")}>
              <Send className="h-3 w-3 mr-1" /> RIPRENDI
            </Button>
          )}
          {campaign.stato === "bozza" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="font-mono text-xs">
                  <Send className="h-3 w-3 mr-1" /> LANCIA
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono">Lancia campagna?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-xs">
                    Stai per lanciare "{campaign.nome}" verso {campaign.totale_destinatari.toLocaleString()} destinatari via {campaign.tipo}. Questa azione avvierà l'invio tramite n8n.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-mono text-xs">Annulla</AlertDialogCancel>
                  <AlertDialogAction className="font-mono text-xs" onClick={() => handleStatusChange("in_corso")}>
                    <Send className="h-3 w-3 mr-1" /> Conferma invio
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="DESTINATARI" value={campaign.totale_destinatari.toLocaleString()} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="INVIATI" value={campaign.inviati.toLocaleString()} trend={`${progress}%`} trendUp={progress > 0} icon={<Send className="h-4 w-4" />} />
        <KpiCard label="CONSEGNATI" value={campaign.consegnati.toLocaleString()} trend={`${deliveryRate}%`} trendUp={Number(deliveryRate) > 90} icon={<CheckCircle className="h-4 w-4" />} />
        <KpiCard label="APERTI" value={campaign.aperti.toLocaleString()} trend={`${openRate}%`} trendUp={Number(openRate) > 15} icon={<Eye className="h-4 w-4" />} />
        <KpiCard label="COSTO" value={`€${Number(campaign.costo_reale_eur || 0).toFixed(2)}`} icon={<Euro className="h-4 w-4" />} />
      </div>

      {/* Phase Progress */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          {phases.map((p, i) => (
            <div key={p.label} className="flex items-center gap-2 flex-1">
              <div className={`flex-1 rounded-md px-3 py-2 text-center font-mono text-xs transition-all ${
                p.active ? "bg-primary text-primary-foreground" :
                p.done ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {p.label}
              </div>
              {i < phases.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
            </div>
          ))}
        </div>
        {campaign.stato === "in_corso" && (
          <div className="mt-3">
            <TerminalProgress
              percent={progress}
              current={campaign.inviati}
              total={campaign.totale_destinatari}
              label="PROGRESSO INVIO"
            />
          </div>
        )}
      </div>

      {/* Recipients Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="terminal-header">DESTINATARI ({filteredRecipients.length})</h3>
          <Select value={recipientFilter} onValueChange={setRecipientFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs font-mono bg-accent border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Inviati</SelectItem>
              <SelectItem value="delivered">Consegnati</SelectItem>
              <SelectItem value="opened">Aperti</SelectItem>
              <SelectItem value="failed">Errori</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="terminal-header">Nome / Azienda</TableHead>
                <TableHead className="terminal-header">{campaign.tipo === "email" ? "Email" : "Telefono"}</TableHead>
                <TableHead className="terminal-header">Stato</TableHead>
                <TableHead className="terminal-header">Inviato il</TableHead>
                <TableHead className="terminal-header">Errore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecipients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center font-mono text-xs text-muted-foreground py-8">
                    Nessun destinatario {recipientFilter !== "all" ? `con stato "${recipientFilter}"` : ""}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        {r.contacts?.nome && <div className="text-sm font-medium">{r.contacts.nome} {r.contacts.cognome}</div>}
                        <div className="text-xs text-muted-foreground">{r.contacts?.azienda || "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {campaign.tipo === "email" ? r.contacts?.email || "—" : r.contacts?.telefono || "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={r.stato} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.inviato_at ? format(new Date(r.inviato_at), "dd/MM HH:mm", { locale: it }) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-destructive max-w-[200px] truncate">
                      {r.errore || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
