import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "enterprise_ai_session";

function signSession(secret: string) {
  return createHmac("sha256", secret)
    .update("authenticated")
    .digest("hex");
}

export async function POST(
  request: NextRequest,
) {
  const appPassword =
    process.env.APP_ACCESS_PASSWORD;

  const sessionSecret =
    process.env.APP_SESSION_SECRET;

  if (!appPassword || !sessionSecret) {
    return NextResponse.json(
      {
        detail:
          "Application authentication is not configured.",
      },
      { status: 500 },
    );
  }

  const body = await request.json();

  const suppliedPassword =
    typeof body.password === "string"
      ? body.password
      : "";

  const supplied = Buffer.from(
    suppliedPassword,
  );

  const expected = Buffer.from(
    appPassword,
  );

  const passwordMatches =
    supplied.length === expected.length &&
    timingSafeEqual(
      supplied,
      expected,
    );

  if (!passwordMatches) {
    return NextResponse.json(
      { detail: "Invalid password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    authenticated: true,
  });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: signSession(sessionSecret),
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}