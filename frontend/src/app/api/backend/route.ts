import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

const SESSION_COOKIE = "enterprise_ai_session";

const ALLOWED_ROUTES: Array<{
  method: string;
  pattern: RegExp;
}> = [
  { method: "GET", pattern: /^\/agent\/metrics$/ },
  { method: "GET", pattern: /^\/agent\/runs(?:\?.*)?$/ },
  { method: "GET", pattern: /^\/agent\/runs\/[^/]+\/traces$/ },

  { method: "POST", pattern: /^\/agent\/run$/ },

  { method: "GET", pattern: /^\/approvals(?:\?.*)?$/ },
  { method: "GET", pattern: /^\/approvals\/[^/]+$/ },
  { method: "GET", pattern: /^\/approvals\/[^/]+\/timeline$/ },
  { method: "POST", pattern: /^\/approvals\/[^/]+\/approve$/ },
  { method: "POST", pattern: /^\/approvals\/[^/]+\/reject$/ },
  { method: "POST", pattern: /^\/approvals\/[^/]+\/execute$/ },

  { method: "GET", pattern: /^\/audit\/events(?:\?.*)?$/ },

  { method: "GET", pattern: /^\/knowledge\/documents(?:\?.*)?$/ },
  { method: "POST", pattern: /^\/knowledge\/upload$/ },
  { method: "POST", pattern: /^\/knowledge\/search$/ },
  { method: "DELETE", pattern: /^\/knowledge\/documents\/[^/]+$/ },

  { method: "GET", pattern: /^\/tools$/ },
  { method: "POST", pattern: /^\/tools\/execute$/ },

  { method: "POST", pattern: /^\/external-agents\/execute$/ },

  { method: "POST", pattern: /^\/evaluations\/generate-tests$/ },

  { method: "GET", pattern: /^\/evaluations\/metrics$/ },
  { method: "GET", pattern: /^\/evaluations\/results(?:\?.*)?$/ },
  { method: "GET", pattern: /^\/evaluations\/results\/[^/]+\/failure-details$/ },

  { method: "GET", pattern: /^\/evaluations\/test-suites(?:\?.*)?$/ },
  { method: "POST", pattern: /^\/evaluations\/test-suites$/ },

  { method: "GET", pattern: /^\/evaluations\/test-suites\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/evaluations\/test-suites\/[^/]+$/ },

  { method: "POST", pattern: /^\/evaluations\/test-suites\/[^/]+\/generated-tests$/ },
  { method: "POST", pattern: /^\/evaluations\/test-suites\/[^/]+\/test-cases$/ },
  { method: "POST", pattern: /^\/evaluations\/test-suites\/[^/]+\/run$/ },
  { method: "POST", pattern: /^\/evaluations\/test-suites\/[^/]+\/external-run$/ },

  { method: "GET", pattern: /^\/evaluations\/test-suites\/[^/]+\/regression$/ },
  { method: "GET", pattern: /^\/evaluations\/test-suites\/[^/]+\/case-regression$/ },
  { method: "GET", pattern: /^\/evaluations\/test-suites\/[^/]+\/reliability-score$/ },

  { method: "GET", pattern: /^\/evaluations\/test-suite-runs(?:\?.*)?$/ },

  { method: "DELETE", pattern: /^\/evaluations\/test-cases\/[^/]+$/ },
  { method: "POST", pattern: /^\/evaluations\/test-cases\/[^/]+\/run$/ },
  { method: "POST", pattern: /^\/evaluations\/test-cases\/[^/]+\/external-run$/ },
];

function signSession(secret: string) {
  return createHmac("sha256", secret)
    .update("authenticated")
    .digest("hex");
}

function isAuthenticated(request: NextRequest) {
  const sessionSecret =
    process.env.APP_SESSION_SECRET;

  if (!sessionSecret) {
    return false;
  }

  const cookieValue =
    request.cookies.get(SESSION_COOKIE)?.value;

  if (!cookieValue) {
    return false;
  }

  const expected =
    signSession(sessionSecret);

  const suppliedBuffer =
    Buffer.from(cookieValue);

  const expectedBuffer =
    Buffer.from(expected);

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(
      suppliedBuffer,
      expectedBuffer,
    )
  );
}

function isAllowedRequest(
  method: string,
  targetPath: string,
) {
  return ALLOWED_ROUTES.some(
    (route) =>
      route.method === method &&
      route.pattern.test(targetPath),
  );
}

async function proxyRequest(
  request: NextRequest,
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      {
        detail:
          "Authentication required.",
      },
      { status: 401 },
    );
  }

  if (!BACKEND_URL) {
    return NextResponse.json(
      {
        detail:
          "BACKEND_API_URL is not configured.",
      },
      { status: 500 },
    );
  }

  if (!BACKEND_API_KEY) {
    return NextResponse.json(
      {
        detail:
          "BACKEND_API_KEY is not configured.",
      },
      { status: 500 },
    );
  }

  const targetPath =
    request.nextUrl.searchParams.get(
      "path",
    );

  if (
    !targetPath ||
    !targetPath.startsWith("/")
  ) {
    return NextResponse.json(
      {
        detail:
          "A valid backend path is required.",
      },
      { status: 400 },
    );
  }

  if (
    !isAllowedRequest(
      request.method,
      targetPath,
    )
  ) {
    return NextResponse.json(
      {
        detail:
          "Backend route is not allowed.",
      },
      { status: 403 },
    );
  }

  const backendBase =
    BACKEND_URL.endsWith("/")
      ? BACKEND_URL.slice(0, -1)
      : BACKEND_URL;

  const targetUrl =
    `${backendBase}${targetPath}`;

  const headers = new Headers();

  headers.set(
    "X-API-Key",
    BACKEND_API_KEY,
  );

  const contentType =
    request.headers.get(
      "content-type",
    );

  if (contentType) {
    headers.set(
      "Content-Type",
      contentType,
    );
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    init.body =
      await request.arrayBuffer();
  }

  try {
    const response =
      await fetch(
        targetUrl,
        init,
      );

    const responseBody =
      await response.arrayBuffer();

    const responseHeaders =
      new Headers();

    const responseContentType =
      response.headers.get(
        "content-type",
      );

    if (responseContentType) {
      responseHeaders.set(
        "Content-Type",
        responseContentType,
      );
    }

    return new NextResponse(
      responseBody,
      {
        status: response.status,
        headers: responseHeaders,
      },
    );
  } catch (error) {
    console.error(
      "Backend proxy failed:",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Could not connect to backend.",
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
) {
  return proxyRequest(request);
}

export async function POST(
  request: NextRequest,
) {
  return proxyRequest(request);
}

export async function DELETE(
  request: NextRequest,
) {
  return proxyRequest(request);
}