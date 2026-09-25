import { NextResponse } from 'next/server';
import { getSession } from '@/lib/calendar';
export async function GET() {
  return NextResponse.json({ connected: !!(await getSession()), aiConfigured: !!process.env.OPENAI_API_KEY });
}
