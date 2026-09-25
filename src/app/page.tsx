'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Compass, ExternalLink, Github, LayoutDashboard, Link2, LoaderCircle, LogOut, MessageCircle, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar';

type Tab = 'overview' | 'calendar' | 'agent';
type Proposal = { summary: string; start: string; end: string };
type Chat = { role: 'user' | 'assistant'; text: string; proposals?: Proposal[] };
type Task = { id: string; title: string; done: boolean };
const tz = 'Asia/Seoul';
const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const parts = (date: Date) => new Intl.DateTimeFormat('ko-KR', { timeZone: tz, month: 'long', day: 'numeric', weekday: 'long' }).format(date);
const shortTime = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? '하루 종일' : new Intl.DateTimeFormat('ko-KR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
const dateLabel = (value: string) => `${parts(new Date(value))} · ${shortTime(value)}`;
const demo = (today: Date): CalendarEvent[] => {
  const d = dateKey(today);
  const next = dateKey(new Date(today.getTime() + 86400000));
  return [
    { id: 'demo1', summary: 'FI 개념 정리 · 전표와 반제', start: `${d}T10:00:00+09:00`, end: `${d}T11:30:00+09:00`, allDay: false },
    { id: 'demo2', summary: '프로젝트 정리 시간', start: `${d}T15:00:00+09:00`, end: `${d}T16:00:00+09:00`, allDay: false },
    { id: 'demo3', summary: 'ABAP 학습', start: `${next}T19:00:00+09:00`, end: `${next}T20:30:00+09:00`, allDay: false }
  ];
};
const prompts = ['오늘 일정 요약해줘', '이번 주 비는 시간 찾아줘', '내일 저녁에 FI 공부 1시간 넣어줘'];

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [now, setNow] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [notice, setNotice] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [chat, setChat] = useState<Chat[]>([{ role: 'assistant', text: '안녕하세요, 도현님. 캘린더를 연결하면 오늘 일정 요약, 빈 시간 찾기, 일정 제안까지 도와드릴게요.' }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60000);
    try { setTasks(JSON.parse(localStorage.getItem('dohyun_tasks') || '[]')); } catch { /* ignore invalid local data */ }
    fetch('/api/session').then(r => r.json()).then(s => { setConnected(s.connected); setAiConfigured(s.aiConfigured); }).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.has('error')) setNotice('Google 연결에 실패했어요. OAuth 설정을 확인해 주세요.');
    if (params.has('setup')) setSetup(true);
    return () => clearInterval(tick);
  }, []);
  const weekStart = useMemo(() => { if (!now) return null; const key = dateKey(now); const base = new Date(`${key}T00:00:00+09:00`); const day = (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7; return new Date(base.getTime() + (weekOffset * 7 - day) * 86400000); }, [now, weekOffset]);
  const days = useMemo(() => weekStart ? Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)) : [], [weekStart]);
  const fetchEvents = useCallback(async () => {
    if (!connected || !weekStart) return;
    setLoadingEvents(true);
    try {
      const from = weekStart.toISOString(); const to = new Date(weekStart.getTime() + 7 * 86400000).toISOString();
      const res = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setEvents(data.events);
    } catch (e) { setNotice(e instanceof Error ? e.message : '일정을 불러오지 못했습니다.'); }
    finally { setLoadingEvents(false); }
  }, [connected, weekStart]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  const shown = connected ? events : (now ? demo(now) : []);
  const today = now ? dateKey(now) : '';
  const todays = shown.filter(e => dateKey(new Date(e.start)) === today);
  const done = tasks.filter(t => t.done).length;
  function updateTasks(next: Task[]) { setTasks(next); localStorage.setItem('dohyun_tasks', JSON.stringify(next)); }
  function addTask() { const title = newTask.trim(); if (!title) return; updateTasks([...tasks, { id: crypto.randomUUID(), title, done: false }]); setNewTask(''); }
  async function send(message = input) {
    if (!message.trim() || thinking) return;
    setTab('agent'); setInput(''); setChat(c => [...c, { role: 'user', text: message.trim() }]);
    if (!connected || !aiConfigured) { setChat(c => [...c, { role: 'assistant', text: !connected ? 'Google Calendar를 연결하면 실제 일정을 읽을 수 있어요. 오른쪽 위의 연결 버튼을 눌러 주세요.' : 'AI API 키 설정이 필요해요. 설정 안내를 확인해 주세요.' }]); return; }
    setThinking(true);
    try {
      const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setChat(c => [...c, { role: 'assistant', text: data.answer, proposals: data.proposals }]);
    } catch (e) { setChat(c => [...c, { role: 'assistant', text: e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.' }]); }
    finally { setThinking(false); }
  }
  async function createEvent(p: Proposal) {
    if (creating) return; setCreating(true);
    try {
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setChat(c => c.map(item => ({ ...item, proposals: item.proposals?.filter(q => q !== p) })));
      setNotice(`“${p.summary}” 일정을 추가했어요.`); await fetchEvents();
    } catch (e) { setNotice(e instanceof Error ? e.message : '일정 생성에 실패했습니다.'); }
    finally { setCreating(false); }
  }
  async function disconnect() { await fetch('/api/auth/logout', { method: 'POST' }); setConnected(false); setEvents([]); setNotice('Google Calendar 연결을 해제했어요.'); }
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Compass size={23} strokeWidth={1.5}/></div><div><strong>DOHYUN<span className="brand-dot">.</span></strong><small>AI WORKSPACE</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="메인 메뉴">
        <button className={tab === 'overview' ? 'nav active' : 'nav'} onClick={() => setTab('overview')}><LayoutDashboard size={18}/> 대시보드</button>
        <button className={tab === 'calendar' ? 'nav active' : 'nav'} onClick={() => setTab('calendar')}><CalendarDays size={18}/> 캘린더</button>
        <button className={tab === 'agent' ? 'nav active' : 'nav'} onClick={() => setTab('agent')}><Sparkles size={18}/> AI 에이전트 <span className="nav-pip"/></button>
      </nav>
      <div className="side-label side-label-second">QUICK ACCESS</div>
      <a className="nav link" href="https://calendar.google.com" target="_blank" rel="noreferrer"><CalendarDays size={18}/> Google Calendar <ArrowUpRight size={14}/></a>
      <a className="nav link" href="https://github.com/sherlock0105/ai_agent" target="_blank" rel="noreferrer"><Github size={18}/> GitHub 저장소 <ArrowUpRight size={14}/></a>
      <a className="nav link" href="https://chatgpt.com" target="_blank" rel="noreferrer"><MessageCircle size={18}/> ChatGPT <ArrowUpRight size={14}/></a>
      <div className="side-bottom"><div className="quote-mark">“</div><p>Observe. Connect.<br/>Make the next move.</p><span>YOUR PERSONAL FIELD NOTES</span></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> {tab === 'overview' ? 'DASHBOARD' : tab === 'calendar' ? 'CALENDAR' : 'AI AGENT'}</div><div className="top-actions"><span className="live-clock"><Clock3 size={15}/> {now ? new Intl.DateTimeFormat('ko-KR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now) : '--:--'}</span><button className="icon-btn" aria-label="설정 안내" onClick={() => setSetup(true)}><Settings2 size={18}/></button>{connected ? <button className="connected-btn" onClick={disconnect}><span className="status-dot"/> 캘린더 연결됨 <LogOut size={14}/></button> : <a className="connect-btn" href="/api/auth/google"><Link2 size={15}/> 캘린더 연결 <ArrowUpRight size={14}/></a>}</div></header>
      <div className="content">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="알림 닫기">×</button></div>}
        {tab === 'overview' && <>
          <div className="eyebrow"><span className="eyebrow-line"/> YOUR DAILY COMMAND CENTER</div>
          <section className="hero"><div className="hero-copy"><div className="hero-date">{now ? parts(now) : '오늘'} <span>· SEOUL</span></div><h1>오늘의 흐름을,<br/><em>한눈에.</em></h1><p>일정은 정리하고, 중요한 일에 집중하세요.<br/>나만의 워크스페이스가 하루를 함께 읽습니다.</p><button className="hero-cta" onClick={() => send('오늘 일정 요약해줘')}>오늘 브리핑 받기 <ArrowRight size={17}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-symbol">✳</div><div className="orbit-label top">PLAN / 01</div><div className="orbit-label bottom">FOCUS / 02</div></div></section>
          {!connected && <div className="demo-banner"><div><span className="demo-pill">미리보기</span><strong>지금은 샘플 일정을 보고 있어요</strong><p>실제 일정과 AI 브리핑을 사용하려면 Google Calendar를 연결하세요.</p></div><a href="/api/auth/google">연결하기 <ArrowRight size={15}/></a></div>}
          <div className="section-heading"><div><span className="section-kicker">AT A GLANCE</span><h2>오늘의 개요</h2></div><span className="section-date">{now ? parts(now) : ''}</span></div>
          <div className="stat-grid"><div className="stat-card"><div className="stat-icon gold"><CalendarDays size={20}/></div><span>오늘 일정</span><strong>{todays.length}<small>건</small></strong><p>{connected ? 'Google Calendar 기준' : '샘플 일정 기준'}</p></div><div className="stat-card"><div className="stat-icon blue"><Check size={20}/></div><span>완료한 할 일</span><strong>{done}<small> / {tasks.length}</small></strong><p>오늘의 작은 진전</p></div><div className="stat-card"><div className="stat-icon peach"><Sparkles size={20}/></div><span>에이전트</span><strong className="stat-word">{connected && aiConfigured ? '준비 완료' : '설정 대기'}</strong><p>{connected && aiConfigured ? '질문을 보내 보세요' : '연결하면 활성화돼요'}</p></div></div>
          <div className="dashboard-grid"><section className="panel schedule-panel"><div className="panel-head"><div><span className="section-kicker">YOUR AGENDA</span><h3>오늘의 일정</h3></div><button className="text-link" onClick={() => setTab('calendar')}>전체 보기 <ArrowUpRight size={15}/></button></div><div className="timeline">{todays.length ? todays.map((e, i) => <div className="timeline-row" key={e.id}><span className="timeline-time">{shortTime(e.start)}</span><span className={`timeline-dot dot-${i % 3}`}/><div className="timeline-event"><strong>{e.summary}</strong><small>{e.allDay ? '하루 종일' : `${shortTime(e.start)} – ${shortTime(e.end)}`}</small></div>{e.htmlLink && <a href={e.htmlLink} target="_blank" rel="noreferrer" aria-label={`${e.summary} 열기`}><ArrowUpRight size={16}/></a>}</div>) : <div className="empty">오늘 등록된 일정이 없어요. 여유 있는 하루를 계획해 보세요.</div>}</div><div className="panel-footer"><span className="tiny-dot"/> {connected ? 'Google Calendar와 동기화됨' : '샘플 데이터 · 실제 일정 아님'}</div></section>
          <section className="panel task-panel"><div className="panel-head"><div><span className="section-kicker">STAY ON TRACK</span><h3>나의 할 일</h3></div><span className="count-badge">{done}/{tasks.length}</span></div><div className="task-list">{tasks.length ? tasks.map(t => <div className="task-row" key={t.id}><button className={t.done ? 'check done' : 'check'} onClick={() => updateTasks(tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} aria-label={`${t.title} ${t.done ? '완료 취소' : '완료'}`}>{t.done && <Check size={13}/>}</button><span className={t.done ? 'strike' : ''}>{t.title}</span><button className="remove" aria-label={`${t.title} 삭제`} onClick={() => updateTasks(tasks.filter(x => x.id !== t.id))}><Trash2 size={15}/></button></div>) : <div className="empty">할 일을 추가해 하루를 시작해 보세요.</div>}</div><form className="task-add" onSubmit={e => { e.preventDefault(); addTask(); }}><Plus size={17}/><input aria-label="새 할 일" value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="새 할 일 추가..." maxLength={120}/><button aria-label="할 일 추가"><ArrowRight size={17}/></button></form><div className="task-note">할 일은 이 브라우저에만 저장됩니다.</div></section></div>
          <div className="agent-strip" onClick={() => setTab('agent')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setTab('agent')}><div className="agent-strip-icon"><Sparkles size={21}/></div><div><span>ASK YOUR AGENT</span><strong>“이번 주 비어 있는 시간 찾아줘”</strong></div><div className="agent-strip-arrow"><ArrowUpRight size={22}/></div></div>
        </>}
        {tab === 'calendar' && <><div className="eyebrow"><span className="eyebrow-line"/> YOUR WEEK, IN FOCUS</div><div className="page-title"><div><h1>캘린더<span className="title-period">.</span></h1><p>일주일의 흐름을 살펴보고 다음 움직임을 계획하세요.</p></div><a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="outline-btn">Google Calendar 열기 <ExternalLink size={15}/></a></div>{!connected && <div className="demo-banner"><div><span className="demo-pill">미리보기</span><strong>샘플 일정입니다</strong><p>실제 주간 일정을 보려면 캘린더를 연결하세요.</p></div><a href="/api/auth/google">연결하기 <ArrowRight size={15}/></a></div>}<section className="panel calendar-panel"><div className="calendar-toolbar"><div><span className="section-kicker">WEEKLY VIEW</span><h3>{days.length ? `${new Intl.DateTimeFormat('ko-KR', { timeZone: tz, month: 'long', day: 'numeric' }).format(days[0])} — ${new Intl.DateTimeFormat('ko-KR', { timeZone: tz, month: 'long', day: 'numeric' }).format(days[6])}` : '이번 주'}</h3></div><div className="week-controls"><button onClick={() => setWeekOffset(0)}>오늘</button><button aria-label="이전 주" onClick={() => setWeekOffset(n => n - 1)}><ChevronLeft size={18}/></button><button aria-label="다음 주" onClick={() => setWeekOffset(n => n + 1)}><ChevronRight size={18}/></button></div></div><div className="week-grid">{days.map((d, i) => { const key = dateKey(d); const dayEvents = shown.filter(e => dateKey(new Date(e.start)) === key); return <div className={key === today ? 'week-day current' : 'week-day'} key={key}><div className="week-day-head"><span>{['월', '화', '수', '목', '금', '토', '일'][i]}</span><strong>{new Intl.DateTimeFormat('en', { timeZone: tz, day: 'numeric' }).format(d)}</strong></div><div className="week-events">{loadingEvents && connected ? <span className="week-empty">불러오는 중</span> : dayEvents.length ? dayEvents.map(e => <div className="week-event" key={e.id}><small>{shortTime(e.start)}</small><strong>{e.summary}</strong></div>) : <span className="week-empty">일정 없음</span>}</div></div>; })}</div></section><div className="calendar-bottom"><ShieldCheck size={17}/> 일정 생성은 AI 제안을 확인한 뒤 직접 승인해야 합니다.</div></>}
        {tab === 'agent' && <><div className="eyebrow"><span className="eyebrow-line"/> THINK, PLAN, ACT</div><div className="page-title"><div><h1>AI 에이전트<span className="title-period">.</span></h1><p>일정을 읽고, 빈 시간을 찾고, 다음 계획을 제안합니다.</p></div><span className={connected && aiConfigured ? 'agent-status ready' : 'agent-status'}><span className="status-dot"/> {connected && aiConfigured ? '사용 가능' : '연결 대기'}</span></div><div className="agent-layout"><section className="panel chat-panel"><div className="chat-head"><div className="chat-avatar"><Sparkles size={19}/></div><div><strong>Dohyun Agent</strong><span>CALENDAR ASSISTANT</span></div><span className="chat-head-end">01 / CALENDAR</span></div><div className="messages">{chat.map((m, i) => <div className={`message ${m.role}`} key={i}>{m.role === 'assistant' && <div className="message-avatar">✳</div>}<div className="message-body"><div className="bubble">{m.text}</div>{m.proposals?.map((p, j) => <div className="proposal" key={j}><div className="proposal-top"><CalendarDays size={17}/> 일정 제안</div><strong>{p.summary}</strong><span>{dateLabel(p.start)} → {shortTime(p.end)}</span><button disabled={creating} onClick={() => createEvent(p)}>{creating ? '추가 중...' : '확인하고 일정 추가'} <ArrowRight size={15}/></button></div>)}</div></div>)}{thinking && <div className="message assistant"><div className="message-avatar">✳</div><div className="bubble"><LoaderCircle className="spin" size={16}/> 캘린더를 확인하고 있어요...</div></div>}</div><div className="chat-compose"><div className="suggestions">{prompts.map(p => <button key={p} onClick={() => send(p)}>{p} <ArrowUpRight size={13}/></button>)}</div><form onSubmit={e => { e.preventDefault(); send(); }} className="compose-box"><input value={input} onChange={e => setInput(e.target.value)} placeholder="일정에 관해 무엇이든 물어보세요..." maxLength={1000} aria-label="에이전트에게 메시지 보내기"/><button disabled={thinking || !input.trim()} aria-label="메시지 전송"><Send size={18}/></button></form><small>일정 추가는 확인 버튼을 누른 뒤에만 실행됩니다.</small></div></section><aside className="agent-info"><div className="info-card dark"><div className="info-icon"><Search size={23}/></div><span>WHAT I CAN DO</span><h3>캘린더를 읽고<br/>계획을 함께 세워요.</h3><div className="info-line"><Check size={16}/> 오늘·이번 주 일정 요약</div><div className="info-line"><Check size={16}/> 비어 있는 시간 탐색</div><div className="info-line"><Check size={16}/> 새 일정 제안 및 추가</div></div><div className="info-card light"><CircleHelp size={21}/><h3>시작하려면</h3><p>Google Calendar를 연결하고 서버에 OpenAI API 키를 설정하세요. 연결 전에는 화면과 할 일 기능을 체험할 수 있습니다.</p><button onClick={() => setSetup(true)}>설정 안내 보기 <ArrowRight size={15}/></button></div></aside></div></>}
        <footer className="footer"><span>© {now?.getFullYear() || 2026} DOHYUN WORKSPACE</span><span>BUILT TO MAKE EVERY DAY COUNT <span className="footer-star">✳</span></span></footer>
      </div>
    </main>
    {setup && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSetup(false); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="setup-title"><button className="modal-close" onClick={() => setSetup(false)} aria-label="닫기">×</button><span className="section-kicker">GETTING STARTED</span><h2 id="setup-title">연결 설정</h2><p>프로젝트 실행 및 Google OAuth 설정은 저장소의 README에 자세히 정리했어요.</p><ol><li>Google Cloud에서 Calendar API와 OAuth 동의 화면을 설정합니다.</li><li>웹 클라이언트를 만들고 <code>/api/auth/callback</code>을 리디렉션 URI로 등록합니다.</li><li>서버 환경 변수에 Google Client ID·Secret, APP_SECRET, OPENAI_API_KEY를 등록합니다.</li><li>사이트에서 <b>캘린더 연결</b>을 눌러 승인합니다.</li></ol><a href="https://github.com/sherlock0105/ai_agent#설정-방법" target="_blank" rel="noreferrer" className="modal-link">README에서 자세히 보기 <ArrowUpRight size={16}/></a></div></div>}
  </div>;
}
