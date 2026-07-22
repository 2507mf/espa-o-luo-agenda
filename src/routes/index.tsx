import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard } from "@/components/AuthCard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Espaço Luo — Agendamento de Salas" },
      {
        name: "description",
        content:
          "Reserve consultórios no Espaço Luo, em Recife. Agenda simples e elegante para profissionais de terapias integrativas.",
      },
      { property: "og:title", content: "Espaço Luo — Agendamento de Salas" },
      { property: "og:description", content: "Sistema de agendamento de consultórios do Espaço Luo." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: "/agenda" });
    }
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--luo-beige)" }}>
      <SiteHeader />
      <main className="flex flex-col items-center justify-center px-6 py-16">
        <AuthCard />
      </main>
    </div>
  );
}
