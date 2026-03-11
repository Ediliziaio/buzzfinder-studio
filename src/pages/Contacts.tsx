import { useState } from "react";
import { Users, Plus, Upload, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactDetailDrawer } from "@/components/contacts/ContactDetailDrawer";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactFiltersBar } from "@/components/contacts/ContactFiltersBar";
import { CsvImportDialog } from "@/components/contacts/CsvImportDialog";
import { CreateContactDialog } from "@/components/contacts/CreateContactDialog";
import { BulkActionBar } from "@/components/contacts/BulkActionBar";
import { EmailValidationPanel } from "@/components/contacts/EmailValidationPanel";
import { useContacts } from "@/hooks/useContacts";
import { exportContactsCsv } from "@/lib/csvExporter";
import { toast } from "sonner";
import type { Contact, ContactFilters } from "@/types";

export default function ContactsPage() {
  const [filters, setFilters] = useState<ContactFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);

  const { contacts, totalCount, isLoading, refetch, totalPages } = useContacts(filters, page);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportContactsCsv(filters as Record<string, unknown>);
      toast.success(`Contatti esportati`);
    } catch (err: any) {
      toast.error(err.message || "Errore esportazione");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">CONTATTI</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowValidation(true)}>
            <ShieldCheck className="h-4 w-4 mr-1" /> VERIFICA EMAIL
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> IMPORTA CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" /> {exporting ? "ESPORTA..." : "ESPORTA"}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> AGGIUNGI
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
        <span>Totale: <span className="text-foreground">{totalCount.toLocaleString()}</span></span>
        <span>Selezionati: <span className="text-foreground">{selectedIds.size}</span></span>
      </div>

      {/* Filters */}
      <ContactFiltersBar filters={filters} onChange={setFilters} />

      {/* Table */}
      <ContactsTable
        contacts={contacts}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onContactClick={setDetailContact}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          selectedIds={selectedIds}
          onClear={() => setSelectedIds(new Set())}
          onRefresh={refetch}
        />
      )}

      {/* Detail drawer */}
      {detailContact && (
        <ContactDetailDrawer
          contact={detailContact}
          onClose={() => setDetailContact(null)}
          onUpdate={refetch}
        />
      )}

      {/* CSV Import */}
      <CsvImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onComplete={refetch}
      />

      {/* Email Validation */}
      <EmailValidationPanel
        open={showValidation}
        onClose={() => setShowValidation(false)}
        onComplete={refetch}
        totalContacts={totalCount}
      />

      {/* Create Contact */}
      <CreateContactDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
      />
    </div>
  );
}
