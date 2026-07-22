import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [{ title: "Agenda — Espaço Luo" }],
  }),
  component: () => (
    <RequireAuth>
      <AgendaPage />
    </RequireAuth>
  ),
});

type Room = { id: string; name: string; description: string | null };
type Booking = {
  id: string;
  room_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  profiles?: { full_name: string | null } | null;
};

const HORAS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08h às 20h

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AgendaPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<string>("");
  const [date, setDate] = useState<string>(hojeISO());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário de nova reserva
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadRooms();
  }, []);

  useEffect(() => {
    if (roomId) void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, date]);

  async function loadRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, description")
      .eq("active", true)
      .order("name");
    if (error) {
      toast.error("Erro ao carregar salas: " + error.message);
    } else {
      setRooms(data ?? []);
      if (data && data.length && !roomId) setRoomId(data[0].id);
    }
    setLoading(false);
  }

  async function loadBookings() {
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, room_id, user_id, starts_at, ends_at, notes, profiles(full_name)")
      .eq("room_id", roomId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at");
    if (error) {
      toast.error("Erro ao carregar reservas: " + error.message);
    } else {
      setBookings((data as Booking[]) ?? []);
    }
  }

  const bookedHours = useMemo(() => {
    const set = new Set<number>();
    for (const b of bookings) {
      const s = new Date(b.starts_at).getHours();
      const e = new Date(b.ends_at).getHours();
      for (let h = s; h < e; h++) set.add(h);
    }
    return set;
  }, [bookings]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!roomId || !user) return;
    if (endHour <= startHour) {
      toast.error("O horário final deve ser depois do inicial.");
      return;
    }
    setSaving(true);
    const starts_at = `${date}T${String(startHour).padStart(2, "0")}:00:00`;
    const ends_at = `${date}T${String(endHour).padStart(2, "0")}:00:00`;
    const { error } = await supabase.from("bookings").insert({
      room_id: roomId,
      user_id: user.id,
      starts_at,
      ends_at,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (error.message.includes("bookings_no_overlap")) {
        toast.error("Já existe uma reserva nesse horário para esta sala.");
      } else {
        toast.error("Erro ao reservar: " + error.message);
      }
    } else {
      toast.success("Reserva confirmada!");
      setNotes("");
      void loadBookings();
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) toast.error("Erro ao cancelar: " + error.message);
    else {
      toast.success("Reserva cancelada.");
      void loadBookings();
    }
  }

  const selectStyle = {
    borderColor: "var(--luo-mist)",
    fontFamily: "Archivo, sans-serif",
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--luo-beige)" }}>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10" style={{ fontFamily: "Archivo, sans-serif" }}>
        <h1
          className="text-3xl mb-6"
          style={{ fontFamily: '"Cormorant Garamond", serif', color: "var(--luo-sage-dark)" }}
        >
          Agenda de consultórios
        </h1>

        {loading ? (
          <p style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>Carregando...</p>
        ) : rooms.length === 0 ? (
          <div className="rounded-xl bg-white p-6" style={{ color: "var(--luo-sage-dark)" }}>
            Nenhuma sala cadastrada ainda. Peça a um administrador para criar as salas na área{" "}
            <strong>Admin</strong>.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
            {/* Coluna: filtros + nova reserva */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                    Sala
                  </label>
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={selectStyle}
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                    Data
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={hojeISO()}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={selectStyle}
                  />
                </div>
              </div>

              <hr className="my-5" style={{ borderColor: "var(--luo-mist)" }} />

              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--luo-sage-dark)" }}>
                Nova reserva
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                      Início
                    </label>
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(Number(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={selectStyle}
                    >
                      {HORAS.map((h) => (
                        <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                      Fim
                    </label>
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(Number(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={selectStyle}
                    >
                      {HORAS.map((h) => (
                        <option key={h} value={h + 1}>{`${String(h + 1).padStart(2, "0")}:00`}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                    Observações (opcional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex.: atendimento de reiki"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={selectStyle}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
                >
                  {saving ? "Reservando..." : "Reservar"}
                </button>
              </form>
            </section>

            {/* Coluna: grade do dia + lista de reservas */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--luo-sage-dark)" }}>
                Ocupação do dia
              </h2>
              <div className="grid grid-cols-4 gap-2 mb-6 sm:grid-cols-5">
                {HORAS.map((h) => {
                  const busy = bookedHours.has(h);
                  return (
                    <div
                      key={h}
                      className="rounded-md py-2 text-center text-xs"
                      style={{
                        backgroundColor: busy ? "var(--luo-sage)" : "var(--luo-beige)",
                        color: busy ? "white" : "var(--luo-sage-dark)",
                        opacity: busy ? 1 : 0.8,
                      }}
                      title={busy ? "Ocupado" : "Livre"}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  );
                })}
              </div>

              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--luo-sage-dark)" }}>
                Reservas
              </h2>
              {bookings.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                  Nenhuma reserva para este dia.
                </p>
              ) : (
                <ul className="space-y-2">
                  {bookings.map((b) => {
                    const mine = b.user_id === user?.id;
                    return (
                      <li
                        key={b.id}
                        className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                        style={{ borderColor: "var(--luo-mist)" }}
                      >
                        <div style={{ color: "var(--luo-sage-dark)" }}>
                          <span className="font-medium">
                            {new Date(b.starts_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" – "}
                            {new Date(b.ends_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="ml-2 opacity-70">
                            {mine ? "você" : b.profiles?.full_name ?? "reservado"}
                          </span>
                          {b.notes && <span className="ml-2 opacity-60">· {b.notes}</span>}
                        </div>
                        {mine && (
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id)}
                            className="text-xs underline"
                            style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}
                          >
                            cancelar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
