import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Espaço Luo" }],
  }),
  component: () => (
    <RequireAuth adminOnly>
      <AdminPage />
    </RequireAuth>
  ),
});

type Room = { id: string; name: string; description: string | null; active: boolean };
type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  isAdmin: boolean;
};

function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);

  useEffect(() => {
    void Promise.all([loadRooms(), loadMembers()]).finally(() => setLoading(false));
  }, []);

  async function loadRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, description, active")
      .order("name");
    if (error) toast.error("Erro ao carregar salas: " + error.message);
    else setRooms(data ?? []);
  }

  async function loadMembers() {
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr || rErr) {
      toast.error("Erro ao carregar usuários.");
      return;
    }
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    setMembers(
      (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        isAdmin: adminIds.has(p.id),
      })),
    );
  }

  async function handleCreateRoom(e: FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setSavingRoom(true);
    const { error } = await supabase.from("rooms").insert({
      name: newRoomName.trim(),
      description: newRoomDesc.trim() || null,
    });
    setSavingRoom(false);
    if (error) toast.error("Erro ao criar sala: " + error.message);
    else {
      toast.success("Sala criada!");
      setNewRoomName("");
      setNewRoomDesc("");
      void loadRooms();
    }
  }

  async function toggleRoomActive(room: Room) {
    const { error } = await supabase
      .from("rooms")
      .update({ active: !room.active })
      .eq("id", room.id);
    if (error) toast.error(error.message);
    else void loadRooms();
  }

  async function toggleAdmin(member: Member) {
    if (member.isAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", member.id)
        .eq("role", "admin");
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: member.id, role: "admin" });
      if (error) return toast.error(error.message);
    }
    toast.success("Permissão atualizada.");
    void loadMembers();
  }

  const inputStyle = { borderColor: "var(--luo-mist)", fontFamily: "Archivo, sans-serif" };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--luo-beige)" }}>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10" style={{ fontFamily: "Archivo, sans-serif" }}>
        <h1
          className="text-3xl mb-6"
          style={{ fontFamily: '"Cormorant Garamond", serif', color: "var(--luo-sage-dark)" }}
        >
          Administração
        </h1>

        {loading ? (
          <p style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>Carregando...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Salas */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg mb-4" style={{ color: "var(--luo-sage-dark)" }}>
                Salas / consultórios
              </h2>

              <form onSubmit={handleCreateRoom} className="space-y-3 mb-6">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Nome da sala"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={savingRoom}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
                >
                  {savingRoom ? "Salvando..." : "Adicionar sala"}
                </button>
              </form>

              {rooms.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                  Nenhuma sala cadastrada.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rooms.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                      style={{ borderColor: "var(--luo-mist)", color: "var(--luo-sage-dark)" }}
                    >
                      <div>
                        <span className="font-medium">{r.name}</span>
                        {r.description && <span className="ml-2 opacity-60">· {r.description}</span>}
                        {!r.active && <span className="ml-2 text-xs opacity-60">(inativa)</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRoomActive(r)}
                        className="text-xs underline"
                        style={{ opacity: 0.7 }}
                      >
                        {r.active ? "desativar" : "ativar"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Usuários */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg mb-4" style={{ color: "var(--luo-sage-dark)" }}>
                Usuários
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                Novos usuários criam a própria conta na tela de login. Aqui você pode conceder ou
                remover a permissão de administrador.
              </p>
              {members.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                  Nenhum usuário cadastrado.
                </p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                      style={{ borderColor: "var(--luo-mist)", color: "var(--luo-sage-dark)" }}
                    >
                      <div>
                        <span className="font-medium">{m.full_name ?? "—"}</span>
                        <span className="ml-2 opacity-60">{m.email}</span>
                        {m.isAdmin && (
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-xs"
                            style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
                          >
                            admin
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAdmin(m)}
                        className="text-xs underline"
                        style={{ opacity: 0.7 }}
                      >
                        {m.isAdmin ? "remover admin" : "tornar admin"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
