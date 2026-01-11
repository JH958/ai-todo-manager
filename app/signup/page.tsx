"use client";

import { useState, useEffect, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, AlertCircle, CheckCircle2, Mail } from "lucide-react";

/**
 * 회원가입 페이지 컴포넌트
 * 이메일/비밀번호를 통한 신규 사용자 계정 생성을 제공합니다.
 * @returns 회원가입 페이지 UI
 */
const SignupPage = (): ReactElement => {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] = useState(false);

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
      if (message.includes("User already registered")) {
        return "이미 사용 중인 이메일입니다.";
      }
      if (message.includes("Password")) {
        return "비밀번호 형식이 올바르지 않습니다.";
      }
      if (message.includes("Email")) {
        return "이메일 형식이 올바르지 않습니다.";
      }
      if (message.includes("rate limit")) {
        return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
      }

      return message;
    }

    return "회원가입 중 오류가 발생했습니다. 다시 시도해주세요.";
  };

  /**
   * 회원가입 폼 제출 핸들러
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setRequiresEmailConfirmation(false);

    // 이름 검증
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (name.trim().length < 2) {
      setError("이름은 최소 2자 이상이어야 합니다.");
      return;
    }

    // 이메일 형식 검증
    if (!isValidEmail(email)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    // 비밀번호 확인 검증
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setIsLoading(true);

    try {
      // Supabase 회원가입
      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo,
          data: {
            name: name.trim(),
          },
        },
      });

      // 오류 처리
      if (signUpError) {
        throw signUpError;
      }

      // 이메일 확인이 필요한 경우
      if (data.user && !data.session) {
        setRequiresEmailConfirmation(true);
        setSuccess(true);
        setIsLoading(false);
      } else if (data.user && data.session) {
        // 즉시 로그인된 경우 (이메일 확인 비활성화된 경우)
        setSuccess(true);
        setIsLoading(false);
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 2000);
      } else {
        throw new Error("회원가입에 실패했습니다.");
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

        {/* 회원가입 폼 */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription>
              이름, 이메일과 비밀번호를 입력하여 계정을 만드세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 성공 메시지 */}
              {success && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  {requiresEmailConfirmation ? (
                    <>
                      <Mail className="size-4 text-green-600 dark:text-green-400" />
                      <AlertTitle className="text-green-800 dark:text-green-200">
                        이메일 확인 필요
                      </AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-300 space-y-2">
                        <p>
                          회원가입이 완료되었습니다. <strong>{email}</strong>로 확인 링크를
                          보냈습니다.
                        </p>
                        <p className="text-sm">
                          이메일의 확인 링크를 클릭하면 로그인할 수 있습니다.
                        </p>
                        <div className="pt-2">
                          <Link href="/login" className="text-sm font-medium underline">
                            로그인 페이지로 이동
                          </Link>
                        </div>
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                      <AlertTitle className="text-green-800 dark:text-green-200">
                        회원가입 성공
                      </AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        회원가입이 완료되었습니다. 메인 페이지로 이동합니다...
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}

              {/* 오류 메시지 */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 이름 입력 */}
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading || success}
                  autoComplete="name"
                  aria-label="이름 입력"
                  minLength={2}
                />
              </div>

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
                  disabled={isLoading || success}
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
                  placeholder="비밀번호를 입력하세요 (최소 6자)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || success}
                  autoComplete="new-password"
                  aria-label="비밀번호 입력"
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  비밀번호는 최소 6자 이상이어야 합니다.
                </p>
              </div>

              {/* 비밀번호 확인 입력 */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading || success}
                  autoComplete="new-password"
                  aria-label="비밀번호 확인 입력"
                  minLength={6}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">
                    비밀번호가 일치하지 않습니다.
                  </p>
                )}
              </div>

              {/* 회원가입 버튼 */}
              <Button type="submit" className="w-full" disabled={isLoading || success}>
                {isLoading ? "가입 중..." : success ? "가입 완료" : "회원가입"}
              </Button>
            </form>

            {/* 로그인 링크 */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
              <Link
                href="/login"
                className="text-primary font-medium hover:underline"
              >
                로그인
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 추가 안내 */}
        <p className="text-center text-xs text-muted-foreground">
          회원가입 시 서비스 이용약관 및 개인정보처리방침에 동의한 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
