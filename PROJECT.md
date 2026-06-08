# 자격증공장 재택근무반 — PROJECT.md

전국 성인 수험생을 위한 **온라인 공동 학습(재택근무) 서비스**.
회사: **수험생연구소** · 1호점: **망미점(부산)**, 이후 전국 확장.
수험생연구소(컨트롤 타워)가 상담 후 등록 → 학생은 재택에서 캠을 켜고 **교시별로 함께 공부**.

---

## Repos & Stack

| Repo                         | Stack                                                                   | 상태         |
| ---------------------------- | ----------------------------------------------------------------------- | ------------ |
| **jagong-api** (backend)     | NestJS v11 · TypeScript · PostgreSQL · Prisma · JWT(Bearer) · Socket.IO | ✅ 핵심 완료 |
| **jagong-client** (frontend) | Vite · React · TS · React Router · axios · socket.io-client             | 🚧 진행 중   |

작업 브랜치: **develop**(작업/푸시), **master**(릴리스). 솔로 개발.

---

## Backend — jagong-api ✅ (camera 제외 전부 완료)

**Auth:** 이름 + branchId + 4자리 PIN(bcrypt) → JWT. payload `{ userId, name, role, branchId }`. 로그아웃 = 클라이언트 토큰 삭제.
**Roles:** ADMIN / STAFF / MEMBER.
**규칙:** GET/POST만(삭제=`POST /x/delete/:id` soft-delete, 수정=`POST /x/update/:id`) · 라우트 `/api` prefix 없음 · 에러 한국어 · class-validator DTO.

**모듈 (전부 작동 확인):**

- **Users/Auth** — 2단계 등록(관리자 사전등록 → 학생 PIN 설정). preRegister: name, branchId, age, phone, examType, notes.
- **Attendance** — `POST /attendance/mark`(관리자) · `GET /attendance/me` · `GET /attendance`. PRESENT/ABSENT.
- **Branch** — `GET /branches`(공개) · 관리자 CRUD.
- **Leave** — 월차/오전반차/오후반차. **주간 규칙: 월~일 3칸, 월차=2칸·반차=1칸.** 신청/조회/승인/반려.
- **Timetable** — 전 지점 공용 1개. `GET /timetable`(공개) + 관리자 CRUD. slot/label/start/end/duration/isBreak/messages.
- **Consultation** — 공개 예약(PHONE/VIDEO/QUESTION/IMMEDIATE). _(새 시안 위해 확장 예정 — 아래 마이그레이션)_
- **Chat** — 학생↔관리자 1:1 Q&A. NEW→ANSWERED/NEEDS_CHECK.
- **CamSession** — `cam/join`(출석 자동 PRESENT)·`leave`·`alert`. _(실시간 영상은 camera 단계)_
- **Realtime (Socket.IO)** — 핸드셰이크 토큰 인증, onlineCount 브로드캐스트, 룸(`user:<id>`,`admins`), `chat:*`/`cam:*` 푸시, **bell** 크론(매분, 시간표 비교 → countdown/periodStart/breakStart). _서버 TZ=Asia/Seoul 필요._

---

## Frontend — jagong-client 🚧

**구조 (확정):**

```
src/
  App.tsx  main.tsx
  app/ -> components/  context/  hooks/  screens/  services/  theme/
  lib/  -> config.ts  types.ts        (화면에서 ../../../lib)
  styles/ -> global.css               (서비스에서 ../../lib)
```

**스타일 규칙 (확정):**

- 화면당 CSS 파일 1개, 같은 폴더(`screens/X/x.css`), `import './x.css'`.
- **루트 클래스 1개로 스코프** (`.login .login-card` …) — 충돌 방지.
- 색/폰트는 `styles/global.css`의 **CSS 변수(`var(--accent)`)** 에서만.
- 레이아웃은 순수 HTML + class. **MUI 컴포넌트/sx 미사용.** 아이콘만 `@mui/icons-material`(svg)을 CSS로 스타일.
- 반응형: 각 CSS의 `@media`. (폰/태블릿/노트북)

**상태:** AuthContext(자동로그인=localStorage / 비자동=sessionStorage) + SocketContext(앱 전체 소켓 1개) + hooks. Redux 없음.

**완료/진행:**

- ✅ 화면 1 로그인 (자동로그인·홈화면 추가·사원등록/상담예약 링크·가상 미리보기·MUI 아이콘·입장 애니메이션)
- ✅ 대기창/학습라인 기본본 — 새 시안에 맞춰 재작업 예정
- ⬜ 화면 3 작업 대기장 / 4 개인작업실 / 2 가입상담예약 / 주간계획 / 게시판 …

---

## 대표님 시안 — 화면 정리

1. **로그인** — 이름+4자리 PIN, 자동로그인, 홈화면 추가, 사원등록>, 가입상담예약 CTA, 작업장 **미리보기(가상)** + 가입자수.
2. **가입상담예약** — 절차(상담예약→상담→결제→시작) · 이름/연령(21–40)/연락처/시험종류/공부기간/장소/전업여부+사유/희망날짜/희망시간대(예약완료=회색·클릭불가) · 전화·화상·질문·바로시작.
3. **작업 대기장** — 종 설정(소리·진동·무음), N명 근무중 / M명 대기중, 미리보기 캠(가상), 시간표(출근~7교시), 진행률, 다음 종까지, 공지(전체 실시간), 개인/단체 입장, 하단: 주간작업계획·휴가·게시판·연장하기.
4. **개인작업실** — 오늘 나의 학습라인(교시별 완료/진행중/대기 + 교시별 종 설정), 알림(개인), 진행률·다음종(접기).
5. **단체작업장** — 캠 그리드(창분할 8→16→25), 공지, 진행률·현재/다음 교시(접기). _(camera 단계)_
6. **주간작업계획 / 주간학습장** — 월 캘린더·월 목표·주 선택, 교시×요일 투두(체크), 지난 계획 보기.

---

## 결정 사항 (대표님 확인 완료)

1. **연장하기** = 이용기간(멤버십) 연장, 상시 노출(결제 유도). → 멤버십 만료일 + 결제.
2. **게시판** = ① 관리자 공지 게시판 + ② 1:1 Q&A(기존 chat 재사용). 둘 다.
3. **공지 vs 알림** = 공지(전체) / 알림(개인). 별개 기능.
4. **교시별 종 설정** = 계정 저장(기기 간 동기화).
5. **상담 시간대** = 차면 회색 + 클릭 불가.
6. **미리보기 캠** = 가상 화면(샘플).
7. **"현재 N명"** = 가입자 수.

(이전 확정) 전 지점 공용 시간표 / 캠은 보되 **대화는 관리자와만** / 이름 뒤 구분 / 주 월~일 / 휴가 3칸.

---

## 로드맵

**1) 프론트엔드 (지금~내일):** 화면 1✅ → 3 → 4 → 나머지, 전부 class-CSS.

**2) 백엔드 + 마이그레이션 (그 다음, 전부 additive — 데이터 안전):**

- Consultation 확장(연령/시험/기간/장소/전업/사유/희망일·시간대) + 시간대 예약현황
- **주간작업계획** 신규 테이블(월 목표 + 일·교시별 투두)
- **멤버십/연장 + 결제** (만료일 + 결제 연동)
- **공지(전체) + 알림(개인)** (소켓 + 저장)
- **교시별 종 설정** 계정 저장(prefs)
- **게시판(공지)** 신규 테이블
- **가입자수** 공개 카운트 (마이그레이션 불필요)
- 1:1 Q&A 게시판 = 기존 chat (신규 없음)
- 근무중/대기중 2상태 = 게이트웨이 로직 (마이그레이션 불필요)

**3) 카메라 단계 (마지막):** 개인 캠, 단체 캠 그리드(창분할), 1:1 화상, MediaPipe 자리비움 → `/cam/alert`. (LiveKit 방향)

---

## 배포 (예정)

VPS + nginx (SPA fallback `try_files $uri /index.html`) · 백엔드 reverse-proxy · **TZ=Asia/Seoul**(bell). 비밀키는 .env(gitignore), .env.example만 커밋.
