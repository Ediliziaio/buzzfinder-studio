import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account creato! Controlla la tua email per confermare.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login effettuato!");
      }
    } catch (err: any) {
      toast.error(err.message || "Errore di autenticazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Crosshair className="h-8 w-8 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">LeadHunter</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground">B2B LEAD GENERATION PLATFORM</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@leadhunter.it"
              required
              className="font-mono bg-accent border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="font-mono bg-accent border-border"
            />
          </div>
          <Button type="submit" className="w-full font-mono" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignUp ? "CREA ACCOUNT" : "ACCEDI"}
          </Button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="block w-full text-center font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {isSignUp ? "Hai già un account? Accedi" : "Primo accesso? Crea account"}
        </button>
      </div>
    </div>
  );
}
