import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md px-6">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="font-display text-xl font-bold text-foreground">Errore imprevisto</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {this.state.error?.message || "Si è verificato un errore. Ricarica la pagina per continuare."}
            </p>
            <Button onClick={() => window.location.reload()} className="font-mono text-xs">
              Ricarica pagina
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
