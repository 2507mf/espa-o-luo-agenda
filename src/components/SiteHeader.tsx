import { Link } from "@tanstack/react-router";
import luoMark from "@/assets/luo-mark.png.asset.json";

export function SiteHeader() {
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
      <Link
        to="/auth"
        className="text-sm px-4 py-2 rounded-full transition-colors"
        style={{
          fontFamily: "Archivo, sans-serif",
          backgroundColor: "var(--luo-sage)",
          color: "white",
        }}
      >
        Entrar
      </Link>
    </header>
  );
}