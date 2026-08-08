"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PASSWORD = process.env.INVESTOR_PASSWORD || "yango";

export async function unlockInvestor(formData) {
  const password = (formData.get("password") || "").trim();

  if (password !== PASSWORD) {
    redirect("/investisseur?error=1");
  }

  cookies().set({
    name: "investisseur_ok",
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });

  redirect("/investisseur");
}

export async function lockInvestor() {
  cookies().delete("investisseur_ok");
  redirect("/investisseur");
}
