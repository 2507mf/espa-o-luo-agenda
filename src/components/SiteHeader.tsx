import { Link, useNavigate } from "@tanstack/react-router";
import luoMark from "@/assets/luo-mark.png";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const navigate = useNavigate();
  const { session, isAdmin, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/" });
  }

  const pill = {
    fontFamily: "Archivo, sans-serif",
    backgroundColor: "var(--luo-sage)",
    color: "white",
  };

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: "var(--luo-mist)", backgroundColor: "var(--luo-beige)" }}
    >
      <Link to="/" className="flex items-center gap-3">
        <img src={luoMark} alt="Espaço Luo" className="h-10 w-auto" />
        <span
          className="text-xl tracking-wide"
          style={{ fontFamily: '"Cormorant Garamond", serif', color: "var(--luo-sage-dark)" }}
        >
          Espaço Luo
        </span>
      </Link>

      {session && (
        <nav className="flex items-center gap-3 text-sm" style={{ fontFamily: "Archivo, sans-serif" }}>
          <Link to="/agenda" style={{ color: "var(--luo-sage-dark)" }}>
            Agenda
          </Link>
          {isAdmin && (
            <Link to="/admin" style={{ color: "var(--luo-sage-dark)" }}>
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 rounded-full transition-colors hover:opacity-90"
            style={pill}
          >
            Sair
          </button>
        </nav>
      )}
    </header>
  );
}
