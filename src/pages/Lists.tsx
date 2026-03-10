import { useState } from "react";
import { List, Plus, Filter, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { useLists } from "@/hooks/useLists";
import { ListsTable } from "@/components/lists/ListsTable";
import { CreateListDialog } from "@/components/lists/CreateListDialog";
import { ListContactsManager } from "@/components/lists/ListContactsManager";
import type { ContactList } from "@/types";

export default function ListsPage() {
  const { lists, isLoading, refetch } = useLists();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [tab, setTab] = useState("tutte");

  const statiche = lists.filter(l => l.tipo === "statica");
  const dinamiche = lists.filter(l => l.tipo === "dinamica");
  const totalContacts = lists.reduce((s, l) => s + l.totale_contatti, 0);
  const filtered = tab === "tutte" ? lists : tab === "statiche" ? statiche : dinamiche;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <List className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">LISTE</h1>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> NUOVA LISTA
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Totale liste" value={lists.length} />
        <KpiCard label="Statiche" value={statiche.length} />
        <KpiCard label="Dinamiche" value={dinamiche.length} />
        <KpiCard label="Contatti nelle liste" value={totalContacts} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tutte" className="font-mono text-xs">TUTTE ({lists.length})</TabsTrigger>
          <TabsTrigger value="statiche" className="font-mono text-xs">
            <Users className="h-3.5 w-3.5 mr-1" /> STATICHE ({statiche.length})
          </TabsTrigger>
          <TabsTrigger value="dinamiche" className="font-mono text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" /> DINAMICHE ({dinamiche.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <ListsTable lists={filtered} isLoading={isLoading} onSelect={setSelectedList} onRefetch={refetch} />
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <CreateListDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={refetch} />

      {/* Contact manager drawer */}
      <ListContactsManager list={selectedList} onClose={() => setSelectedList(null)} onUpdate={refetch} />
    </div>
  );
}
