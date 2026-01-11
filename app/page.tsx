"use client";

import { useState, useEffect, useMemo, useCallback, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type Todo, type TodoInput, type Priority } from "@/types/todo";
import { TodoForm } from "@/components/todo/TodoForm";
import { TodoList } from "@/components/todo/TodoList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, LogOut, User, Search, Filter, AlertCircle, Loader2, BarChart3, Lightbulb, CheckCircle2, TrendingUp, Target, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * 메인 페이지 컴포넌트
 * 할 일 관리 메인 화면을 구성합니다.
 * @returns 메인 페이지 UI
 */
const HomePage = (): ReactElement => {
  const router = useRouter();
  const supabase = createClient();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending" | "waiting">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [sortBy, setSortBy] = useState<"created" | "due" | "priority" | "title">("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    name: string;
    id: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTodosLoading, setIsTodosLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  
  // AI 분석 관련 상태
  const [analysisData, setAnalysisData] = useState<{
    summary: string;
    urgentTasks: string[];
    insights: string[];
    recommendations: string[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPeriod, setAnalysisPeriod] = useState<"today" | "week">("today");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [filteredTodosForAnalysis, setFilteredTodosForAnalysis] = useState<Todo[]>([]);

  /**
   * 필터링 및 정렬된 할 일 목록
   */
  const filteredAndSortedTodos = useMemo(() => {
    let filtered = [...todos];

    // 검색 필터 (제목 기준)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((todo) => todo.title.toLowerCase().includes(query));
    }

    // 상태 필터
    if (statusFilter === "completed") {
      filtered = filtered.filter((todo) => todo.completed);
    } else if (statusFilter === "pending") {
      filtered = filtered.filter((todo) => !todo.completed);
    } else if (statusFilter === "waiting") {
      filtered = filtered.filter((todo) => !todo.completed && !todo.due_date);
    }

    // 우선순위 필터
    if (priorityFilter !== "all") {
      filtered = filtered.filter((todo) => todo.priority === priorityFilter);
    }

    // 정렬
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "created":
          comparison = new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
          break;
        case "due":
          if (!a.due_date && !b.due_date) comparison = 0;
          else if (!a.due_date) comparison = 1;
          else if (!b.due_date) comparison = -1;
          else comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          break;
        case "priority":
          const priorityOrder: Record<Priority | "null", number> = {
            high: 3,
            medium: 2,
            low: 1,
            null: 0,
          };
          comparison = 
            priorityOrder[(a.priority || "null") as Priority | "null"] -
            priorityOrder[(b.priority || "null") as Priority | "null"];
          break;
        case "title":
          comparison = a.title.localeCompare(b.title, "ko");
          break;
        default:
          comparison = 0;
      }
      
      // 정렬 순서 적용 (desc: 내림차순, asc: 오름차순)
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [todos, searchQuery, statusFilter, priorityFilter, sortBy, sortOrder]);

  /**
   * 할 일 목록 조회
   */
  const fetchTodos = useCallback(async (): Promise<void> => {
    if (!currentUser?.id) return;

    setIsTodosLoading(true);
    try {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_date", { ascending: false });

      if (error) {
        throw error;
      }

      setTodos((data as Todo[]) || []);
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "할 일 목록을 불러오는 중 오류가 발생했습니다.";
      toast.error(errorMessage);
      console.error("할 일 목록 조회 오류:", err);
    } finally {
      setIsTodosLoading(false);
    }
  }, [currentUser?.id, supabase]);

  /**
   * 할 일 추가 핸들러
   */
  const handleAddTodo = async (data: TodoInput): Promise<void> => {
    if (!currentUser?.id) {
      toast.error("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      const { data: newTodo, error } = await supabase
        .from("todos")
        .insert({
          user_id: currentUser.id,
          title: data.title,
          description: data.description || null,
          due_date: data.due_date || null,
          priority: data.priority || null,
          category: data.category || null,
          completed: false,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast.success("할 일이 추가되었습니다.");
      await fetchTodos();
      // 폼 초기화를 위해 editingTodo를 null로 설정
      setEditingTodo(null);
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "할 일 추가 중 오류가 발생했습니다.";
      toast.error(errorMessage);
      console.error("할 일 추가 오류:", err);
    }
  };

  /**
   * 할 일 수정 핸들러
   */
  const handleUpdateTodo = async (data: TodoInput): Promise<void> => {
    if (!editingTodo || !currentUser?.id) {
      return;
    }

    try {
      const { error } = await supabase
        .from("todos")
        .update({
          title: data.title,
          description: data.description || null,
          due_date: data.due_date || null,
          priority: data.priority || null,
          category: data.category || null,
          completed: data.completed ?? editingTodo.completed,
        })
        .eq("id", editingTodo.id)
        .eq("user_id", currentUser.id);

      if (error) {
        throw error;
      }

      toast.success("할 일이 수정되었습니다.");
      setEditingTodo(null);
      await fetchTodos();
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "할 일 수정 중 오류가 발생했습니다.";
      toast.error(errorMessage);
      console.error("할 일 수정 오류:", err);
    }
  };

  /**
   * 할 일 삭제 핸들러
   */
  const handleDeleteTodo = async (id: string): Promise<void> => {
    if (!currentUser?.id) {
      toast.error("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    if (!confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (error) {
        throw error;
      }

      toast.success("할 일이 삭제되었습니다.");
      if (editingTodo?.id === id) {
        setEditingTodo(null);
      }
      await fetchTodos();
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "할 일 삭제 중 오류가 발생했습니다.";
      toast.error(errorMessage);
      console.error("할 일 삭제 오류:", err);
    }
  };

  /**
   * 할 일 완료 상태 토글 핸들러
   */
  const handleToggleComplete = async (id: string, completed: boolean): Promise<void> => {
    if (!currentUser?.id) {
      toast.error("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      const { error } = await supabase
        .from("todos")
        .update({ completed })
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (error) {
        throw error;
      }

      await fetchTodos();
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "상태 변경 중 오류가 발생했습니다.";
      toast.error(errorMessage);
      console.error("할 일 상태 변경 오류:", err);
    }
  };

  /**
   * 할 일 수정 시작 핸들러
   */
  const handleEditTodo = (todo: Todo): void => {
    setEditingTodo(todo);
  };

  /**
   * 폼 제출 핸들러
   */
  const handleFormSubmit = async (data: TodoInput): Promise<void> => {
    if (editingTodo) {
      await handleUpdateTodo(data);
    } else {
      await handleAddTodo(data);
    }
  };

  /**
   * 폼 취소 핸들러
   */
  const handleFormCancel = (): void => {
    setEditingTodo(null);
  };

  /**
   * 현재 사용자 정보 가져오기
   */
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // 먼저 세션 확인
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 세션이 없으면 로그인 페이지로 리다이렉트
        if (!session) {
          router.push("/login");
          setIsLoading(false);
          return;
        }

        // 세션이 있으면 사용자 정보 가져오기
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("사용자 정보 조회 오류:", error);
          router.push("/login");
          return;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        // 사용자 정보 설정
        const userName =
          (user.user_metadata?.name as string) ||
          user.email?.split("@")[0] ||
          "사용자";
        const userEmail = user.email || "";

        setCurrentUser({
          id: user.id,
          email: userEmail,
          name: userName,
        });
      } catch (err) {
        console.error("사용자 정보 조회 중 오류:", err);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setCurrentUser(null);
        router.push("/login");
      } else {
        const userName =
          (session.user.user_metadata?.name as string) ||
          session.user.email?.split("@")[0] ||
          "사용자";
        const userEmail = session.user.email || "";

        setCurrentUser({
          id: session.user.id,
          email: userEmail,
          name: userName,
        });
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  /**
   * 사용자 정보가 로드되면 할 일 목록 조회
   */
  useEffect(() => {
    if (currentUser?.id) {
      fetchTodos();
    }
  }, [currentUser?.id, fetchTodos]);

  /**
   * AI 분석 실행 핸들러
   */
  const handleAnalyzeTodos = async (period: "today" | "week"): Promise<void> => {
    if (!currentUser?.id) {
      toast.error("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisPeriod(period);

    try {
      // 기간별 할 일 필터링
      const now = new Date();
      const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      koreaTime.setHours(0, 0, 0, 0);

      let filteredTodos: Todo[] = [];

      if (period === "today") {
        // 오늘의 할 일 필터링: 오늘 생성된 할 일 또는 오늘 마감인 할 일
        const todayStart = new Date(koreaTime);
        const todayEnd = new Date(koreaTime);
        todayEnd.setHours(23, 59, 59, 999);

        filteredTodos = todos.filter((todo) => {
          // 오늘 생성된 할 일 포함
          const createdDate = new Date(todo.created_date);
          const isCreatedToday = createdDate >= todayStart && createdDate <= todayEnd;

          // 오늘 마감인 할 일 포함
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date);
            const isDueToday = dueDate >= todayStart && dueDate <= todayEnd;
            return isCreatedToday || isDueToday;
          }

          // due_date가 없으면 오늘 생성된 것만 포함
          return isCreatedToday;
        });
      } else {
        // 이번 주의 할 일 필터링 (월요일부터 일요일)
        const dayOfWeek = koreaTime.getDay();
        const monday = new Date(koreaTime);
        monday.setDate(koreaTime.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        filteredTodos = todos.filter((todo) => {
          // 이번 주 생성된 할 일 포함
          const createdDate = new Date(todo.created_date);
          const isCreatedThisWeek = createdDate >= monday && createdDate <= sunday;

          // 이번 주 마감인 할 일 포함
          if (todo.due_date) {
            const dueDate = new Date(todo.due_date);
            const isDueThisWeek = dueDate >= monday && dueDate <= sunday;
            return isCreatedThisWeek || isDueThisWeek;
          }

          // due_date가 없으면 이번 주 생성된 것만 포함
          return isCreatedThisWeek;
        });
      }

      // API 호출
      const response = await fetch("/api/ai/analyze-todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          todos: filteredTodos,
          period,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "할 일 분석에 실패했습니다.";
        
        if (response.status === 429) {
          throw new Error("AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.");
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setAnalysisData(data);
      setFilteredTodosForAnalysis(filteredTodos);
      toast.success("할 일 분석이 완료되었습니다.");
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "할 일 분석 중 오류가 발생했습니다.";
      setAnalysisError(errorMessage);
      toast.error(errorMessage);
      console.error("AI 할 일 분석 오류:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * 분석 완료율 계산
   */
  const calculateCompletionRate = (todosList: Todo[]): number => {
    if (todosList.length === 0) return 0;
    const completed = todosList.filter((todo) => todo.completed).length;
    return (completed / todosList.length) * 100;
  };

  /**
   * 로그아웃 핸들러
   */
  const handleLogout = async (): Promise<void> => {
    setLogoutError(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // 세션 제거 확인 후 로그인 페이지로 이동
      setCurrentUser(null);
      // 상태 변경을 즉시 반영하기 위해 refresh 호출
      router.push("/login");
      router.refresh();
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "로그아웃 중 오류가 발생했습니다.";
      setLogoutError(errorMessage);
      console.error("로그아웃 오류:", err);
    }
  };

  // 로딩 중이거나 사용자 정보가 없으면 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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

  // 사용자 정보가 없으면 아무것도 표시하지 않음 (리다이렉트 처리됨)
  if (!currentUser) {
    return <></>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">AI Todo Management</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* 로그아웃 오류 메시지 */}
            {logoutError && (
              <Alert variant="destructive" className="max-w-xs">
                <AlertCircle className="size-4" />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription className="text-xs">{logoutError}</AlertDescription>
              </Alert>
            )}

            {/* 사용자 정보 및 로그아웃 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="size-4" />
                  <span className="hidden sm:inline">{currentUser.name}</span>
                  <span className="hidden md:inline text-muted-foreground">
                    ({currentUser.email})
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="size-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* 검색창 */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="할 일 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* 필터 및 정렬 */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              {/* 상태 필터 */}
              <Select value={statusFilter} onValueChange={(value: "all" | "completed" | "pending" | "waiting") => setStatusFilter(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">진행 중</SelectItem>
                  <SelectItem value="waiting">대기</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>

              {/* 우선순위 필터 */}
              <Select
                value={priorityFilter}
                onValueChange={(value: "all" | Priority) => setPriorityFilter(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="우선순위" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">중간</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>

              {/* 정렬 기준 */}
              <Select
                value={sortBy}
                onValueChange={(value: "created" | "due" | "priority" | "title") => setSortBy(value)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">생성일순</SelectItem>
                  <SelectItem value="due">마감일순</SelectItem>
                  <SelectItem value="priority">우선순위순</SelectItem>
                  <SelectItem value="title">제목순</SelectItem>
                </SelectContent>
              </Select>

              {/* 정렬 순서 */}
              <Select
                value={sortOrder}
                onValueChange={(value: "asc" | "desc") => setSortOrder(value)}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="순서" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">내림차순</SelectItem>
                  <SelectItem value="asc">오름차순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <main className="container flex-1 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 좌측: 할 일 추가/수정 폼 */}
          <div className="lg:sticky lg:top-32 lg:h-fit">
            <TodoForm
              todo={editingTodo}
              onSubmit={handleFormSubmit}
              onCancel={editingTodo ? handleFormCancel : undefined}
            />
          </div>

          {/* 중앙: 할 일 목록 및 AI 분석 */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI 요약 및 분석 섹션 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" />
                  AI 요약 및 분석
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={analysisPeriod}
                  onValueChange={(value) => setAnalysisPeriod(value as "today" | "week")}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="today">오늘의 요약</TabsTrigger>
                    <TabsTrigger value="week">이번 주 요약</TabsTrigger>
                  </TabsList>
                  <TabsContent value="today" className="mt-4">
                    <div className="space-y-4">
                      <Button
                        onClick={() => handleAnalyzeTodos("today")}
                        disabled={isAnalyzing}
                        className="w-full"
                      >
                        {isAnalyzing && analysisPeriod === "today" ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 size-4" />
                            AI 요약
                          </>
                        )}
                      </Button>

                      {/* 오류 상태 */}
                      {analysisError && analysisPeriod === "today" && (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>분석 오류</AlertTitle>
                          <AlertDescription className="mt-2">
                            {analysisError}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => handleAnalyzeTodos("today")}
                            >
                              재시도
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* 분석 결과 */}
                      {analysisData && analysisPeriod === "today" && (
                        <div className="space-y-4 pt-4">
                          {/* 완료율 및 요약 */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-primary" />
                                오늘의 진행 상황
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* 완료율 진행바 */}
                              {filteredTodosForAnalysis.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">완료율</span>
                                    <span className="text-2xl font-bold text-primary">
                                      {calculateCompletionRate(filteredTodosForAnalysis).toFixed(0)}%
                                    </span>
                                  </div>
                                  <Progress value={calculateCompletionRate(filteredTodosForAnalysis)} className="h-3" />
                                  <p className="text-xs text-muted-foreground">
                                    {filteredTodosForAnalysis.filter((t) => t.completed).length} / {filteredTodosForAnalysis.length}개 완료
                                  </p>
                                </div>
                              )}
                              <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-sm text-foreground">{analysisData.summary}</p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* 긴급한 할 일 (하이라이트) */}
                          {analysisData.urgentTasks.length > 0 && (
                            <Card className="border-destructive/50 bg-destructive/5">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <AlertTriangle className="size-4 text-destructive" />
                                  ⚠️ 긴급한 할 일
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {analysisData.urgentTasks.map((task, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2 rounded-md bg-background p-2 border border-destructive/20"
                                    >
                                      <Badge variant="destructive" className="mt-0.5 shrink-0">
                                        긴급
                                      </Badge>
                                      <span className="text-sm font-medium">{task}</span>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* 인사이트 카드들 */}
                          {analysisData.insights.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Lightbulb className="size-4 text-yellow-500" />
                                💡 인사이트
                              </h3>
                              <div className="grid gap-3 sm:grid-cols-1">
                                {analysisData.insights.map((insight, idx) => (
                                  <Card key={idx} className="border-l-4 border-l-yellow-500">
                                    <CardContent className="pt-4">
                                      <p className="text-sm text-foreground">{insight}</p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 추천 사항 */}
                          {analysisData.recommendations.length > 0 && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Sparkles className="size-4 text-primary" />
                                  🎯 실행 가능한 추천
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  {analysisData.recommendations.map((rec, idx) => (
                                    <div key={idx} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                                      <Badge variant="outline" className="mt-0.5 shrink-0">
                                        {idx + 1}
                                      </Badge>
                                      <p className="text-sm text-foreground flex-1">{rec}</p>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="week" className="mt-4">
                    <div className="space-y-4">
                      <Button
                        onClick={() => handleAnalyzeTodos("week")}
                        disabled={isAnalyzing}
                        className="w-full"
                      >
                        {isAnalyzing && analysisPeriod === "week" ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 size-4" />
                            AI 요약
                          </>
                        )}
                      </Button>
                      {/* 오류 상태 */}
                      {analysisError && analysisPeriod === "week" && (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>분석 오류</AlertTitle>
                          <AlertDescription className="mt-2">
                            {analysisError}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => handleAnalyzeTodos("week")}
                            >
                              재시도
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* 분석 결과 */}
                      {analysisData && analysisPeriod === "week" && (
                        <div className="space-y-4 pt-4">
                          {/* 주간 완료율 및 요약 */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="size-4 text-primary" />
                                이번 주 진행 상황
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* 주간 완료율 */}
                              {filteredTodosForAnalysis.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">주간 완료율</span>
                                    <span className="text-2xl font-bold text-primary">
                                      {calculateCompletionRate(filteredTodosForAnalysis).toFixed(0)}%
                                    </span>
                                  </div>
                                  <Progress value={calculateCompletionRate(filteredTodosForAnalysis)} className="h-3" />
                                  <p className="text-xs text-muted-foreground">
                                    {filteredTodosForAnalysis.filter((t) => t.completed).length} / {filteredTodosForAnalysis.length}개 완료
                                  </p>
                                </div>
                              )}
                              <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-sm text-foreground">{analysisData.summary}</p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* 긴급한 할 일 */}
                          {analysisData.urgentTasks.length > 0 && (
                            <Card className="border-destructive/50 bg-destructive/5">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <AlertTriangle className="size-4 text-destructive" />
                                  ⚠️ 긴급한 할 일
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {analysisData.urgentTasks.map((task, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2 rounded-md bg-background p-2 border border-destructive/20"
                                    >
                                      <Badge variant="destructive" className="mt-0.5 shrink-0">
                                        긴급
                                      </Badge>
                                      <span className="text-sm font-medium">{task}</span>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* 인사이트 카드들 */}
                          {analysisData.insights.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Lightbulb className="size-4 text-yellow-500" />
                                💡 주간 인사이트
                              </h3>
                              <div className="grid gap-3 sm:grid-cols-1">
                                {analysisData.insights.map((insight, idx) => (
                                  <Card key={idx} className="border-l-4 border-l-yellow-500">
                                    <CardContent className="pt-4">
                                      <p className="text-sm text-foreground">{insight}</p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 추천 사항 및 다음 주 계획 */}
                          {analysisData.recommendations.length > 0 && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Target className="size-4 text-primary" />
                                  🎯 다음 주 계획 제안
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  {analysisData.recommendations.map((rec, idx) => (
                                    <div key={idx} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                                      <Badge variant="outline" className="mt-0.5 shrink-0">
                                        {idx + 1}
                                      </Badge>
                                      <p className="text-sm text-foreground flex-1">{rec}</p>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* 할 일 목록 */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  할 일 목록 ({filteredAndSortedTodos.length})
                </h2>
              </div>
              <TodoList
                todos={filteredAndSortedTodos}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEditTodo}
                onDelete={handleDeleteTodo}
                isLoading={isTodosLoading}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
