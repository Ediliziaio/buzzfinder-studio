import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Globe, Linkedin, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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

interface Props {
  message: InboxMessage;
  note: string;
  onSaveNote: (note: string) => void;
}

export function ContactInfoPanel({ message, note, onSaveNote }: Props) {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [localNote, setLocalNote] = useState(note);
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
    </div>
  );
}
