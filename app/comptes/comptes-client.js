"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Loader2, AlertCircle, KeyRound, TrendingUp, Eye, EyeOff, Dices, Users } from "lucide-react";
import { createAccount, updateAccount, deleteAccount, setInvestorPassword } from "./actions";
import { EnTete, Champ, Vide, Bandeau, useToast, useConfirm } from "@/components/ui";
import { initiales } from "@/lib/format";

const emptyForm = () => ({ email: "", password: "", nom: "", role: "proprietaire" });

const ROLES = {
  admin: { label: "Gestionnaire", couleur: "var(--fleet-bright)" },
  proprietaire: { label: "Propriétaire", couleur: "var(--purple)" },
};

const fmtDateHeure = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

// Sans les caractères qui se confondent à la lecture (0/O, 1/l/I).
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const motDePasseAleatoire = (longueur = 10) => {
  const alea = new Uint32Array(longueur);
  crypto.getRandomValues(alea);
  return Array.from(alea, (n) => ALPHABET[n % ALPHABET.length]).join("");
};

export default function ComptesClient({ profiles, currentUserId, serviceKeyConfigured, investorPasswordSetAt }) {
  const router = useRouter();
  const toast = useToast();
  const confirmer = useConfirm();

  const [rows, setRows] = useState(profiles);
  const [form, setForm] = useState(emptyForm());
  const [voir, setVoir] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [motDePasseInvestisseur, setMotDePasseInvestisseur] = useState("");
  const [majInvestisseur, setMajInvestisseur] = useState(false);
  const [definiLe, setDefiniLe] = useState(investorPasswordSetAt);

  // Après une création, le serveur renvoie la liste à jour.
  useEffect(() => { setRows(profiles); }, [profiles]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast("Le mot de passe doit comporter au moins 6 caractères.", "error");
    setCreating(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, v));
      const res = await createAccount(fd);
      if (res?.error) return toast(res.error, "error");
      toast("Compte créé — transmettez l'e-mail et le mot de passe à la personne.");
      setForm(emptyForm());
      router.refresh();
    } catch (err) {
      toast(err?.message || "La création a échoué.", "error");
    } finally {
      setCreating(false);
    }
  };

  const enregistrer = async (id, patch) => {
    const avant = profiles.find((p) => p.id === id) || {};
    const ligne = { ...rows.find((r) => r.id === id), ...patch };
    setRows((r) => r.map((x) => (x.id === id ? ligne : x)));
    setSavingId(id);
    try {
      const res = await updateAccount(id, { nom: ligne.nom, role: ligne.role });
      if (res?.error) {
        toast(res.error, "error");
        setRows((r) => r.map((x) => (x.id === id ? { ...x, nom: avant.nom, role: avant.role } : x)));
      } else if (patch.role) {
        toast(`Rôle modifié : ${ROLES[patch.role]?.label}`);
      }
    } catch (err) {
      toast(err?.message || "La mise à jour a échoué.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const onRole = async (r, role) => {
    if (role === "admin") {
      const ok = await confirmer({
        titre: "Donner les droits de gestionnaire ?",
        message: `${r.nom || r.email} pourra voir et modifier toute la flotte : saisies, paiements, avances, comptes.`,
        confirmer: "Donner les droits",
      });
      if (!ok) return;
    }
    await enregistrer(r.id, { role });
  };

  const onDelete = async (r) => {
    const ok = await confirmer({
      titre: "Supprimer ce compte ?",
      message: `${r.nom ? `${r.nom} — ` : ""}${r.email || ""}\n\nLa personne ne pourra plus se connecter. Ses véhicules sont conservés, mais ne seront plus rattachés à aucun compte.`,
      confirmer: "Supprimer le compte",
      danger: true,
    });
    if (!ok) return;
    setSavingId(r.id);
    try {
      const res = await deleteAccount(r.id);
      if (res?.error) return toast(res.error, "error");
      toast("Compte supprimé");
      setRows((x) => x.filter((y) => y.id !== r.id));
      router.refresh();
    } catch (err) {
      toast(err?.message || "La suppression a échoué.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const onSetInvestorPassword = async (e) => {
    e.preventDefault();
    const valeur = motDePasseInvestisseur.trim();
    if (valeur.length < 4) return;
    if (definiLe) {
      const ok = await confirmer({
        titre: "Changer le mot de passe investisseur ?",
        message: "Toutes les personnes connectées avec l'ancien mot de passe perdront l'accès immédiatement.",
        confirmer: "Changer le mot de passe",
      });
      if (!ok) return;
    }
    setMajInvestisseur(true);
    try {
      const fd = new FormData();
      fd.set("password", valeur);
      const res = await setInvestorPassword(fd);
      if (res?.error) return toast(res.error, "error");
      toast("Mot de passe investisseur mis à jour");
      setMotDePasseInvestisseur("");
      setDefiniLe(new Date().toISOString());
      router.refresh();
    } catch (err) {
      toast(err?.message || "La mise à jour a échoué.", "error");
    } finally {
      setMajInvestisseur(false);
    }
  };

  return (
    <main className="page animate-fade-up">
      <EnTete
        titre="Comptes"
        description="Les accès des propriétaires et des gestionnaires. Une fois le compte créé, rattachez-lui ses véhicules depuis l'onglet « Véhicules »."
      />

      {!serviceKeyConfigured && (
        <Bandeau couleur="var(--red)" className="mb-5">
          <strong className="text-[var(--text-ink)]">Configuration incomplète : clé <code>SUPABASE_SERVICE_ROLE_KEY</code> manquante.</strong>{" "}
          La création et la suppression de comptes resteront indisponibles tant qu&apos;elle n&apos;est pas renseignée.
          Elle se trouve dans Supabase (Project Settings → API → <code>service_role</code>) et doit être ajoutée aux
          variables d&apos;environnement de l&apos;hébergeur, puis le site redéployé.
        </Bandeau>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* -------------------------------------------- Comptes existants */}
        <section className="carte min-w-0 overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-[var(--border-line)] px-4 py-3.5 text-sm font-semibold text-[var(--text-ink)] sm:px-5">
            <Users size={16} color="var(--fleet-bright)" /> Comptes existants
            <span className="ml-auto text-xs font-medium text-[var(--text-slate-light)]">{rows.length}</span>
          </h2>
          {rows.length === 0 ? (
            <Vide icone={Users} titre="Aucun compte pour l'instant" />
          ) : (
            <ul className="divide-y divide-[var(--border-line)]">
              {rows.map((r) => {
                const isSelf = r.id === currentUserId;
                const role = ROLES[r.role] || ROLES.proprietaire;
                return (
                  <li key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: `color-mix(in srgb, ${role.couleur} 15%, transparent)`, color: role.couleur }}
                        aria-hidden="true"
                      >
                        {initiales(r.nom || r.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          aria-label="Nom"
                          className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-base font-medium text-[var(--text-ink)] placeholder:font-normal placeholder:text-[var(--text-slate-light)] hover:border-[var(--border-line)] focus:border-[var(--fleet-bright)] focus:outline-none sm:text-sm"
                          value={r.nom || ""}
                          placeholder="Ajouter un nom"
                          onChange={(e) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, nom: e.target.value } : y)))}
                          onBlur={(e) => {
                            const avant = profiles.find((p) => p.id === r.id)?.nom || "";
                            if (e.target.value.trim() !== avant.trim()) enregistrer(r.id, { nom: e.target.value });
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        />
                        <div className="truncate px-1.5 text-xs text-[var(--text-slate)]">
                          {r.email || "—"}
                          {isSelf && <span className="ml-1.5 font-medium text-[var(--fleet-bright)]">· vous</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pl-[3.25rem] sm:pl-0">
                      {savingId === r.id && <Loader2 size={15} className="animate-spin text-[var(--text-slate-light)]" />}
                      <select
                        aria-label="Rôle"
                        value={r.role}
                        disabled={isSelf || savingId === r.id}
                        title={isSelf ? "Vous ne pouvez pas modifier votre propre rôle" : undefined}
                        onChange={(e) => onRole(r, e.target.value)}
                        className="champ w-auto flex-1 py-1.5 sm:flex-none"
                      >
                        <option value="proprietaire">Propriétaire</option>
                        <option value="admin">Gestionnaire</option>
                      </select>
                      <button
                        onClick={() => onDelete(r)}
                        disabled={isSelf || savingId === r.id}
                        aria-label="Supprimer ce compte"
                        title={isSelf ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer ce compte"}
                        className="btn-icone danger h-9 w-9"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          {/* ------------------------------------------ Créer un compte */}
          <form onSubmit={onCreate} className="carte p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
              <UserPlus size={16} color="var(--fleet-bright)" /> Créer un compte
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Champ label="Adresse e-mail">
                <input type="email" required autoComplete="off" className="champ" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="proprietaire@exemple.com" />
              </Champ>
              <Champ label="Nom">
                <input className="champ" autoComplete="off" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Serigne Modou Diop" />
              </Champ>
              <Champ label="Mot de passe" aide="6 caractères minimum. À transmettre vous-même à la personne.">
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type={voir ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="champ font-figures pr-10"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <button type="button" onClick={() => setVoir((v) => !v)} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--text-slate-light)] hover:text-[var(--text-ink)]">
                      {voir ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button type="button" onClick={() => { setForm({ ...form, password: motDePasseAleatoire() }); setVoir(true); }} title="Générer un mot de passe" className="btn btn-contour shrink-0 px-3">
                    <Dices size={16} /> <span className="hidden sm:inline xl:hidden 2xl:inline">Générer</span>
                  </button>
                </div>
              </Champ>
              <Champ label="Rôle" aide={form.role === "admin" ? "Voit et modifie toute la flotte." : "Ne voit que les véhicules qui lui sont rattachés."}>
                <select className="champ" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="proprietaire">Propriétaire</option>
                  <option value="admin">Gestionnaire</option>
                </select>
              </Champ>
            </div>
            <button type="submit" disabled={creating || !form.email || !form.password} className="btn btn-primaire mt-5 w-full sm:w-auto xl:w-full">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Créer le compte
            </button>
          </form>

          {/* ------------------------------- Accès à l'espace investisseur */}
          <form onSubmit={onSetInvestorPassword} className="carte p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
              <TrendingUp size={16} color="var(--fleet-bright)" /> Espace investisseur
            </h2>
            <p className="mb-4 mt-1.5 text-xs leading-relaxed text-[var(--text-slate)]">
              La page <code>/investisseur</code> s&apos;ouvre avec un simple mot de passe, sans compte ni adresse e-mail.
            </p>

            <Bandeau couleur={definiLe ? "var(--green)" : "var(--red)"} icone={definiLe ? KeyRound : AlertCircle} className="mb-4">
              {definiLe ? (
                <>
                  Mot de passe défini le <strong className="text-[var(--text-ink)]" suppressHydrationWarning>{fmtDateHeure(definiLe)}</strong>.
                  Il est enregistré chiffré : il ne peut plus être relu, seulement remplacé.
                </>
              ) : (
                <>
                  <strong className="text-[var(--text-ink)]">Le mot de passe par défaut est encore actif.</strong>{" "}
                  Définissez-en un nouveau pour sécuriser l&apos;accès.
                </>
              )}
            </Bandeau>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end xl:flex-col xl:items-stretch">
              <Champ label="Nouveau mot de passe" className="flex-1">
                <input className="champ font-figures" autoComplete="off" minLength={4} value={motDePasseInvestisseur} onChange={(e) => setMotDePasseInvestisseur(e.target.value)} placeholder="4 caractères minimum" />
              </Champ>
              <button type="submit" disabled={majInvestisseur || motDePasseInvestisseur.trim().length < 4} className="btn btn-primaire">
                {majInvestisseur ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                Mettre à jour
              </button>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-slate-light)]">
              Changer le mot de passe referme immédiatement l&apos;accès de toutes les personnes qui utilisaient l&apos;ancien.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
