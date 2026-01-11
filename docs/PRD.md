# AI 기반 할 일 관리 서비스 PRD (Product Requirements Document)

## 1. 개요
본 문서는 AI 기반 할 일(To-do) 관리 웹 애플리케이션의 제품 요구사항 정의서(PRD)입니다.  
실제 개발에 즉시 활용 가능하도록 기능, 화면 구성, 기술 스택, 데이터 구조를 구체적으로 정의합니다.

- **타깃 사용자**: 업무/개인/학습 할 일을 체계적으로 관리하고 싶은 사용자
- **핵심 가치**: 
  - 빠른 입력 (AI 자연어 처리)
  - 명확한 정리 (검색/필터/정렬)
  - 한눈에 보는 요약 (AI 분석)
- **문화적 맥락**: 한국 사용자에게 익숙한 생산성 앱 흐름(Notion, Todoist, Kakao 캘린더)과 AI 트렌드 반영

---

## 2. 주요 기능 (Functional Requirements)

### 2.1 사용자 인증 (Authentication)
- **방식**: 이메일 / 비밀번호
- **기술**: Supabase Auth
- **기능**
  - 회원가입
  - 로그인 / 로그아웃
  - 로그인 상태 유지(Session)
  - 비로그인 사용자 접근 제한

---

### 2.2 할 일 관리 (CRUD)

#### 2.2.1 할 일 생성(Create)
- 사용자는 직접 입력 또는 AI를 통해 할 일을 생성할 수 있음
- 필수 입력값: 제목(title)
- 선택 입력값: 설명, 마감일, 우선순위, 카테고리

#### 2.2.2 할 일 조회(Read)
- 사용자 본인의 할 일만 조회 가능
- 기본 정렬: 생성일 최신순

#### 2.2.3 할 일 수정(Update)
- 모든 필드 수정 가능
- 완료 여부 토글 가능

#### 2.2.4 할 일 삭제(Delete)
- 소프트 삭제 고려 가능 (추후 확장)

#### 2.2.5 할 일 필드 정의
| 필드명 | 타입 | 설명 |
|------|------|------|
| id | uuid | 할 일 고유 ID |
| user_id | uuid | 사용자 ID |
| title | text | 할 일 제목 |
| description | text | 상세 설명 |
| created_date | timestamp | 생성일 |
| due_date | timestamp | 마감일 |
| priority | enum | high / medium / low |
| category | text[] | 업무, 개인, 학습 등 |
| completed | boolean | 완료 여부 |

---

### 2.3 검색 / 필터 / 정렬

#### 2.3.1 검색
- 대상 필드: title, description
- 방식: 부분 문자열 검색 (ILIKE)

#### 2.3.2 필터
- 우선순위: 높음 / 중간 / 낮음
- 카테고리: 업무 / 개인 / 학습 (멀티 선택)
- 진행 상태:
  - 진행 중 (completed = false, due_date >= today)
  - 완료 (completed = true)
  - 지연 (completed = false, due_date < today)

#### 2.3.3 정렬
- 우선순위순
- 마감일순
- 생성일순

---

### 2.4 AI 할 일 생성 기능

#### 2.4.1 기능 설명
- 사용자가 자연어 문장으로 입력
- AI(Google Gemini API)가 문장을 분석해 구조화된 할 일 데이터로 변환

#### 2.4.2 입력 예시
> "내일 오전 10시에 팀 회의 준비"

#### 2.4.3 출력 예시
```json
{
  "title": "팀 회의 준비",
  "description": "내일 오전 10시에 있을 팀 회의를 위해 자료 작성하기",
  "created_date": "YYYY-MM-DD HH:MM",
  "due_date": "YYYY-MM-DD 10:00",
  "priority": "high",
  "category": ["업무"],
  "completed": false
}
```

#### 2.4.4 처리 흐름
1. 사용자 자연어 입력
2. 프론트엔드 → API Route 호출
3. Gemini API로 프롬프트 전달
4. JSON 파싱 및 검증
5. todos 테이블에 저장

---

### 2.5 AI 요약 및 분석 기능

#### 2.5.1 일일 요약
- 오늘 완료한 할 일 목록
- 오늘 남은 할 일 목록

#### 2.5.2 주간 요약
- 이번 주 전체 할 일 수
- 완료율 (%)
- 카테고리별 분포

#### 2.5.3 UI
- 버튼 클릭 한 번으로 결과 표시
- 카드 형태 요약 (한국 사용자에게 익숙한 대시보드 스타일)

---

## 3. 화면 구성 (UI / UX)

### 3.1 로그인 / 회원가입 화면
- 이메일, 비밀번호 입력
- 간결한 UI (Shadcn/ui Form)
- 에러 메시지 명확히 표시

### 3.2 할 일 관리 메인 화면
- 상단: 검색창, 필터, 정렬 옵션
- 중앙: 할 일 리스트 (카드 또는 테이블)
- 우측/하단:
  - 할 일 추가 버튼
  - AI 할 일 생성 입력창
- 상단 또는 사이드:
  - AI 요약 및 분석 버튼

### 3.3 통계 및 분석 화면 (확장)
- 주간 활동량 그래프
- 완료율 차트
- 카테고리별 분포 (도넛 차트)

---

## 4. 기술 스택 (Tech Stack)

### 4.1 Frontend
- Next.js (App Router)
- Tailwind CSS
- Shadcn/ui

### 4.2 Backend / BaaS
- Supabase
  - Auth
  - PostgreSQL
  - Row Level Security (RLS)

### 4.3 AI
- Google Gemini API
- AI SDK

---

## 5. 데이터 구조 (Supabase)

### 5.1 users
- Supabase Auth 기본 테이블 사용

### 5.2 todos 테이블
```sql
create table todos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  title text not null,
  description text,
  created_date timestamp default now(),
  due_date timestamp,
  priority text,
  category text[],
  completed boolean default false
);
```

### 5.3 보안 정책 (RLS)
- 사용자 본인 데이터만 접근 가능
```sql
create policy "User can manage own todos"
on todos
for all
using (auth.uid() = user_id);
```

---

## 6. 비기능 요구사항 (Non-Functional)
- 반응형 UI (모바일 우선, 한국 사용자 모바일 사용률 고려)
- 초기 로딩 3초 이내
- AI 응답 실패 시 fallback 메시지 제공

---

## 7. 향후 확장 아이디어
- 카카오 캘린더 연동
- 푸시 알림 (마감 임박)
- 팀 단위 공유 할 일
- 한국어 음성 입력 기반 AI 할 일 생성

---

**End of PRD**