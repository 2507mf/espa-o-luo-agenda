import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { buildPixPayload } from "@/lib/pix";

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

const ADMIN_WHATSAPP = "5581999774270";

type Credit = {
  id: string;
  units_included: number;
  units_used: number;
  expires_at: string | null;
  plans: {
    name: string;
    unit: "turno" | "hora";
    room_id: string;
    rooms: { name: string } | null;
  } | null;
};

type Booking = {
  id: string;
  room_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  profiles?: { full_name: string | null } | null;
  plan_purchases?: { payment_status: "pending" | "confirmed" } | null;
};

type Plan = {
  id: string;
  room_id: string;
  name: string;
  plan_type: "combo" | "mensalista" | "turno_avulso" | "hora_avulsa";
  price: number;
  units_included: number;
  unit: "turno" | "hora";
  validity_days: number | null;
  rooms: { name: string } | null;
};

type SlotPick = { date: string; shift: "manha" | "tarde"; hour: number };

type PendingPurchase = {
  plan: Plan;
  totalPrice: number;
  description: string;
};

const HORAS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08h às 20h

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function isUsable(c: Credit) {
  if (c.units_used >= c.units_included) return false;
  if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
  return true;
}

function AgendaPage() {
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);

  // Créditos existentes (concedidos manualmente ou de compras já confirmadas)
  const [credits, setCredits] = useState<Credit[]>([]);
  const [creditId, setCreditId] = useState<string>("");
  const [date, setDate] = useState<string>(hojeISO());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [shift, setShift] = useState<"manha" | "tarde">("manha");
  const [hour, setHour] = useState(9);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Comprar novo plano (autoatendimento)
  const [plans, setPlans] = useState<Plan[]>([]);
  const [purchasePlanId, setPurchasePlanId] = useState("");
  const [slotPicks, setSlotPicks] = useState<SlotPick[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);

  useEffect(() => {
    void Promise.all([loadCredits(), loadPlans(), loadProfile()]).finally(() => setLoading(false));
  }, []);

  const selectedCredit = credits.find((c) => c.id === creditId);
  const roomId = selectedCredit?.plans?.room_id ?? "";

  useEffect(() => {
    if (roomId) void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, date]);

  const purchasePlan = plans.find((p) => p.id === purchasePlanId);

  useEffect(() => {
    if (!purchasePlan) {
      setSlotPicks([]);
      return;
    }
    const count = purchasePlan.plan_type === "mensalista" ? 1 : purchasePlan.units_included;
    setSlotPicks(
      Array.from({ length: count }, () => ({ date: "", shift: "manha" as const, hour: 9 })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchasePlanId]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    setProfileName(data?.full_name ?? null);
  }

  async function loadCredits() {
    if (!user) return;
    const { data, error } = await supabase
      .from("plan_purchases")
      .select("id, units_included, units_used, expires_at, plans(name, unit, room_id, rooms(name))")
      .eq("user_id", user.id)
      .eq("payment_status", "confirmed")
      .order("purchased_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar seus créditos: " + error.message);
    } else {
      const list = (data as unknown as Credit[]) ?? [];
      setCredits(list);
      const firstUsable = list.find(isUsable);
      if (firstUsable && !creditId) setCreditId(firstUsable.id);
    }
  }

  async function loadPlans() {
    const { data, error } = await supabase
      .from("plans")
      .select("id, room_id, name, plan_type, price, units_included, unit, validity_days, rooms(name)")
      .eq("is_active", true)
      .order("name");
    if (error) toast.error("Erro ao carregar planos: " + error.message);
    else setPlans((data as unknown as Plan[]) ?? []);
  }

  async function loadBookings() {
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, room_id, user_id, starts_at, ends_at, notes, profiles(full_name), plan_purchases(payment_status)")
      .eq("room_id", roomId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at");
    if (error) {
      toast.error("Erro ao carregar reservas: " + error.message);
    } else {
      setBookings((data as unknown as Booking[]) ?? []);
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
    if (!user || !selectedCredit?.plans) return;
    setSaving(true);

    const unit = selectedCredit.plans.unit;
    const [startH, endH] = unit === "turno" ? (shift === "manha" ? [8, 12] : [13, 17]) : [hour, hour + 1];
    const starts_at = `${date}T${String(startH).padStart(2, "0")}:00:00`;
    const ends_at = `${date}T${String(endH).padStart(2, "0")}:00:00`;

    const { error } = await supabase.rpc("book_plan_shift", {
      _plan_purchase_id: selectedCredit.id,
      _room_id: selectedCredit.plans.room_id,
      _starts_at: starts_at,
      _ends_at: ends_at,
      _notes: notes.trim() || null,
    });

    setSaving(false);
    if (error) {
      if (error.message.includes("exclusion")) {
        toast.error("Já existe uma reserva nesse horário para esta sala.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Reserva confirmada!");
      setNotes("");
      void loadBookings();
      void loadCredits();
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) toast.error("Erro ao cancelar: " + error.message);
    else {
      toast.success("Reserva cancelada e crédito devolvido.");
      void loadBookings();
      void loadCredits();
    }
  }

  function updateSlot(index: number, patch: Partial<SlotPick>) {
    setSlotPicks((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handlePurchase(e: FormEvent) {
    e.preventDefault();
    if (!user || !purchasePlan) return;

    if (purchasePlan.plan_type === "mensalista") {
      if (!slotPicks[0]?.date) {
        toast.error("Escolha a primeira data.");
        return;
      }
    } else if (slotPicks.some((s) => !s.date)) {
      toast.error("Preencha todas as datas.");
      return;
    }

    let slots: { starts_at: string; ends_at: string }[];
    let description: string;

    if (purchasePlan.plan_type === "mensalista") {
      const first = slotPicks[0];
      const [startH, endH] = first.shift === "manha" ? [8, 12] : [13, 17];
      const dates = Array.from({ length: purchasePlan.units_included }, (_, i) =>
        addDays(first.date, i * 7),
      );
      slots = dates.map((d) => ({
        starts_at: `${d}T${String(startH).padStart(2, "0")}:00:00`,
        ends_at: `${d}T${String(endH).padStart(2, "0")}:00:00`,
      }));
      description = `${dates.map(formatDateBR).join(", ")} (${first.shift === "manha" ? "manhã" : "tarde"})`;
    } else if (purchasePlan.unit === "turno") {
      slots = slotPicks.map((s) => {
        const [startH, endH] = s.shift === "manha" ? [8, 12] : [13, 17];
        return {
          starts_at: `${s.date}T${String(startH).padStart(2, "0")}:00:00`,
          ends_at: `${s.date}T${String(endH).padStart(2, "0")}:00:00`,
        };
      });
      description = slotPicks
        .map((s) => `${formatDateBR(s.date)} (${s.shift === "manha" ? "manhã" : "tarde"})`)
        .join(", ");
    } else {
      const s = slotPicks[0];
      slots = [
        {
          starts_at: `${s.date}T${String(s.hour).padStart(2, "0")}:00:00`,
          ends_at: `${s.date}T${String(s.hour + 1).padStart(2, "0")}:00:00`,
        },
      ];
      description = `${formatDateBR(s.date)} ${String(s.hour).padStart(2, "0")}:00–${String(s.hour + 1).padStart(2, "0")}:00`;
    }

    setPurchasing(true);
    const { error } = await supabase.rpc("self_serve_purchase", {
      _plan_id: purchasePlan.id,
      _slots: slots,
      _notes: purchaseNotes.trim() || null,
    });
    setPurchasing(false);

    if (error) {
      if (error.message.includes("exclusion")) {
        toast.error("Um dos horários escolhidos já está ocupado. Escolha outro.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    setPendingPurchase({ plan: purchasePlan, totalPrice: purchasePlan.price, description });
    setPurchasePlanId("");
    setPurchaseNotes("");
    void loadBookings();
  }

  function handleNotifyWhatsapp() {
    if (!pendingPurchase) return;
    const lines = [
      "Novo agendamento pendente — Espaço Luo",
      `Cliente: ${profileName ?? user?.email ?? ""}`,
      `Plano: ${pendingPurchase.plan.name} (${pendingPurchase.plan.rooms?.name})`,
      `Horário(s): ${pendingPurchase.description}`,
      `Valor: ${formatMoney(pendingPurchase.totalPrice)}`,
      "Aguardando confirmação de pagamento via PIX.",
    ].join("\n");
    const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  }

  const selectStyle = {
    borderColor: "var(--luo-mist)",
    fontFamily: "Archivo, sans-serif",
  };

  const usableCredits = credits.filter(isUsable);
  const pixPayload = pendingPurchase ? buildPixPayload(pendingPurchase.totalPrice) : "";

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

        {pendingPurchase && (
          <section className="rounded-xl bg-white p-6 shadow-sm mb-6 border-2" style={{ borderColor: "var(--luo-sage)" }}>
            <h2 className="text-lg mb-1" style={{ color: "var(--luo-sage-dark)" }}>
              Quase lá! Pague com PIX para confirmar
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--luo-sage-dark)", opacity: 0.75 }}>
              {pendingPurchase.plan.name} — {pendingPurchase.plan.rooms?.name} — {pendingPurchase.description}
              <br />
              Valor: <strong>{formatMoney(pendingPurchase.totalPrice)}</strong>
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--luo-mist)" }}>
                <QRCodeSVG value={pixPayload} size={180} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                    Pix copia e cola
                  </label>
                  <textarea
                    readOnly
                    value={pixPayload}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                    style={selectStyle}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(pixPayload);
                    toast.success("Código PIX copiado!");
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium border"
                  style={{ borderColor: "var(--luo-sage)", color: "var(--luo-sage-dark)" }}
                >
                  Copiar código PIX
                </button>
                <button
                  type="button"
                  onClick={handleNotifyWhatsapp}
                  className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
                >
                  Avisar pagamento no WhatsApp
                </button>
                <p className="text-xs" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                  Seu horário está reservado como <strong>pendente</strong>. Assim que o pagamento for
                  confirmado, a administração libera como confirmado.
                </p>
                <button
                  type="button"
                  onClick={() => setPendingPurchase(null)}
                  className="text-xs underline"
                  style={{ color: "var(--luo-sage-dark)", opacity: 0.6 }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </section>
        )}

        {loading ? (
          <p style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>Carregando...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
              {/* Coluna: créditos + nova reserva */}
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--luo-sage-dark)" }}>
                  Meus créditos
                </h2>
                {credits.length === 0 ? (
                  <p className="text-sm mb-5" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                    Você ainda não tem créditos confirmados. Compre um plano ao lado.
                  </p>
                ) : (
                  <ul className="space-y-2 mb-5">
                    {credits.map((c) => {
                      const usable = isUsable(c);
                      const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
                      return (
                        <li
                          key={c.id}
                          className="rounded-lg border px-3 py-2 text-xs"
                          style={{
                            borderColor: creditId === c.id ? "var(--luo-sage)" : "var(--luo-mist)",
                            opacity: usable ? 1 : 0.5,
                            color: "var(--luo-sage-dark)",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {c.plans?.name} — {c.plans?.rooms?.name}
                            </span>
                            {usable && (
                              <button type="button" onClick={() => setCreditId(c.id)} className="underline">
                                {creditId === c.id ? "selecionado" : "usar"}
                              </button>
                            )}
                          </div>
                          <div className="opacity-70 mt-0.5">
                            {c.units_used}/{c.units_included} usados
                            {c.expires_at && (
                              <>
                                {" · "}
                                {expired ? "expirado em " : "válido até "}
                                {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {usableCredits.length > 0 && (
                  <>
                    <hr className="my-5" style={{ borderColor: "var(--luo-mist)" }} />
                    <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--luo-sage-dark)" }}>
                      Reservar com crédito existente
                    </h2>
                    <form onSubmit={handleCreate} className="space-y-4">
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

                      {selectedCredit?.plans?.unit === "turno" ? (
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                            Turno
                          </label>
                          <select
                            value={shift}
                            onChange={(e) => setShift(e.target.value as "manha" | "tarde")}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={selectStyle}
                          >
                            <option value="manha">Manhã (08:00–12:00)</option>
                            <option value="tarde">Tarde (13:00–17:00)</option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                            Horário (1 hora)
                          </label>
                          <select
                            value={hour}
                            onChange={(e) => setHour(Number(e.target.value))}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={selectStyle}
                          >
                            {HORAS.slice(0, -1).map((h) => (
                              <option key={h} value={h}>
                                {`${String(h).padStart(2, "0")}:00 – ${String(h + 1).padStart(2, "0")}:00`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

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
                        disabled={saving || !creditId}
                        className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
                      >
                        {saving ? "Reservando..." : "Reservar"}
                      </button>
                    </form>
                  </>
                )}
              </section>

              {/* Coluna: grade do dia + lista de reservas */}
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--luo-sage-dark)" }}>
                  Ocupação do dia {selectedCredit && `— ${selectedCredit.plans?.rooms?.name}`}
                </h2>
                {!roomId ? (
                  <p className="text-sm mb-6" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                    Selecione um crédito para ver a ocupação.
                  </p>
                ) : (
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
                )}

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
                      const pending = b.plan_purchases?.payment_status === "pending";
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
                            {pending && (
                              <span
                                className="ml-2 rounded-full px-2 py-0.5 text-xs"
                                style={{ backgroundColor: "var(--luo-rose)", color: "white" }}
                              >
                                pendente
                              </span>
                            )}
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

            {/* Comprar novo plano (autoatendimento) */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                Comprar um plano
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                Escolha o plano e os horários. Depois é só pagar com PIX — o agendamento fica pendente
                até a confirmação do pagamento.
              </p>

              <form onSubmit={handlePurchase} className="space-y-4">
                <select
                  value={purchasePlanId}
                  onChange={(e) => setPurchasePlanId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={selectStyle}
                >
                  <option value="">Escolha um plano...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.rooms?.name} — {formatMoney(p.price)}
                    </option>
                  ))}
                </select>

                {purchasePlan?.plan_type === "mensalista" && slotPicks[0] && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                        Primeira data (repete no mesmo dia da semana por 4 semanas)
                      </label>
                      <input
                        type="date"
                        min={hojeISO()}
                        value={slotPicks[0].date}
                        onChange={(e) => updateSlot(0, { date: e.target.value })}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={selectStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                        Turno
                      </label>
                      <select
                        value={slotPicks[0].shift}
                        onChange={(e) => updateSlot(0, { shift: e.target.value as "manha" | "tarde" })}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={selectStyle}
                      >
                        <option value="manha">Manhã (08:00–12:00)</option>
                        <option value="tarde">Tarde (13:00–17:00)</option>
                      </select>
                    </div>
                  </div>
                )}

                {purchasePlan && purchasePlan.plan_type !== "mensalista" && purchasePlan.unit === "turno" && (
                  <div className="space-y-3">
                    {slotPicks.map((s, i) => (
                      <div key={i} className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                            Data do turno {i + 1}
                          </label>
                          <input
                            type="date"
                            min={hojeISO()}
                            value={s.date}
                            onChange={(e) => updateSlot(i, { date: e.target.value })}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={selectStyle}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                            Turno {i + 1}
                          </label>
                          <select
                            value={s.shift}
                            onChange={(e) => updateSlot(i, { shift: e.target.value as "manha" | "tarde" })}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={selectStyle}
                          >
                            <option value="manha">Manhã (08:00–12:00)</option>
                            <option value="tarde">Tarde (13:00–17:00)</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {purchasePlan && purchasePlan.unit === "hora" && slotPicks[0] && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                        Data
                      </label>
                      <input
                        type="date"
                        min={hojeISO()}
                        value={slotPicks[0].date}
                        onChange={(e) => updateSlot(0, { date: e.target.value })}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={selectStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                        Horário (1 hora)
                      </label>
                      <select
                        value={slotPicks[0].hour}
                        onChange={(e) => updateSlot(0, { hour: Number(e.target.value) })}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={selectStyle}
                      >
                        {HORAS.slice(0, -1).map((h) => (
                          <option key={h} value={h}>
                            {`${String(h).padStart(2, "0")}:00 – ${String(h + 1).padStart(2, "0")}:00`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {purchasePlan && (
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                      Observações (opcional)
                    </label>
                    <input
                      type="text"
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={selectStyle}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={purchasing || !purchasePlan}
                  className="w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-6"
                  style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
                >
                  {purchasing ? "Processando..." : "Comprar e reservar"}
                </button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
