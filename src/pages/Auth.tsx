import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crosshair, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login effettuato!");
    } catch (err: any) {
      toast.error(err.message === "Invalid login credentials"
        ? "Email o password non corretti"
        : err.message || "Errore di autenticazione");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Inserisci la tua email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast.error(err.message || "Errore nell'invio dell'email");
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
            <h1 className="font-display text-2xl font-bold text-foreground">BuzzFinder</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground">LEAD GENERATION STUDIO</p>
        </div>

        {!showForgot ? (
          <>
            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4 rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Accesso riservato</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@buzzfinder.it"
                  required
                  autoComplete="email"
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
                  autoComplete="current-password"
                  className="font-mono bg-accent border-border"
                />
              </div>
              <Button type="submit" className="w-full font-mono" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACCEDI"}
              </Button>
            </form>

            <button
              onClick={() => setShowForgot(true)}
              className="block w-full text-center font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Password dimenticata?
            </button>
          </>
        ) : (
          <>
            {/* Reset password */}
            <div className="space-y-4 rounded-lg border border-border bg-card p-6">
              {forgotSent ? (
                <div className="text-center space-y-2 py-2">
                  <p className="font-mono text-sm text-foreground">Email inviata ✓</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Controlla la tua casella e segui il link per reimpostare la password.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <p className="font-mono text-xs text-muted-foreground">
                    Inserisci la tua email per ricevere il link di reset.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@buzzfinder.it"
                      required
                      className="font-mono bg-accent border-border"
                    />
                  </div>
                  <Button type="submit" className="w-full font-mono" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "INVIA LINK RESET"}
                  </Button>
                </form>
              )}
            </div>

            <button
              onClick={() => { setShowForgot(false); setForgotSent(false); }}
              className="block w-full text-center font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← Torna al login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
