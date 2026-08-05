import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  createSessionToken,
  getSessionCookieOptions,
  getStateCookieOptions,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME
} from "@/lib/session";
import { isEmailAllowed } from "@/lib/notion";
import { sendAccessRequestEmail } from "@/lib/email";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/release-config";

export const runtime = "nodejs";

const ACCESS_REQUEST_COOKIE_NAME = "artist_house_access_requested";

export async function GET(request) {
  const env = getEnv();
  const requestUrl = new URL(request.url);
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const redirectHome = new URL("/", request.url);

  if (!code || !state || !stateCookie || state !== stateCookie) {
    redirectHome.searchParams.set("auth", "state_error");
    const invalidResponse = NextResponse.redirect(redirectHome);
    invalidResponse.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
      ...getStateCookieOptions(),
      maxAge: 0
    });
    return invalidResponse;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("Google token exchange failed.");
  }

  const tokenPayload = await tokenResponse.json();
  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`
    }
  });

  if (!userInfoResponse.ok) {
    throw new Error("Failed to load Google user profile.");
  }

  const profile = await userInfoResponse.json();
  const email = String(profile.email).trim().toLowerCase();
  // Artist House team members always get in; everyone else goes through the Notion allowlist.
  const authorized = email.endsWith(INTERNAL_EMAIL_DOMAIN) || (await isEmailAllowed(email));
  const sessionToken = await createSessionToken({
    email,
    name: profile.name || "",
    picture: profile.picture || "",
    authorized
  });

  const response = NextResponse.redirect(redirectHome);

  if (!authorized) {
    const alreadyRequested = request.cookies.get(ACCESS_REQUEST_COOKIE_NAME)?.value === email;

    if (!alreadyRequested) {
      try {
        const sent = await sendAccessRequestEmail({ email, name: profile.name || "" });

        if (sent) {
          response.cookies.set(ACCESS_REQUEST_COOKIE_NAME, email, getSessionCookieOptions());
        }
      } catch (error) {
        console.error("Access request email failed:", error);
      }
    }
  }

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
    ...getStateCookieOptions(),
    maxAge: 0
  });
  return response;
}
