import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
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

type Room = { id: string; name: string; description: string | null; is_active: boolean };
type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  isAdmin: boolean;
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
type Purchase = {
  id: string;
  user_id: string;
  price_paid: number;
  units_included: number;
  units_used: number;
  payment_status: "pending" | "confirmed";
  purchased_at: string;
  expires_at: string | null;
  plans: { name: string; rooms: { name: string } | null } | null;
  bookings: { starts_at: string; ends_at: string }[];
};

const PLAN_TYPE_LABEL: Record<Plan["plan_type"], string> = {
  combo: "Combo",
  mensalista: "Mensalista",
  turno_avulso: "Turno avulso",
  hora_avulsa: "Hora avulsa",
};

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);

  const [saleMemberId, setSaleMemberId] = useState("");
  const [salePlanId, setSalePlanId] = useState("");
  const [mensalistaStartDate, setMensalistaStartDate] = useState("");
  const [mensalistaShift, setMensalistaShift] = useState<"manha" | "tarde">("manha");
  const [savingSale, setSavingSale] = useState(false);

  useEffect(() => {
    void Promise.all([loadRooms(), loadMembers(), loadPlans(), loadPurchases()]).finally(() =>
      setLoading(false),
    );
  }, []);

  async function loadRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, description, is_active")
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

  async function loadPlans() {
    const { data, error } = await supabase
      .from("plans")
      .select("id, room_id, name, plan_type, price, units_included, unit, validity_days, rooms(name)")
      .eq("is_active", true)
      .order("name");
    if (error) toast.error("Erro ao carregar planos: " + error.message);
    else setPlans((data as unknown as Plan[]) ?? []);
  }

  async function loadPurchases() {
    const { data, error } = await supabase
      .from("plan_purchases")
      .select(
        "id, user_id, price_paid, units_included, units_used, payment_status, purchased_at, expires_at, plans(name, rooms(name)), bookings(starts_at, ends_at)",
      )
      .order("purchased_at", { ascending: false });
    if (error) toast.error("Erro ao carregar vendas: " + error.message);
    else setPurchases((data as unknown as Purchase[]) ?? []);
  }

  async function confirmPurchase(id: string) {
    const { error } = await supabase
      .from("plan_purchases")
      .update({ payment_status: "confirmed" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pagamento confirmado!");
      void loadPurchases();
    }
  }

  async function rejectPurchase(purchase: Purchase) {
    const { error: bErr } = await supabase.from("bookings").delete().eq("plan_purchase_id", purchase.id);
    if (bErr) return toast.error(bErr.message);
    const { error: pErr } = await supabase.from("plan_purchases").delete().eq("id", purchase.id);
    if (pErr) return toast.error(pErr.message);
    toast.success("Compra recusada e horários liberados.");
    void loadPurchases();
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
      .update({ is_active: !room.is_active })
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

  async function handleRegisterSale(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!saleMemberId || !salePlanId) {
      toast.error("Escolha o cliente e o plano.");
      return;
    }
    const plan = plans.find((p) => p.id === salePlanId);
    if (!plan) return;

    if (plan.plan_type === "mensalista" && !mensalistaStartDate) {
      toast.error("Escolha a primeira data do mensalista.");
      return;
    }

    setSavingSale(true);
    try {
      if (plan.plan_type !== "mensalista") {
        const expiresAt = plan.validity_days
          ? new Date(Date.now() + plan.validity_days * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const { error } = await supabase.from("plan_purchases").insert({
          plan_id: plan.id,
          user_id: saleMemberId,
          created_by: user.id,
          price_paid: plan.price,
          unit: plan.unit,
          units_included: plan.units_included,
          expires_at: expiresAt,
          payment_status: "confirmed",
        });
        if (error) throw error;
        toast.success("Venda registrada!");
      } else {
        const { data: purchase, error: pErr } = await supabase
          .from("plan_purchases")
          .insert({
            plan_id: plan.id,
            user_id: saleMemberId,
            created_by: user.id,
            price_paid: plan.price,
            unit: plan.unit,
            units_included: plan.units_included,
            units_used: plan.units_included,
            payment_status: "confirmed",
          })
          .select("id")
          .single();
        if (pErr) throw pErr;

        const [startH, endH] = mensalistaShift === "manha" ? [8, 12] : [13, 17];
        const failedDates: string[] = [];
        for (let week = 0; week < plan.units_included; week++) {
          const date = addDays(mensalistaStartDate, week * 7);
          const { error: bErr } = await supabase.from("bookings").insert({
            room_id: plan.room_id,
            user_id: saleMemberId,
            starts_at: `${date}T${String(startH).padStart(2, "0")}:00:00`,
            ends_at: `${date}T${String(endH).padStart(2, "0")}:00:00`,
            plan_purchase_id: purchase.id,
          });
          if (bErr) failedDates.push(date);
        }
        if (failedDates.length) {
          toast.error(
            `Venda registrada, mas ${failedDates.length} semana(s) já estavam ocupadas: ${failedDates.join(", ")}`,
          );
        } else {
          toast.success("Mensalista registrado com as 4 semanas agendadas!");
        }
      }

      setSaleMemberId("");
      setSalePlanId("");
      setMensalistaStartDate("");
      void loadPurchases();
    } catch (err) {
      toast.error("Erro ao registrar venda: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingSale(false);
    }
  }

  const inputStyle = { borderColor: "var(--luo-mist)", fontFamily: "Archivo, sans-serif" };
  const selectedPlan = plans.find((p) => p.id === salePlanId);
  const membersById = new Map(members.map((m) => [m.id, m]));

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
          <div className="space-y-6">
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
                          {!r.is_active && <span className="ml-2 text-xs opacity-60">(inativa)</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleRoomActive(r)}
                          className="text-xs underline"
                          style={{ opacity: 0.7 }}
                        >
                          {r.is_active ? "desativar" : "ativar"}
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

            {/* Pagamentos pendentes */}
            {purchases.some((p) => p.payment_status === "pending") && (
              <section className="rounded-xl bg-white p-6 shadow-sm border-2" style={{ borderColor: "var(--luo-rose)" }}>
                <h2 className="text-lg mb-4" style={{ color: "var(--luo-sage-dark)" }}>
                  Pagamentos pendentes
                </h2>
                <ul className="space-y-2">
                  {purchases
                    .filter((p) => p.payment_status === "pending")
                    .map((p) => {
                      const member = membersById.get(p.user_id);
                      const times = p.bookings
                        .slice()
                        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                        .map(
                          (b) =>
                            `${new Date(b.starts_at).toLocaleDateString("pt-BR")} ${new Date(
                              b.starts_at,
                            ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
                        )
                        .join(", ");
                      return (
                        <li
                          key={p.id}
                          className="rounded-lg border px-4 py-3 text-sm"
                          style={{ borderColor: "var(--luo-mist)", color: "var(--luo-sage-dark)" }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-medium">{member?.full_name ?? member?.email ?? "—"}</span>
                              <span className="ml-2 opacity-70">
                                {p.plans?.name} — {p.plans?.rooms?.name}
                              </span>
                              <span className="ml-2 opacity-60">{formatMoney(p.price_paid)}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => confirmPurchase(p.id)}
                                className="rounded-full px-3 py-1 text-xs text-white"
                                style={{ backgroundColor: "var(--luo-sage)" }}
                              >
                                Confirmar pagamento
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectPurchase(p)}
                                className="rounded-full px-3 py-1 text-xs border"
                                style={{ borderColor: "var(--luo-rose)", color: "var(--luo-rose)" }}
                              >
                                Recusar
                              </button>
                            </div>
                          </div>
                          {times && <div className="mt-1 text-xs opacity-60">Horários: {times}</div>}
                        </li>
                      );
                    })}
                </ul>
              </section>
            )}

            {/* Vendas de planos */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg mb-4" style={{ color: "var(--luo-sage-dark)" }}>
                Vendas de planos
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                Pagamento acontece por fora (pix, dinheiro etc). Registre aqui a venda para liberar os
                créditos do cliente. No Mensalista, as 4 semanas já são agendadas automaticamente no
                mesmo dia da semana e turno escolhidos.
              </p>

              <form onSubmit={handleRegisterSale} className="grid gap-3 mb-6 md:grid-cols-2">
                <select
                  value={saleMemberId}
                  onChange={(e) => setSaleMemberId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  <option value="">Cliente...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name ?? m.email}
                    </option>
                  ))}
                </select>

                <select
                  value={salePlanId}
                  onChange={(e) => setSalePlanId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  <option value="">Plano...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {PLAN_TYPE_LABEL[p.plan_type]} — {p.name} — {p.rooms?.name} — {formatMoney(p.price)}
                    </option>
                  ))}
                </select>

                {selectedPlan?.plan_type === "mensalista" && (
                  <>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                        Primeira data (repete no mesmo dia da semana por 4 semanas)
                      </label>
                      <input
                        type="date"
                        value={mensalistaStartDate}
                        onChange={(e) => setMensalistaStartDate(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--luo-sage-dark)" }}>
                        Turno
                      </label>
                      <select
                        value={mensalistaShift}
                        onChange={(e) => setMensalistaShift(e.target.value as "manha" | "tarde")}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <option value="manha">Manhã (08:00–12:00)</option>
                        <option value="tarde">Tarde (13:00–17:00)</option>
                      </select>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={savingSale}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 md:col-span-2"
                  style={{ backgroundColor: "var(--luo-sage)", color: "white" }}
                >
                  {savingSale ? "Registrando..." : "Registrar venda"}
                </button>
              </form>

              {purchases.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--luo-sage-dark)", opacity: 0.7 }}>
                  Nenhuma venda registrada ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {purchases.map((p) => {
                    const member = membersById.get(p.user_id);
                    const expired = p.expires_at ? new Date(p.expires_at) < new Date() : false;
                    return (
                      <li
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                        style={{ borderColor: "var(--luo-mist)", color: "var(--luo-sage-dark)" }}
                      >
                        <div>
                          <span className="font-medium">{member?.full_name ?? member?.email ?? "—"}</span>
                          <span className="ml-2 opacity-70">
                            {p.plans?.name} — {p.plans?.rooms?.name}
                          </span>
                          <span className="ml-2 opacity-60">
                            {p.units_used}/{p.units_included} usados
                          </span>
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-xs"
                            style={{
                              backgroundColor:
                                p.payment_status === "confirmed" ? "var(--luo-sage)" : "var(--luo-rose)",
                              color: "white",
                            }}
                          >
                            {p.payment_status === "confirmed" ? "confirmado" : "pendente"}
                          </span>
                          {p.expires_at && (
                            <span className="ml-2 text-xs opacity-60">
                              {expired ? "expirado em " : "válido até "}
                              {new Date(p.expires_at).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                        <span className="text-xs opacity-60">{formatMoney(p.price_paid)}</span>
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
