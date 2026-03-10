import { Mail, MessageSquare, Smartphone, Tag, Trash2, ListPlus, ArrowDownUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onClear: () => void;
}

export function BulkActionBar({ count, onClear }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-primary/30 bg-card px-4 py-3 shadow-2xl animate-slide-up">
      <div className="flex items-center gap-2 border-r border-border pr-3">
        <span className="font-mono text-sm text-primary font-bold">{count}</span>
        <span className="font-mono text-xs text-muted-foreground">selezionati</span>
      </div>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
        <Mail className="h-3 w-3" /> EMAIL
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
        <MessageSquare className="h-3 w-3" /> SMS
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
        <Smartphone className="h-3 w-3" /> WHATSAPP
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
        <ArrowDownUp className="h-3 w-3" /> STATO
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
        <Tag className="h-3 w-3" /> TAG
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
        <ListPlus className="h-3 w-3" /> LISTA
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1 text-destructive hover:text-destructive">
        <Trash2 className="h-3 w-3" /> ELIMINA
      </Button>
      <button onClick={onClear} className="ml-2 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
