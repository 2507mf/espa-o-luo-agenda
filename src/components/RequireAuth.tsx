import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

/**
 * Protege rotas no cliente. Enquanto a sessão carrega, mostra um placeholder.
 * Sem sessão, redireciona para /auth. Com `adminOnly`, exige papel de admin.
 */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { session, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/auth" });
    } else if (adminOnly && !isAdmin) {
      void navigate({ to: "/agenda" });
    }
  }, [loading, session, isAdmin, adminOnly, navigate]);

  if (loading || !session || (adminOnly && !isAdmin)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--luo-beige)", fontFamily: "Archivo, sans-serif" }}
      >
        <p style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>Carregando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
