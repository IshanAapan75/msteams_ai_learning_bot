import { NextResponse } from "next/server";

const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) {
    return ["*"];
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) {
    return allowedOrigins.includes("*") ? "*" : allowedOrigins[0];
  }
  if (allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowedOrigins[0] || "*";
}

export function middleware(request) {
  const responseHeaders = new Headers();
  const requestOrigin = request.headers.get("origin");
  const origin = getAllowedOrigin(requestOrigin);

  responseHeaders.set("Access-Control-Allow-Origin", origin);
  responseHeaders.set("Access-Control-Allow-Credentials", "true");
  responseHeaders.set(
    "Access-Control-Allow-Headers",
    request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization"
  );
  responseHeaders.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,PATCH,OPTIONS"
  );

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: responseHeaders });
  }

  const response = NextResponse.next();
  responseHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
