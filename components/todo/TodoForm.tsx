"use client";

import { useState, useEffect, type FormEvent, type ReactElement } from "react";
import { type Todo, type TodoInput, type Priority } from "@/types/todo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TodoFormProps = {
  todo?: Todo | null;
  onSubmit: (data: TodoInput) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
};

/**
 * 우선순위 옵션
 */
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "높음" },
  { value: "medium", label: "중간" },
  { value: "low", label: "낮음" },
];

/**
 * 카테고리 옵션
 */
const CATEGORY_OPTIONS = ["업무", "개인", "학습"];

/**
 * 할 일 추가/편집을 위한 폼 컴포넌트
 * @param todo - 편집할 할 일 데이터 (없으면 새로 생성)
 * @param onSubmit - 폼 제출 핸들러
 * @param onCancel - 취소 핸들러
 * @param isLoading - 로딩 상태
 * @returns 할 일 폼 UI
 */
const TodoForm = ({
  todo,
  onSubmit,
  onCancel,
  isLoading = false,
}: TodoFormProps): ReactElement => {
  const [title, setTitle] = useState(todo?.title || "");
  const [description, setDescription] = useState(todo?.description || "");
  const [dueDate, setDueDate] = useState(
    todo?.due_date ? new Date(todo.due_date).toISOString().slice(0, 16) : ""
  );
  const [priority, setPriority] = useState<Priority | "none">(
    (todo?.priority as Priority) || "none"
  );
  const [categories, setCategories] = useState<string[]>(todo?.category || []);
  const [completed, setCompleted] = useState(todo?.completed || false);
  const [aiInput, setAiInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * todo prop 변경 시 폼 상태 업데이트
   */
  useEffect(() => {
    if (todo) {
      setTitle(todo.title || "");
      setDescription(todo.description || "");
      setDueDate(todo.due_date ? new Date(todo.due_date).toISOString().slice(0, 16) : "");
      setPriority((todo.priority as Priority) || "none");
      setCategories(todo.category || []);
      setCompleted(todo.completed || false);
    } else {
      // todo가 null이면 폼 초기화
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("none");
      setCategories([]);
      setCompleted(false);
    }
  }, [todo]);

  /**
   * 폼 제출 핸들러
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    const formData: TodoInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate || undefined,
      priority: priority === "none" ? undefined : (priority as Priority),
      category: categories.length > 0 ? categories : undefined,
      completed,
    };

    onSubmit(formData);
  };

  /**
   * 카테고리 토글 핸들러
   */
  const toggleCategory = (category: string): void => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  /**
   * AI 기반 할 일 생성 핸들러
   */
  const handleAiGenerate = async (): Promise<void> => {
    if (!aiInput.trim()) {
      toast.error("할 일을 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/ai/generate-todo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: aiInput.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "할 일 생성에 실패했습니다.";
        
        // 할당량 초과 오류인 경우 특별 처리
        if (response.status === 429 || errorMessage.includes("할당량")) {
          throw new Error(
            "AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요."
          );
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // 폼 필드에 변환된 데이터 반영
      if (data.title) {
        setTitle(data.title);
      }
      if (data.description) {
        setDescription(data.description);
      }
      if (data.due_date) {
        // ISO 형식을 datetime-local 형식으로 변환
        const date = new Date(data.due_date);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
      }
      if (data.priority) {
        setPriority(data.priority);
      }
      if (data.category && Array.isArray(data.category)) {
        setCategories(data.category);
      }

      // AI 입력 필드 초기화
      setAiInput("");
      toast.success("할 일이 생성되었습니다. 확인 후 추가해주세요.");
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err.message as string)
          : "할 일 생성 중 오류가 발생했습니다.";
      toast.error(errorMessage);
      console.error("AI 할 일 생성 오류:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{todo ? "할 일 수정" : "새 할 일 추가"}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* AI 할 일 생성 섹션 (편집 모드가 아닐 때만 표시) */}
        {!todo && (
          <div className="mb-6 space-y-2 rounded-lg border bg-muted/50 p-4">
            <Label htmlFor="ai-input" className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI로 할 일 생성
            </Label>
            <div className="flex gap-2">
              <Input
                id="ai-input"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="예: 내일 오후 3시까지 중요한 팀 회의 준비하기"
                disabled={isLoading || isGenerating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAiGenerate();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAiGenerate}
                disabled={isLoading || isGenerating || !aiInput.trim()}
                size="icon"
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              자연어로 할 일을 입력하면 자동으로 구조화됩니다.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 제목 */}
          <div className="space-y-2">
            <Label htmlFor="title">
              제목 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="할 일 제목을 입력하세요"
              required
              disabled={isLoading}
            />
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상세 설명을 입력하세요"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* 마감일 */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">마감일</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* 우선순위 */}
          <div className="space-y-2">
            <Label htmlFor="priority">우선순위</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority | "none")}
              disabled={isLoading}
            >
              <SelectTrigger id="priority">
                <SelectValue placeholder="우선순위 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 카테고리 */}
          <div className="space-y-2">
            <Label>카테고리</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((category) => {
                const isSelected = categories.includes(category);
                return (
                  <Button
                    key={category}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCategory(category)}
                    disabled={isLoading}
                  >
                    {category}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 완료 여부 */}
          {todo && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="completed"
                checked={completed}
                onCheckedChange={(checked) => setCompleted(checked === true)}
                disabled={isLoading}
              />
              <Label htmlFor="completed" className="cursor-pointer">
                완료됨
              </Label>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                취소
              </Button>
            )}
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {isLoading ? "처리 중..." : todo ? "수정" : "추가"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export { TodoForm };
