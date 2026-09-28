import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Cloud, LogOut, LogIn } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function useUsuario() {
  const [user, setUser] = useState<User | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setPronto(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, pronto };
}

export function ContaMenu() {
  const { user } = useUsuario();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link to="/projetos">
          <Cloud className="h-4 w-4" />
          <span className="hidden sm:inline">Meus projetos</span>
        </Link>
      </Button>
      {user ? (
        <Button
          variant="ghost"
          size="sm"
          title={user.email ?? ""}
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Sair</span>
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Entrar</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
