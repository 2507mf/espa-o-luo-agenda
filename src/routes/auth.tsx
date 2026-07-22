import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import luoMark from "@/assets/luo-mark.png.asset.json";
import { useAuth } from "@/lib/auth";

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
  const navigate = useNavigate();
  const { session, loading, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Já logado? Vai direto para a agenda.
  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: "/agenda" });
    }
  }, [loading, session, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error);
        } else {
          toast.success("Bem-vindo(a) de volta!");
          void navigate({ to: "/agenda" });
        }
      } else {
        if (!fullName.trim()) {
          toast.error("Informe seu nome.");
          return;
        }
        const { error } = await signUp(email, password, fullName.trim());
        if (error) {
          toast.error(error);
        } else {
          toast.success("Conta criada! Você já pode entrar.");
          setMode("login");
          setPassword("");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { borderColor: "var(--luo-mist)" };

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
            {mode === "login"
              ? "Bem-vindo(a). Faça login para acessar sua agenda."
              : "Crie sua conta para agendar consultórios."}
          </p>
        </div>

        {/* Abas login / cadastro */}
        <div
          className="mt-8 grid grid-cols-2 rounded-lg p-1 text-sm"
          style={{ backgroundColor: "var(--luo-beige)", fontFamily: "Archivo, sans-serif" }}
        >
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="rounded-md py-2 transition-colors"
              style={{
                backgroundColor: mode === m ? "white" : "transparent",
                color: "var(--luo-sage-dark)",
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form className="mt-6 space-y-4" style={{ fontFamily: "Archivo, sans-serif" }} onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                Nome completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>
          )}
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
          >
            {submitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p
          className="mt-6 text-center text-xs"
          style={{ fontFamily: "Archivo, sans-serif", color: "var(--luo-sage-dark)", opacity: 0.7 }}
        >
          <Link to="/">Voltar ao início</Link>
        </p>
      </div>
    </div>
  );
}
