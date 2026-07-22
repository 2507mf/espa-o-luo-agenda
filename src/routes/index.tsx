import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import luoLogo from "@/assets/luo-logo.png.asset.json";

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
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--luo-beige)" }}>
      <SiteHeader />
      <main className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <img src={luoLogo.url} alt="Espaço Luo" className="h-24 md:h-32 w-auto" />
        <p
          className="mt-8 max-w-xl text-base md:text-lg"
          style={{ fontFamily: "Archivo, sans-serif", color: "var(--luo-sage-dark)" }}
        >
          Sistema de agendamento de consultórios do Espaço Luo. Simples, tranquilo e feito para o seu ritmo.
        </p>
      </main>
    </div>
  );
}