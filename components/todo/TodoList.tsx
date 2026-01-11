"use client";

import { type ReactElement } from "react";
import { type Todo } from "@/types/todo";
import { TodoCard } from "@/components/todo/TodoCard";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

type TodoListProps = {
  todos: Todo[];
  onToggleComplete?: (id: string, completed: boolean) => void;
  onEdit?: (todo: Todo) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
};

/**
 * 할 일 목록을 표시하는 컴포넌트
 * @param todos - 표시할 할 일 목록
 * @param onToggleComplete - 완료 상태 토글 핸들러
 * @param onEdit - 수정 핸들러
 * @param onDelete - 삭제 핸들러
 * @param isLoading - 로딩 상태
 * @returns 할 일 목록 UI
 */
const TodoList = ({
  todos,
  onToggleComplete,
  onEdit,
  onDelete,
  isLoading = false,
}: TodoListProps): ReactElement => {
  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border bg-muted/50"
            aria-label="로딩 중"
          />
        ))}
      </div>
    );
  }

  // 할 일이 없을 때
  if (todos.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>할 일이 없습니다</EmptyTitle>
          <EmptyDescription>새로운 할 일을 추가해보세요</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {todos.map((todo) => (
        <TodoCard
          key={todo.id}
          todo={todo}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export { TodoList };
