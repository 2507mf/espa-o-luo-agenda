import { createFileRoute, Link } from "@tanstack/react-router";
import luoMark from "@/assets/luo-mark.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Espaço Luo" },
      { name: "description", content: "Acesse sua conta para agendar consultórios no Espaço Luo." },
      { property: "og:title", content: "Entrar — Espaço Luo" },
      { property: "og:description", content: "Sistema de agendamento de salas do Espaço Luo." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--luo-beige)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10 shadow-sm"
        style={{ backgroundColor: "white", borderColor: "var(--luo-mist)" }}
      >
        <div className="flex flex-col items-center text-center">
          <img src={luoMark.url} alt="Espaço Luo" className="h-24 w-auto" />
          <h1
            className="mt-6 text-3xl"
            style={{ fontFamily: '"Cormorant Garamond", serif', color: "var(--luo-sage-dark)" }}
          >
            Espaço Luo
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ fontFamily: "Archivo, sans-serif", color: "var(--luo-sage-dark)", opacity: 0.75 }}
          >
            Bem-vindo(a). Faça login para acessar sua agenda.
          </p>
        </div>

        <form className="mt-8 space-y-4" style={{ fontFamily: "Archivo, sans-serif" }}>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
              E-mail
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--luo-mist)" }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
              Senha
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--luo-mist)" }}
            />
          </div>
          <button
            type="button"
            className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ fontFamily: "Archivo, sans-serif", color: "var(--luo-sage-dark)", opacity: 0.7 }}>
          <Link to="/">Voltar ao início</Link>
        </p>
      </div>
    </div>
  );
}