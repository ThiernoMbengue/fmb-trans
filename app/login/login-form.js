"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { login } from "./actions";

function Envoyer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primaire mt-1 w-full py-3">
      {pending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  );
}

export default function LoginForm({ next }) {
  const [visible, setVisible] = useState(false);
  const [etat, envoyer] = useFormState(login, null);

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {etat?.error && (
        <div
          role="alert"
          className="animate-fondu flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium"
          style={{
            color: "var(--red)",
            borderColor: "color-mix(in srgb, var(--red) 35%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--red) 8%, transparent)",
          }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{etat.error}</span>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="etiquette">Adresse e-mail</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="username"
          inputMode="email"
          placeholder="vous@exemple.com"
          className="champ py-3 sm:py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="etiquette">Mot de passe</span>
        <div className="relative">
          <input
            type={visible ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            className="champ py-3 pr-11 sm:py-2.5"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--text-slate-light)] hover:text-[var(--text-ink)]"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>

      <Envoyer />
    </form>
  );
}
