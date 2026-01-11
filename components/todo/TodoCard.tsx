"use client";

import { type ReactElement } from "react";
import { type Todo, type Priority } from "@/types/todo";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PencilIcon, TrashIcon, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 우선순위에 따른 색상 및 라벨 매핑
 */
const priorityConfig: Record<
  Priority,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  high: { label: "높음", variant: "destructive" },
  medium: { label: "중간", variant: "default" },
  low: { label: "낮음", variant: "secondary" },
};

/**
 * 날짜 포맷팅 함수
 */
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * 할 일이 지연되었는지 확인하는 함수
 */
const isOverdue = (dueDate: string | null | undefined, completed: boolean): boolean => {
  if (!dueDate || completed) return false;
  const due = new Date(dueDate);
  const now = new Date();
  return due < now;
};

type TodoCardProps = {
  todo: Todo;
  onToggleComplete?: (id: string, completed: boolean) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
};

/**
 * 개별 할 일을 표시하는 카드 컴포넌트
 * @param todo - 표시할 할 일 데이터
 * @param onToggleComplete - 완료 상태 토글 핸들러
 * @param onEdit - 수정 핸들러
 * @param onDelete - 삭제 핸들러
 * @returns 할 일 카드 UI
 */
const TodoCard = ({
  todo,
  onToggleComplete,
  onEdit,
  onDelete,
}: TodoCardProps): ReactElement => {
  const isOverdueTodo = isOverdue(todo.due_date, todo.completed);
  const priority = todo.priority as Priority | null;

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        todo.completed && "opacity-60",
        isOverdueTodo && !todo.completed && "border-destructive/50"
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Checkbox
            checked={todo.completed}
            onCheckedChange={(checked) => {
              onToggleComplete?.(todo.id, checked === true);
            }}
            className="mt-1"
            aria-label={todo.completed ? "완료 취소" : "완료"}
          />
          <div className="flex-1 min-w-0">
            <CardTitle
              className={cn(
                "text-lg font-semibold",
                todo.completed && "line-through text-muted-foreground"
              )}
            >
              {todo.title}
            </CardTitle>
            {todo.description && (
              <CardDescription className="mt-1">{todo.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>

      {(todo.due_date || priority || (todo.category && todo.category.length > 0)) && (
        <CardContent className="flex flex-wrap items-center gap-2">
          {todo.due_date && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm",
                isOverdueTodo && !todo.completed && "text-destructive font-medium"
              )}
            >
              <CalendarIcon className="size-4" />
              <span>{formatDate(todo.due_date)}</span>
              {isOverdueTodo && !todo.completed && (
                <Badge variant="destructive" className="ml-1">
                  지연
                </Badge>
              )}
            </div>
          )}

          {priority && (
            <Badge variant={priorityConfig[priority].variant}>
              {priorityConfig[priority].label}
            </Badge>
          )}

          {todo.category &&
            todo.category.length > 0 &&
            todo.category.map((cat) => (
              <Badge key={cat} variant="outline">
                {cat}
              </Badge>
            ))}
        </CardContent>
      )}

      <CardFooter className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit?.(todo)}
          aria-label="수정"
        >
          <PencilIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete?.(todo.id)}
          aria-label="삭제"
          className="text-destructive hover:text-destructive"
        >
          <TrashIcon className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export { TodoCard };
