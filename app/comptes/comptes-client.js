"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Loader2, AlertCircle, KeyRound, TrendingUp } from "lucide-react";
import { createAccount, updateAccount, deleteAccount, setInvestorPassword } from "./actions";

const COLORS = { ink: "var(--text-ink)", fleet: "var(--fleet)", green: "var(--green)", red: "var(--red)", line: "var(--border-line)" };
const inputClass =
  "w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--text-slate)]">{label}</span>
      {children}
    </label>
  );
}

const emptyForm = () => ({ email: "", password: "", nom: "", role: "proprietaire" });

const fmtDateHeure = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ComptesClient({
  profiles,
  currentUserId,
  serviceKeyConfigured,
  investorPasswordSetAt,
}) {
  const router = useRouter();
  const [rows, setRows] = useState(profiles);
  const [form, setForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState(null);
  const [motDePasseInvestisseur, setMotDePasseInvestisseur] = useState("");
  const [majInvestisseur, setMajInvestisseur] = useState(false);
  const [definiLe, setDefiniLe] = useState(investorPasswordSetAt);

  const onSetInvestorPassword = async () => {
    if (motDePasseInvestisseur.trim().length < 4) return;
    setMajInvestisseur(true);
    try {
      const fd = new FormData();
      fd.set("password", motDePasseInvestisseur.trim());
      const res = await setInvestorPassword(fd);
      if (res?.error) {
        showToast("Erreur : " + res.error, "error");
      } else {
        showToast("Mot de passe investisseur mis à jour");
        setMotDePasseInvestisseur("");
        setDefiniLe(new Date().toISOString());
        router.refresh();
      }
    } catch (e) {
      showToast("Erreur : " + (e?.message || "échec de la mise à jour"), "error");
    } finally {
      setMajInvestisseur(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === "error" ? 7000 : 3000);
  };

  const onCreate = async () => {
    if (!form.email || !form.password) return;
    setCreating(true);
    try {
      const fd = new FormData();
      fd.set("email", form.email);
      fd.set("password", form.password);
      fd.set("nom", form.nom);
      fd.set("role", form.role);
      const res = await createAccount(fd);
      if (res?.error) {
        showToast("Erreur : " + res.error, "error");
      } else {
        showToast("Compte créé");
        setForm(emptyForm());
        router.refresh();
      }
    } catch (e) {
      showToast("Erreur : " + (e?.message || "échec de la création"), "error");
    } finally {
      setCreating(false);
    }
  };

  const updateRow = (id, patch) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const onSaveRow = (row) => {
    setSavingId(row.id);
    startTransition(async () => {
      try {
        const res = await updateAccount(row.id, { nom: row.nom, role: row.role });
        if (res?.error) showToast("Erreur : " + res.error, "error");
      } catch (e) {
        showToast("Erreur : " + (e?.message || "échec de la mise à jour"), "error");
      } finally {
        setSavingId(null);
      }
    });
  };

  const onDelete = (id) => {
    if (!confirm("Supprimer ce compte ? Ses véhicules resteront mais ne seront plus rattachés à personne.")) return;
    startTransition(async () => {
      try {
        const res = await deleteAccount(id);
        if (res?.error) showToast("Erreur : " + res.error, "error");
        else {
          showToast("Compte supprimé");
          setRows((r) => r.filter((x) => x.id !== id));
        }
      } catch (e) {
        showToast("Erreur : " + (e?.message || "échec de la suppression"), "error");
      }
    });
  };

  return (
    <main className="px-6 md:px-10 py-8 max-w-4xl mx-auto">
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 text-white"
          style={{ backgroundColor: toast.type === "error" ? COLORS.red : COLORS.green }}
        >
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <h1 className="text-lg font-semibold mb-1" style={{ color: COLORS.ink }}>Comptes</h1>
      <p className="text-xs text-[var(--text-slate-light)] mb-6">
        Crée les comptes de connexion des propriétaires et des gestionnaires. Rattache ensuite les véhicules depuis l'onglet « Véhicules ».
      </p>

      {!serviceKeyConfigured && (
        <div className="flex items-start gap-2 text-sm rounded-xl px-4 py-3 mb-6 border" style={{ color: COLORS.red, borderColor: COLORS.red, backgroundColor: "color-mix(in srgb, var(--red) 8%, transparent)" }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Clé <code>SUPABASE_SERVICE_ROLE_KEY</code> manquante</div>
            <div className="text-xs mt-1 text-[var(--text-slate)]">
              La création et la suppression de comptes ne fonctionneront pas tant qu'elle n'est pas ajoutée.
              Copie-la depuis Supabase (Project Settings → API → <code>service_role</code>), mets-la dans <code>.env.local</code>
              en local et dans les variables d'environnement Vercel, puis redémarre / redéploie le site.
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-5 md:p-6 mb-6">
        <div className="text-sm font-semibold mb-5" style={{ color: COLORS.ink }}>Créer un compte</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ex: proprietaire@email.com" />
          </Field>
          <Field label="Mot de passe">
            <input type="text" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6 caractères minimum" />
          </Field>
          <Field label="Nom">
            <input className={inputClass} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Serigne Modou Diop" />
          </Field>
          <Field label="Rôle">
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="proprietaire">Propriétaire</option>
              <option value="admin">Gestionnaire (admin)</option>
            </select>
          </Field>
        </div>
        <button
          onClick={onCreate}
          disabled={creating || !form.email || !form.password}
          className="mt-6 flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
          style={{ backgroundColor: COLORS.fleet }}
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          Créer le compte
        </button>
      </div>

      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] overflow-hidden">
        <div className="px-5 py-4 text-sm font-semibold border-b" style={{ color: COLORS.ink, borderColor: COLORS.line }}>
          Comptes existants
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[var(--text-slate-light)]">Aucun compte pour l'instant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-page)" }}>
                  {["Email", "Nom", "Rôle", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSelf = r.id === currentUserId;
                  return (
                    <tr key={r.id} className="border-t" style={{ borderColor: COLORS.line }}>
                      <td className="px-5 py-2 text-[var(--text-slate)]">{r.email || "—"}</td>
                      <td className="px-5 py-2">
                        <input
                          className="bg-transparent border-b border-transparent hover:border-[var(--border-line)] focus:border-[var(--fleet)] focus:outline-none text-sm w-full"
                          value={r.nom || ""}
                          onChange={(e) => updateRow(r.id, { nom: e.target.value })}
                          onBlur={() => onSaveRow(rows.find((row) => row.id === r.id))}
                        />
                      </td>
                      <td className="px-5 py-2">
                        <select
                          value={r.role}
                          disabled={isSelf}
                          onChange={(e) => {
                            const role = e.target.value;
                            updateRow(r.id, { role });
                            onSaveRow({ ...r, role });
                          }}
                          className="text-xs font-medium bg-transparent border border-[var(--border-line)] rounded-lg px-2 py-1 disabled:opacity-60"
                        >
                          <option value="proprietaire">Propriétaire</option>
                          <option value="admin">Gestionnaire</option>
                        </select>
                        {isSelf && <span className="text-[10px] text-[var(--text-slate-light)] ml-1.5">(vous)</span>}
                      </td>
                      <td className="px-5 py-2">
                        {savingId === r.id && <Loader2 size={14} className="animate-spin text-[var(--text-slate-light)] inline-block mr-2" />}
                        <button
                          onClick={() => onDelete(r.id)}
                          disabled={isSelf || pending}
                          className="text-[var(--text-slate-light)] hover:text-[var(--red)] disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Accès à l'espace investisseur */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-5 md:p-6 mt-6">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}>
          <TrendingUp size={15} color={COLORS.fleet} /> Accès à l&apos;espace investisseur
        </div>
        <p className="text-xs text-[var(--text-slate-light)] mt-2 mb-4 leading-relaxed max-w-2xl">
          La page <code>/investisseur</code> est ouverte à toute personne disposant du mot de passe,
          sans création de compte ni adresse e-mail. Vous pouvez le changer à tout moment ci-dessous.
        </p>

        <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 mb-4" style={{ backgroundColor: "var(--bg-page)" }}>
          <KeyRound size={14} className="mt-0.5 shrink-0" style={{ color: definiLe ? COLORS.green : COLORS.red }} />
          <div className="text-[var(--text-slate)] leading-relaxed">
            {definiLe ? (
              <>
                Mot de passe personnalisé, défini le <strong>{fmtDateHeure(definiLe)}</strong>.
                Il est enregistré chiffré : il ne peut plus être relu, seulement remplacé.
              </>
            ) : (
              <>
                <strong style={{ color: COLORS.red }}>Mot de passe par défaut encore actif.</strong>{" "}
                Il figure dans le code source du projet, donc visible de quiconque y a accès —
                définissez-en un nouveau ci-dessous.
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <Field label="Nouveau mot de passe">
              <input
                type="text"
                className={inputClass + " sm:w-64"}
                value={motDePasseInvestisseur}
                onChange={(e) => setMotDePasseInvestisseur(e.target.value)}
                placeholder="4 caractères minimum"
              />
            </Field>
          </div>
          <button
            onClick={onSetInvestorPassword}
            disabled={majInvestisseur || motDePasseInvestisseur.trim().length < 4}
            className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
            style={{ backgroundColor: COLORS.fleet }}
          >
            {majInvestisseur ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Mettre à jour
          </button>
        </div>

        <p className="text-[11px] text-[var(--text-slate-light)] mt-3 leading-relaxed">
          Changer le mot de passe <strong>referme immédiatement l&apos;accès</strong> à toutes les
          personnes connectées avec l&apos;ancien : c&apos;est le moyen de couper l&apos;accès à
          quelqu&apos;un à qui vous l&apos;aviez communiqué.
        </p>
      </div>
    </main>
  );
}
