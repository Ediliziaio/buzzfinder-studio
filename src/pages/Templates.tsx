import { useState } from "react";
import { FileText, Plus, Mail, Phone, MessageSquare, Copy, Trash2, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from "@/hooks/useTemplates";
import type { CampaignTemplate } from "@/types";

const tipoIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <Phone className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
};

const tipoColors: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-500",
  sms: "bg-emerald-500/10 text-emerald-500",
  whatsapp: "bg-green-500/10 text-green-500",
};

interface TemplateFormData {
  nome: string;
  tipo: "email" | "sms" | "whatsapp" | "chiamata";
  subject: string;
  body_html: string;
  sender_email: string;
  sender_name: string;
  reply_to: string;
}

const emptyForm: TemplateFormData = {
  nome: "",
  tipo: "email",
  subject: "",
  body_html: "",
  sender_email: "",
  sender_name: "",
  reply_to: "",
};

export default function TemplatesPage() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useTemplates();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = templates.filter((t) =>
    t.nome.toLowerCase().includes(search.toLowerCase()) ||
    (t.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: CampaignTemplate) => {
    setEditingId(t.id);
    setForm({
      nome: t.nome,
      tipo: t.tipo,
      subject: t.subject || "",
      body_html: t.body_html || "",
      sender_email: t.sender_email || "",
      sender_name: t.sender_name || "",
      reply_to: t.reply_to || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    if (editingId) {
      await updateTemplate(editingId, form);
    } else {
      await createTemplate(form);
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTemplate(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">TEMPLATE</h1>
        </div>
        <Button size="sm" className="font-mono text-xs" onClick={openCreate}>
          <Plus className="h-3 w-3 mr-1" /> Nuovo Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 font-mono text-xs"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-mono text-sm text-muted-foreground">
            {search ? "Nessun template trovato" : "Nessun template creato"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" className="mt-3 font-mono text-xs" onClick={openCreate}>
              <Plus className="h-3 w-3 mr-1" /> Crea il primo template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`flex items-center justify-center h-7 w-7 rounded-md ${tipoColors[t.tipo] || tipoColors.email}`}>
                    {tipoIcons[t.tipo] || tipoIcons.email}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-foreground truncate">{t.nome}</p>
                    {t.subject && (
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{t.subject}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                  {t.tipo}
                </Badge>
              </div>

              {t.body_html && (
                <p className="font-mono text-[11px] text-muted-foreground line-clamp-3">
                  {t.body_html.replace(/<[^>]+>/g, "").slice(0, 150)}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Usato {t.utilizzi || 0} volte
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateTemplate(t)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {editingId ? "Modifica Template" : "Nuovo Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Es: Welcome Email"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: "email" | "sms" | "whatsapp" | "chiamata") => setForm({ ...form, tipo: v })}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.tipo === "email" && (
              <>
                <div className="space-y-1">
                  <Label className="font-mono text-xs text-muted-foreground">Oggetto</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Oggetto dell'email..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-mono text-xs text-muted-foreground">Nome mittente</Label>
                    <Input
                      value={form.sender_name}
                      onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                      placeholder="Mario Rossi"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono text-xs text-muted-foreground">Email mittente</Label>
                    <Input
                      value={form.sender_email}
                      onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                      placeholder="mario@azienda.it"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label className="font-mono text-xs text-muted-foreground">
                {form.tipo === "email" ? "Corpo HTML" : "Messaggio"}
              </Label>
              <Textarea
                value={form.body_html}
                onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                placeholder={form.tipo === "email" ? "<p>Ciao {{nome}},</p>" : "Ciao {{nome}}, ..."}
                className="font-mono text-xs min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-mono text-xs">
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.nome.trim()} className="font-mono text-xs">
              {saving ? "Salvataggio..." : editingId ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo template?</AlertDialogTitle>
            <AlertDialogDescription>L'azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
