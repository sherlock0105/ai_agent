import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Dohyun | AI Workspace', description: '나의 하루를 읽고, 계획하고, 실행하는 개인 캘린더 워크스페이스' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
