import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Globe, Linkedin, Mail, ExternalLink, Eye, MousePointerClick, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "@/types";

interface ContactInfo {
  id: string;
  nome: string | null;
  cognome: string | null;
  azienda: string;
  email: string | null;
  telefono: string | null;
  sito_web: string | null;
  linkedin_url: string | null;
  tags: string[] | null;
}

interface Execution {
  id: string;
  stato: string;
  sent_at: string | null;
  scheduled_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error: string | null;
  step_number: number;
  campaign_name: string;
}

interface Props {
  message: InboxMessage;
  note: string;
  onSaveNote: (note: string) => void;
}

export function ContactInfoPanel({ message, note, onSaveNote }: Props) {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [localNote, setLocalNote] = useState(note);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loadingExec, setLoadingExec] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setLocalNote(note); }, [note]);

  useEffect(() => {
    const fetchContact = async () => {
      if (!message.da_email && !message.da_telefono) return;
      let query = supabase.from("contacts").select("id, nome, cognome, azienda, email, telefono, sito_web, linkedin_url, tags");
      if (message.da_email) {
        const { data } = await query.eq("email", message.da_email).limit(1).maybeSingle();
        if (data) { setContact(data); return; }
      }
      if (message.da_telefono) {
        const { data } = await supabase.from("contacts").select("id, nome, cognome, azienda, email, telefono, sito_web, linkedin_url, tags").eq("telefono", message.da_telefono).limit(1).maybeSingle();
        if (data) { setContact(data); return; }
      }
      setContact(null);
    };
    fetchContact();
  }, [message.da_email, message.da_telefono]);

  // Fetch sending history when contact is found
  useEffect(() => {
    if (!contact?.id) { setExecutions([]); return; }

    const fetchExecutions = async () => {
      setLoadingExec(true);
      try {
        // 1. Find recipient_ids for this contact
        const { data: recipients } = await supabase
          .from("campaign_recipients")
          .select("id")
          .eq("contact_id", contact.id);

        if (!recipients || recipients.length === 0) { setExecutions([]); return; }

        const recipientIds = recipients.map(r => r.id);

        // 2. Load executions
        const { data: execs } = await supabase
          .from("campaign_step_executions")
          .select("id, stato, sent_at, scheduled_at, opened_at, clicked_at, error, step_id, campaign_id")
          .in("recipient_id", recipientIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!execs || execs.length === 0) { setExecutions([]); return; }

        // 3. Load step numbers and campaign names
        const stepIds = [...new Set(execs.map(e => e.step_id))];
        const campaignIds = [...new Set(execs.map(e => e.campaign_id))];

        const [stepsRes, campaignsRes] = await Promise.all([
          supabase.from("campaign_steps").select("id, step_number").in("id", stepIds),
          supabase.from("campaigns").select("id, nome").in("id", campaignIds),
        ]);

        const stepMap = new Map(stepsRes.data?.map(s => [s.id, s.step_number]) || []);
        const campMap = new Map(campaignsRes.data?.map(c => [c.id, c.nome]) || []);

        setExecutions(execs.map(e => ({
          id: e.id,
          stato: e.stato,
          sent_at: e.sent_at,
          scheduled_at: e.scheduled_at,
          opened_at: e.opened_at,
          clicked_at: e.clicked_at,
          error: e.error,
          step_number: stepMap.get(e.step_id) ?? 0,
          campaign_name: campMap.get(e.campaign_id) ?? "—",
        })));
      } finally {
        setLoadingExec(false);
      }
    };
    fetchExecutions();
  }, [contact?.id]);

  const handleSaveNote = () => {
    onSaveNote(localNote);
    toast.success("Nota salvata");
  };

  return (
    <div className="space-y-3">
      {/* Contact Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono">👤 Contatto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          {contact ? (
            <>
              <p className="font-semibold">{contact.nome} {contact.cognome}</p>
              {contact.azienda && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3 w-3" /> {contact.azienda}
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3 w-3" /> {contact.email}
                </div>
              )}
              {contact.sito_web && (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <a href={contact.sito_web.startsWith("http") ? contact.sito_web : `https://${contact.sito_web}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    {contact.sito_web}
                  </a>
                </div>
              )}
              {contact.linkedin_url && (
                <div className="flex items-center gap-1.5">
                  <Linkedin className="h-3 w-3 text-muted-foreground" />
                  <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    LinkedIn
                  </a>
                </div>
              )}
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {contact.tags.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{t}</span>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={() => navigate(`/contacts`)}>
                <ExternalLink className="h-3 w-3 mr-1" /> Apri scheda contatto
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">Contatto non trovato nel database</p>
          )}
        </CardContent>
      </Card>

      {/* Note Interne */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono">📝 Note Interne</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            placeholder="Aggiungi una nota..."
            className="text-sm font-mono min-h-[80px]"
          />
          <Button size="sm" className="mt-2 w-full" onClick={handleSaveNote}>
            Salva nota
          </Button>
        </CardContent>
      </Card>

      {/* Storia Invii */}
      {contact && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono">📊 Storia Invii</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExec ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : executions.length === 0 ? (
              <p className="text-muted-foreground text-xs font-mono">Nessun invio trovato</p>
            ) : (
              <div className="space-y-0">
                {executions.map((exec) => (
                  <div key={exec.id} className="flex items-center gap-2 text-xs font-mono py-1.5 border-b border-border last:border-0">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      exec.stato === "sent" ? "bg-green-500" :
                      exec.stato === "scheduled" ? "bg-yellow-500" :
                      "bg-destructive"
                    )} />
                    <span className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(exec.sent_at || exec.scheduled_at || new Date()), "d MMM HH:mm", { locale: it })}
                    </span>
                    <span className="truncate">Step {exec.step_number}</span>
                    <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                      {exec.opened_at && <Eye className="h-3 w-3 text-blue-500" />}
                      {exec.clicked_at && <MousePointerClick className="h-3 w-3 text-primary" />}
                    </div>
                  </div>
                ))}
                {executions.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 font-mono truncate">
                    {executions[0].campaign_name}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}