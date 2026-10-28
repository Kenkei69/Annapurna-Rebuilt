import { NextResponse } from "next/server";
import { authCookieConfig } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.set(authCookieConfig.name, "", {
    ...authCookieConfig.options,
    maxAge: 0,
  });
  return response;
}
