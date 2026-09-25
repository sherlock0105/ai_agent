import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { storeSession } from '@/lib/calendar';
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const expected = req.cookies.get('oauth_state')?.value || '';
  const valid = state.length === expected.length && !!state && timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!valid || !url.searchParams.get('code')) return NextResponse.redirect(new URL('/?error=oauth', req.url));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code')!, client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', redirect_uri: `${url.origin}/api/auth/callback`, grant_type: 'authorization_code' }), cache: 'no-store' });
  if (!response.ok) return NextResponse.redirect(new URL('/?error=oauth', req.url));
  const token = await response.json();
  const identity = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store' });
  if (!identity.ok) return NextResponse.redirect(new URL('/?error=oauth', req.url));
  const user = await identity.json();
  if (!user.email_verified || user.email?.toLowerCase() !== process.env.ALLOWED_GOOGLE_EMAIL?.toLowerCase()) return NextResponse.redirect(new URL('/?error=account', req.url));
  const res = NextResponse.redirect(new URL('/', req.url));
  const c = storeSession(token.access_token, token.refresh_token, token.expires_in);
  res.cookies.set(c.name, c.value, c.options);
  res.cookies.delete('oauth_state');
  return res;
}
