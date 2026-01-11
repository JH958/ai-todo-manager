import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트용 Supabase 클라이언트 생성 함수
 * Next.js App Router의 서버 컴포넌트에서 사용합니다.
 * 쿠키를 통한 인증 상태를 관리합니다.
 * @returns Supabase 클라이언트 인스턴스
 */
export const createClient = () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies();
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          try {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // 서버 액션에서 호출되는 경우 cookies()는 읽기 전용일 수 있습니다.
            // 이 경우 클라이언트에서 쿠키를 설정하도록 처리합니다.
          }
        },
      },
    }
  );
};
