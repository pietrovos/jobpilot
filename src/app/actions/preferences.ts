"use server";

import { cookies } from "next/headers";
import { LAYOUT_COOKIE, parseLayout } from "@/app/application-layouts";

// Setting a cookie in a Server Action re-renders the current page with it.
export async function setApplicationLayout(layout: string) {
  (await cookies()).set(LAYOUT_COOKIE, parseLayout(layout), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
