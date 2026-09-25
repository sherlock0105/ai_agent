import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

export type CalendarEvent = { id: string; summary: string; start: string; end: string; htmlLink?: string; allDay: boolean };
type Session = { accessToken: string; refreshToken?: string; expiresAt: number };
const cookieName = 'dohyun_google';

function key() {
  if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32) throw new Error('APP_SECRET must contain at least 32 characters');
  return createHash('sha256').update(process.env.APP_SECRET).digest();
}
function seal(value: Session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
function unseal(value: string): Session | null {
  try {
    const raw = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
  } catch { return null; }
}
export function sessionCookie(session: Session) {
  return { name: cookieName, value: seal(session), options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 } };
}
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const value = store.get(cookieName)?.value;
  if (!value) return null;
  const session = unseal(value);
  if (!session) return null;
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: session.refreshToken, grant_type: 'refresh_token' }), cache: 'no-store'
  });
  if (!res.ok) return null;
  const token = await res.json();
  const next = { accessToken: token.access_token as string, refreshToken: session.refreshToken, expiresAt: Date.now() + Number(token.expires_in) * 1000 };
  store.set(...cookieArgs(next));
  return next;
}
function cookieArgs(session: Session): [string, string, ReturnType<typeof sessionCookie>['options']] {
  const c = sessionCookie(session); return [c.name, c.value, c.options];
}
export function storeSession(accessToken: string, refreshToken: string | undefined, expiresIn: number) {
  return sessionCookie({ accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 });
}
export async function googleFetch(path: string, init?: RequestInit) {
  const session = await getSession();
  if (!session) throw new Error('CALENDAR_NOT_CONNECTED');
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/${path}`, {
    ...init, headers: { Authorization: `Bearer ${session.accessToken}`, ...init?.headers }, cache: 'no-store'
  });
  if (!res.ok) throw new Error(`GOOGLE_${res.status}`);
  return res.json();
}
export async function listEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const result = await googleFetch(`events?${params}`);
  return (result.items || []).filter((e: { status?: string }) => e.status !== 'cancelled').map((e: { id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; htmlLink?: string }) => ({
    id: e.id, summary: e.summary || '제목 없음', start: e.start.dateTime || e.start.date || '', end: e.end.dateTime || e.end.date || '', htmlLink: e.htmlLink, allDay: !e.start.dateTime
  }));
}
export function overlaps(events: CalendarEvent[], start: string, end: string) {
  const a = new Date(start).getTime(), b = new Date(end).getTime();
  return events.filter(e => new Date(e.start).getTime() < b && new Date(e.end).getTime() > a);
}
