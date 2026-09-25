# Dohyun AI Workspace

개인 일정과 할 일을 한곳에서 보고, AI가 Google Calendar를 읽어 브리핑과 새 일정 제안을 만드는 웹앱입니다.

## 첫 버전에서 할 수 있는 것

- 대시보드: 오늘 일정, 로컬 할 일, 현재 상태 확인
- 캘린더: Google Calendar 기본 캘린더의 주간 일정 조회
- AI 에이전트: 일정 요약, 빈 시간 탐색, 새 일정 제안
- 일정 생성: AI 제안을 사용자가 **확인하고 일정 추가** 버튼으로 승인할 때만 Google Calendar에 작성. 서버가 충돌 여부를 다시 확인
- 연결 전: 실제 개인 데이터 대신 명시적으로 표시된 샘플 일정으로 화면 체험

할 일은 현재 브라우저 `localStorage`에 저장되므로 다른 기기와 동기화되지 않습니다. 일정 데이터와 OAuth 토큰은 서버의 암호화된 HttpOnly 쿠키를 통해 처리하며 별도 데이터베이스에 저장하지 않습니다. AI 요청에는 질문과 답변에 필요한 캘린더 일정이 전달될 수 있습니다.

## 로컬 실행

Node.js 20.9 이상에서:

```bash
npm install
cp .env.example .env.local
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 접속합니다. 환경 변수를 비워도 샘플 화면과 할 일 기능을 사용할 수 있습니다.

## 설정 방법

### 1. Google Cloud

1. Google Cloud 프로젝트를 만들고 **Google Calendar API**를 사용 설정합니다.
2. Google Auth Platform에서 OAuth 동의 화면을 설정합니다. 개인 테스트라면 테스트 사용자에 본인의 Google 계정을 추가합니다.
3. **OAuth Client ID → Web application**을 만듭니다.
4. 승인된 리디렉션 URI에 `http://localhost:3000/api/auth/callback`을 등록합니다. 배포할 때는 `https://배포도메인/api/auth/callback`도 추가합니다.
5. 아래 환경 변수에 Client ID와 Client Secret을 복사합니다. `ALLOWED_GOOGLE_EMAIL`에는 **로그인할 본인 이메일 주소**를 입력합니다. 이 주소 이외의 계정은 로그인할 수 없습니다.

Google 권한 범위는 `calendar.events`(일정 조회·생성)와 `userinfo.email`(접근 허용 계정 확인)입니다. OAuth 테스트 모드 및 Google의 동의 화면 정책에 따라 테스트 사용자 등록이나 앱 검토가 필요할 수 있습니다.

### 2. AI API 및 서버 환경 변수

`.env.local`(로컬) 또는 배포 플랫폼의 서버 환경 변수에 설정합니다. 값은 GitHub에 커밋하거나 브라우저 코드에 넣지 마세요.

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_SECRET=길고_예측하기_어려운_최소_32자_문자열
ALLOWED_GOOGLE_EMAIL=본인@gmail.com
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

`APP_SECRET`은 예를 들어 `openssl rand -hex 32`로 생성할 수 있습니다. `OPENAI_MODEL`은 계정에서 사용 가능한 모델로 변경할 수 있습니다. AI 키가 없으면 캘린더 조회와 할 일은 동작하지만 AI 대화는 사용할 수 없습니다.

### 3. 배포

이 프로젝트에는 서버 API와 OAuth가 있으므로 GitHub Pages의 정적 호스팅만으로는 실행되지 않습니다. GitHub 저장소를 Vercel 같은 Next.js 서버 지원 플랫폼에 연결하고 위 환경 변수를 **서버 설정**에 등록하세요. 배포 주소의 OAuth 리디렉션 URI를 Google Cloud에 추가한 뒤 재배포합니다. Google은 등록된 URI와 실제 요청 URI가 정확히 일치해야 합니다.

## 사용 흐름

1. **캘린더 연결** → 본인 Google 계정으로 OAuth 승인
2. 대시보드 또는 캘린더에서 일정 조회
3. 에이전트에 “내일 일정 알려줘”, “토요일에 FI 공부 2시간 넣어줘” 등 요청
4. 일정 제안 카드의 날짜와 시간을 확인한 뒤 **확인하고 일정 추가** 클릭

현재 AI는 한 번의 질문에 대해 캘린더 도구를 최대 다섯 차례 사용할 수 있습니다. 일정 수정·삭제, Gmail 연동, 할 일 동기화는 구현되지 않았습니다.

## 개발 명령어

```bash
npm run typecheck
npm run lint
npm run build
```

Next.js App Router + TypeScript + OpenAI Chat Completions tool calling으로 구현했습니다. `src/app/api/agent`의 도구는 일정 조회, 빈 시간 찾기, 일정 제안입니다. Google Calendar 쓰기는 `src/app/api/events`에서 사용자 승인 후 별도 요청으로 처리합니다.
