-- ============================================
-- AI 할 일 관리 서비스 Supabase 스키마
-- ============================================

-- ============================================
-- 1. Extensions
-- ============================================
-- UUID 생성 함수를 사용하기 위한 extension (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. Users 테이블 (사용자 프로필)
-- ============================================
-- auth.users와 1:1로 연결되는 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users 테이블에 대한 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Users 테이블 업데이트 시 updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users 테이블 업데이트 트리거
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Todos 테이블 (할 일 관리)
-- ============================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT[],
  completed BOOLEAN DEFAULT FALSE
);

-- Todos 테이블에 외래 키 제약조건 추가 (기존 제약조건이 있으면 제거 후 재생성)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'todos_user_id_fkey' 
    AND conrelid = 'public.todos'::regclass
  ) THEN
    ALTER TABLE public.todos DROP CONSTRAINT todos_user_id_fkey;
  END IF;
END $$;

ALTER TABLE public.todos 
ADD CONSTRAINT todos_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Todos 테이블에 대한 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON public.todos(completed);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON public.todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON public.todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_created_date ON public.todos(created_date DESC);

-- ============================================
-- 4. Row Level Security (RLS) 활성화
-- ============================================
-- Users 테이블 RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Todos 테이블 RLS 활성화
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS 정책: Users 테이블
-- ============================================
-- 사용자는 자신의 프로필만 조회 가능
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- 사용자는 자신의 프로필만 수정 가능
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- 사용자는 자신의 프로필만 삽입 가능 (회원가입 시 자동 생성)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 6. RLS 정책: Todos 테이블
-- ============================================
-- 사용자는 자신의 할 일만 조회 가능
DROP POLICY IF EXISTS "Users can view own todos" ON public.todos;
CREATE POLICY "Users can view own todos"
  ON public.todos
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 할 일만 생성 가능
DROP POLICY IF EXISTS "Users can create own todos" ON public.todos;
CREATE POLICY "Users can create own todos"
  ON public.todos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 할 일만 수정 가능
DROP POLICY IF EXISTS "Users can update own todos" ON public.todos;
CREATE POLICY "Users can update own todos"
  ON public.todos
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 할 일만 삭제 가능
DROP POLICY IF EXISTS "Users can delete own todos" ON public.todos;
CREATE POLICY "Users can delete own todos"
  ON public.todos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. 사용자 프로필 자동 생성 함수
-- ============================================
-- auth.users에 새 사용자가 생성될 때 public.users에 프로필 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 INSERT 시 트리거 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 8. 주석 (테이블 및 컬럼 설명)
-- ============================================
COMMENT ON TABLE public.users IS '사용자 프로필 테이블 (auth.users와 1:1 관계)';
COMMENT ON COLUMN public.users.id IS 'auth.users의 id와 동일한 UUID';
COMMENT ON COLUMN public.users.email IS '사용자 이메일 주소';
COMMENT ON COLUMN public.users.name IS '사용자 이름';
COMMENT ON COLUMN public.users.created_at IS '프로필 생성일시';
COMMENT ON COLUMN public.users.updated_at IS '프로필 수정일시';

COMMENT ON TABLE public.todos IS '할 일 관리 테이블';
COMMENT ON COLUMN public.todos.id IS '할 일 고유 ID';
COMMENT ON COLUMN public.todos.user_id IS '할 일 소유자 ID (auth.users.id 참조)';
COMMENT ON COLUMN public.todos.title IS '할 일 제목 (필수)';
COMMENT ON COLUMN public.todos.description IS '할 일 상세 설명';
COMMENT ON COLUMN public.todos.created_date IS '할 일 생성일시';
COMMENT ON COLUMN public.todos.due_date IS '할 일 마감일시';
COMMENT ON COLUMN public.todos.priority IS '우선순위 (high, medium, low)';
COMMENT ON COLUMN public.todos.category IS '카테고리 배열 (업무, 개인, 학습 등)';
COMMENT ON COLUMN public.todos.completed IS '완료 여부';