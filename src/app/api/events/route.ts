import { NextRequest, NextResponse } from 'next/server';
import { getSession, googleFetch, listEvents, overlaps } from '@/lib/calendar';
export async function GET(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: 'Google Calendar 연결이 필요합니다.' }, { status: 401 });
  const from = req.nextUrl.searchParams.get('from'), to = req.nextUrl.searchParams.get('to');
  if (!from || !to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(to) - Date.parse(from) > 31 * 86400000) return NextResponse.json({ error: '조회 기간은 최대 31일입니다.' }, { status: 400 });
  try { return NextResponse.json({ events: await listEvents(from, to) }); }
  catch { return NextResponse.json({ error: '일정을 불러오지 못했습니다. 다시 연결해 주세요.' }, { status: 502 }); }
}
export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: 'Google Calendar 연결이 필요합니다.' }, { status: 401 });
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  let body: { summary?: string; start?: string; end?: string; timeZone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 }); }
  const { summary, start, end } = body;
  const a = Date.parse(start || ''), b = Date.parse(end || '');
  if (!summary?.trim() || summary.length > 120 || !start || !end || !/[+-]\d\d:\d\d$/.test(start) || !/[+-]\d\d:\d\d$/.test(end) || !Number.isFinite(a) || !Number.isFinite(b) || b <= a || b - a > 12 * 3600000 || a < Date.now() - 60000 || a > Date.now() + 365 * 86400000) return NextResponse.json({ error: '일정 제목과 미래의 시작·종료 시간을 확인해 주세요.' }, { status: 400 });
  try {
    const existing = await listEvents(new Date(a - 86400000).toISOString(), new Date(b + 86400000).toISOString());
    const conflicts = overlaps(existing, start, end);
    if (conflicts.length) return NextResponse.json({ error: '기존 일정과 겹칩니다.', conflicts }, { status: 409 });
    const event = await googleFetch('events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: summary.trim(), start: { dateTime: start }, end: { dateTime: end } }) });
    return NextResponse.json({ id: event.id, htmlLink: event.htmlLink }, { status: 201 });
  } catch { return NextResponse.json({ error: '일정을 생성하지 못했습니다.' }, { status: 502 }); }
}
