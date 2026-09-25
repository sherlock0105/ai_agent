import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.APP_SECRET || !process.env.ALLOWED_GOOGLE_EMAIL) return NextResponse.redirect(new URL('/?setup=google', req.url));
  const state = randomBytes(24).toString('hex');
  const redirect = `${new URL(req.url).origin}/api/auth/callback`;
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email', access_type: 'offline', prompt: 'consent', state });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set('oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
  return res;
}
