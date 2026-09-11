import { NextResponse } from "next/server";

const SESSION_COOKIE = "enterprise_ai_session";

export async function POST() {
  const response = NextResponse.json({
    authenticated: false,
  });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}