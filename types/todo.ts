/**
 * 할 일 관련 TypeScript 타입 정의
 */

/**
 * 우선순위 타입
 */
export type Priority = "high" | "medium" | "low";

/**
 * 할 일 데이터 타입
 */
export type Todo = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  created_date: string;
  due_date?: string | null;
  priority?: Priority | null;
  category?: string[] | null;
  completed: boolean;
};

/**
 * 할 일 생성/수정을 위한 입력 데이터 타입
 */
export type TodoInput = {
  title: string;
  description?: string;
  due_date?: string;
  priority?: Priority;
  category?: string[];
  completed?: boolean;
};
