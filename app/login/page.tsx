"use client";

import { useState, useEffect, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, AlertCircle } from "lucide-react";

/**
 * 로그인 페이지 컴포넌트
 * 이메일/비밀번호를 통한 사용자 인증을 제공합니다.
 * @returns 로그인 페이지 UI
 */
const LoginPage = (): ReactElement => {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 로그인된 사용자 체크 및 리다이렉트
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 이미 로그인된 사용자는 메인 페이지로 리다이렉트
        if (session) {
          router.push("/");
          return;
        }
      } catch (err) {
        console.error("인증 상태 확인 오류:", err);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.push("/");
      } else {
        setIsCheckingAuth(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  /**
   * 이메일 형식 검증 함수
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Supabase 오류 메시지를 사용자 친화적인 메시지로 변환
   */
  const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message: string }).message;

      // Supabase 오류 메시지 매핑
      if (message.includes("Invalid login credentials")) {
        return "이메일 또는 비밀번호가 올바르지 않습니다.";
      }
      if (message.includes("Email not confirmed")) {
        return "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.";
      }
      if (message.includes("rate limit")) {
        return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
      }
      if (message.includes("Password")) {
        return "비밀번호 형식이 올바르지 않습니다.";
      }
      if (message.includes("Email")) {
        return "이메일 형식이 올바르지 않습니다.";
      }

      return message;
    }

    return "로그인 중 오류가 발생했습니다. 다시 시도해주세요.";
  };

  /**
   * 로그인 폼 제출 핸들러
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);

    // 이메일 형식 검증
    if (!isValidEmail(email)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    // 비밀번호 공백 검증
    if (!password.trim()) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setIsLoading(true);

    try {
      // Supabase 로그인
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      // 오류 처리
      if (signInError) {
        throw signInError;
      }

      // 로그인 성공 시 메인 페이지로 리다이렉트
      if (data.user && data.session) {
        // 인증 상태가 이미 반영되므로 refresh 없이 바로 이동
        router.push("/");
      } else {
        throw new Error("로그인에 실패했습니다.");
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // 인증 상태 확인 중에는 로딩 화면 표시
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10">
              <Sparkles className="size-8 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* 로고 및 서비스 소개 */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10">
              <Sparkles className="size-8 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">AI 할 일 관리</h1>
            <p className="text-muted-foreground">
              AI의 힘으로 더 스마트하게 일을 관리하세요
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
            <span>⚡ 빠른 입력</span>
            <span>•</span>
            <span>🎯 명확한 정리</span>
            <span>•</span>
            <span>📊 한눈에 보는 요약</span>
          </div>
        </div>

        {/* 로그인 폼 */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">로그인</CardTitle>
            <CardDescription>
              이메일과 비밀번호를 입력하여 로그인하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 오류 메시지 */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 이메일 입력 */}
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  aria-label="이메일 주소 입력"
                />
              </div>

              {/* 비밀번호 입력 */}
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  aria-label="비밀번호 입력"
                  minLength={6}
                />
              </div>

              {/* 로그인 버튼 */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            {/* 회원가입 링크 */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">계정이 없으신가요? </span>
              <Link
                href="/signup"
                className="text-primary font-medium hover:underline"
              >
                회원가입
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 추가 안내 */}
        <p className="text-center text-xs text-muted-foreground">
          로그인하시면 할 일 관리 서비스를 이용하실 수 있습니다.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
