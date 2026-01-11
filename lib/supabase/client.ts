import { createBrowserClient } from "@supabase/ssr";

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트 생성 함수
 * Next.js App Router의 클라이언트 컴포넌트에서 사용합니다.
 * 브라우저의 쿠키를 통한 인증 상태를 관리합니다.
 * @returns Supabase 클라이언트 인스턴스
 */
export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
};
