import { useState, useMemo } from "react";
import { Users, Plus, Upload, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContactDetailDrawer } from "@/components/contacts/ContactDetailDrawer";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactFiltersBar } from "@/components/contacts/ContactFiltersBar";
import { CsvImportDialog } from "@/components/contacts/CsvImportDialog";
import { BulkActionBar } from "@/components/contacts/BulkActionBar";
import { useContacts } from "@/hooks/useContacts";
import type { Contact, ContactFilters } from "@/types";

export default function ContactsPage() {
  const [filters, setFilters] = useState<ContactFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [showImport, setShowImport] = useState(false);

  const { contacts, totalCount, isLoading, refetch } = useContacts(filters);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">CONTATTI</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> IMPORTA CSV
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> ESPORTA
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> AGGIUNGI
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
        <span>Totale: <span className="text-foreground">{totalCount.toLocaleString()}</span></span>
        <span>Filtrati: <span className="text-foreground">{contacts.length.toLocaleString()}</span></span>
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
      />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
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
    </div>
  );
}
