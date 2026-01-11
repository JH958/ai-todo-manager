import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";

/**
 * AI 분석 결과 데이터 구조 스키마
 */
const TodoAnalysisSchema = z.object({
  summary: z.string().describe("할 일 요약 (완료율 포함)"),
  urgentTasks: z.array(z.string()).describe("긴급한 할 일 제목 목록"),
  insights: z.array(z.string()).describe("인사이트 목록 (패턴, 집중도 등)"),
  recommendations: z.array(z.string()).describe("실행 가능한 추천 사항 목록"),
});

/**
 * 할 일 목록을 분석하여 요약과 인사이트를 제공하는 API 엔드포인트
 * @param request - POST 요청 (body: { todos: Todo[], period: "today" | "week" })
 * @returns 분석 결과 데이터
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // API 키 확인
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 요청 본문 파싱
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "요청 본문을 파싱할 수 없습니다. JSON 형식을 확인해주세요." },
        { status: 400 }
      );
    }

    const { todos, period } = body;

    // 입력 검증
    if (!Array.isArray(todos)) {
      return NextResponse.json(
        { error: "할 일 목록이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    if (period !== "today" && period !== "week") {
      return NextResponse.json(
        { error: "분석 기간은 'today' 또는 'week'여야 합니다." },
        { status: 400 }
      );
    }

    // 할 일 목록이 비어있는 경우
    if (todos.length === 0) {
      return NextResponse.json(
        {
          summary: period === "today" ? "오늘 등록된 할 일이 없습니다." : "이번 주 등록된 할 일이 없습니다.",
          urgentTasks: [],
          insights: ["할 일을 추가하여 시작해보세요!"],
          recommendations: [],
        },
        { status: 200 }
      );
    }

    // 현재 날짜/시간 정보 (한국 시간 기준)
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const currentDateStr = koreaTime.toISOString().slice(0, 10);
    const currentTimeStr = `${String(koreaTime.getHours()).padStart(2, "0")}:${String(koreaTime.getMinutes()).padStart(2, "0")}`;

    // 통계 계산
    const totalTodos = todos.length;
    const completedTodos = todos.filter((todo) => todo.completed).length;
    const completionRate = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;

    // 우선순위별 분포 및 완료율
    const priorityStats = {
      high: {
        total: todos.filter((todo) => todo.priority === "high").length,
        completed: todos.filter((todo) => todo.priority === "high" && todo.completed).length,
      },
      medium: {
        total: todos.filter((todo) => todo.priority === "medium").length,
        completed: todos.filter((todo) => todo.priority === "medium" && todo.completed).length,
      },
      low: {
        total: todos.filter((todo) => todo.priority === "low").length,
        completed: todos.filter((todo) => todo.priority === "low" && todo.completed).length,
      },
      none: {
        total: todos.filter((todo) => !todo.priority).length,
        completed: todos.filter((todo) => !todo.priority && todo.completed).length,
      },
    };

    // 우선순위별 완료율 계산
    const priorityCompletionRates: Record<string, number> = {};
    Object.entries(priorityStats).forEach(([priority, stats]) => {
      priorityCompletionRates[priority] = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
    });

    // 카테고리별 분포 및 완료율
    const categoryStats: Record<string, { total: number; completed: number }> = {};
    todos.forEach((todo) => {
      if (todo.category && Array.isArray(todo.category)) {
        todo.category.forEach((cat: string) => {
          if (!categoryStats[cat]) {
            categoryStats[cat] = { total: 0, completed: 0 };
          }
          categoryStats[cat].total++;
          if (todo.completed) {
            categoryStats[cat].completed++;
          }
        });
      }
    });

    // 마감일 준수율 및 연기된 할 일 분석
    const todosWithDueDate = todos.filter((todo) => todo.due_date);
    const overdueTodos = todosWithDueDate.filter((todo) => {
      if (todo.completed) return false;
      const dueDate = new Date(todo.due_date!);
      return dueDate < koreaTime;
    });
    const completedOnTime = todosWithDueDate.filter((todo) => {
      if (!todo.completed) return false;
      const dueDate = new Date(todo.due_date!);
      const completedDate = new Date(todo.created_date);
      return completedDate <= dueDate;
    });
    const deadlineComplianceRate = todosWithDueDate.length > 0
      ? (completedOnTime.length / todosWithDueDate.length) * 100
      : 0;

    // 시간대별 업무 집중도 (due_date 기준, 미완료만)
    const timeDistribution: Record<string, number> = {
      오전: 0,
      오후: 0,
      저녁: 0,
      기타: 0,
    };

    todos.forEach((todo) => {
      if (todo.due_date && !todo.completed) {
        const dueDate = new Date(todo.due_date);
        const hour = dueDate.getHours();
        if (hour >= 6 && hour < 12) {
          timeDistribution["오전"]++;
        } else if (hour >= 12 && hour < 18) {
          timeDistribution["오후"]++;
        } else if (hour >= 18 && hour < 22) {
          timeDistribution["저녁"]++;
        } else {
          timeDistribution["기타"]++;
        }
      }
    });

    // 요일별 생산성 분석 (생성일 기준)
    const dayOfWeekStats: Record<string, { created: number; completed: number }> = {
      일요일: { created: 0, completed: 0 },
      월요일: { created: 0, completed: 0 },
      화요일: { created: 0, completed: 0 },
      수요일: { created: 0, completed: 0 },
      목요일: { created: 0, completed: 0 },
      금요일: { created: 0, completed: 0 },
      토요일: { created: 0, completed: 0 },
    };

    const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

    todos.forEach((todo) => {
      const createdDate = new Date(todo.created_date);
      const dayName = dayNames[createdDate.getDay()];
      dayOfWeekStats[dayName].created++;
      if (todo.completed) {
        dayOfWeekStats[dayName].completed++;
      }
    });

    // 시간대별 생산성 분석 (생성 시간 기준)
    const hourStats: Record<string, { created: number; completed: number }> = {
      새벽: { created: 0, completed: 0 },
      오전: { created: 0, completed: 0 },
      오후: { created: 0, completed: 0 },
      저녁: { created: 0, completed: 0 },
    };

    todos.forEach((todo) => {
      const createdDate = new Date(todo.created_date);
      const hour = createdDate.getHours();
      let timeSlot = "저녁";
      if (hour >= 0 && hour < 6) {
        timeSlot = "새벽";
      } else if (hour >= 6 && hour < 12) {
        timeSlot = "오전";
      } else if (hour >= 12 && hour < 18) {
        timeSlot = "오후";
      }
      hourStats[timeSlot].created++;
      if (todo.completed) {
        hourStats[timeSlot].completed++;
      }
    });

    // 자주 미루는 작업 유형 분석 (연기된 할 일의 카테고리/우선순위)
    const postponedCategoryCount: Record<string, number> = {};
    const postponedPriorityCount: Record<string, number> = { high: 0, medium: 0, low: 0, none: 0 };

    overdueTodos.forEach((todo) => {
      if (todo.category && Array.isArray(todo.category)) {
        todo.category.forEach((cat: string) => {
          postponedCategoryCount[cat] = (postponedCategoryCount[cat] || 0) + 1;
        });
      }
      const priority = todo.priority || "none";
      postponedPriorityCount[priority]++;
    });

    // 완료하기 쉬운 작업의 특징 (완료된 할 일의 공통점)
    const completedCategoryCount: Record<string, number> = {};
    const completedPriorityCount: Record<string, number> = { high: 0, medium: 0, low: 0, none: 0 };

    todos.filter((todo) => todo.completed).forEach((todo) => {
      if (todo.category && Array.isArray(todo.category)) {
        todo.category.forEach((cat: string) => {
          completedCategoryCount[cat] = (completedCategoryCount[cat] || 0) + 1;
        });
      }
      const priority = todo.priority || "none";
      completedPriorityCount[priority]++;
    });

    // 긴급한 할 일 (미완료 + high priority 또는 마감일이 가까운 것)
    const urgentTasks = todos
      .filter((todo) => {
        if (todo.completed) return false;
        if (todo.priority === "high") return true;
        if (todo.due_date) {
          const dueDate = new Date(todo.due_date);
          const daysDiff = Math.floor((dueDate.getTime() - koreaTime.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff <= 1;
        }
        return false;
      })
      .map((todo) => todo.title)
      .slice(0, 5);

    // 프롬프트 작성
    const periodLabel = period === "today" ? "오늘" : "이번 주";
    
    // 가장 생산적인 요일 찾기
    const mostProductiveDay = Object.entries(dayOfWeekStats)
      .sort((a, b) => {
        const aRate = a[1].created > 0 ? (a[1].completed / a[1].created) * 100 : 0;
        const bRate = b[1].created > 0 ? (b[1].completed / b[1].created) * 100 : 0;
        return bRate - aRate;
      })[0];

    // 가장 생산적인 시간대 찾기
    const mostProductiveTime = Object.entries(hourStats)
      .sort((a, b) => {
        const aRate = a[1].created > 0 ? (a[1].completed / a[1].created) * 100 : 0;
        const bRate = b[1].created > 0 ? (b[1].completed / b[1].created) * 100 : 0;
        return bRate - aRate;
      })[0];

    // 자주 미루는 카테고리
    const mostPostponedCategory = Object.entries(postponedCategoryCount)
      .sort((a, b) => b[1] - a[1])[0];

    // 가장 잘 완료하는 카테고리
    const mostCompletedCategory = Object.entries(completedCategoryCount)
      .sort((a, b) => b[1] - a[1])[0];

    const systemPrompt = `당신은 할 일 관리 전문가이자 생산성 코치입니다. 사용자의 할 일 목록을 깊이 있게 분석하여 실용적이고 동기부여가 되는 인사이트를 제공해주세요.

현재 날짜/시간: ${currentDateStr} ${currentTimeStr}
분석 기간: ${periodLabel}

=== 기본 통계 ===
- 총 할 일 수: ${totalTodos}개
- 완료된 할 일: ${completedTodos}개
- 전체 완료율: ${completionRate.toFixed(1)}%

=== 우선순위별 완료율 분석 ===
${Object.entries(priorityStats).map(([priority, stats]) => {
  const rate = priorityCompletionRates[priority];
  const priorityLabel = priority === "high" ? "높음" : priority === "medium" ? "중간" : priority === "low" ? "낮음" : "미설정";
  return `- ${priorityLabel}: ${stats.completed}/${stats.total}개 완료 (${rate.toFixed(1)}%)`;
}).join("\n")}

=== 카테고리별 완료율 분석 ===
${Object.entries(categoryStats).length > 0
  ? Object.entries(categoryStats).map(([cat, stats]) => {
      const rate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
      return `- ${cat}: ${stats.completed}/${stats.total}개 완료 (${rate.toFixed(1)}%)`;
    }).join("\n")
  : "- 카테고리 정보 없음"}

=== 시간 관리 분석 ===
- 마감일이 있는 할 일: ${todosWithDueDate.length}개
- 마감일 준수율: ${deadlineComplianceRate.toFixed(1)}% (마감일 전 완료: ${completedOnTime.length}개)
- 연기된 할 일: ${overdueTodos.length}개 (마감일이 지났지만 미완료)
${overdueTodos.length > 0 && mostPostponedCategory
  ? `- 가장 자주 미루는 카테고리: ${mostPostponedCategory[0]} (${mostPostponedCategory[1]}개)`
  : ""}

=== 시간대별 업무 집중도 (예정된 할 일) ===
- 오전: ${timeDistribution["오전"]}개
- 오후: ${timeDistribution["오후"]}개
- 저녁: ${timeDistribution["저녁"]}개
- 기타: ${timeDistribution["기타"]}개

=== 생산성 패턴 분석 ===
요일별 생산성 (생성일 기준):
${Object.entries(dayOfWeekStats).map(([day, stats]) => {
  const rate = stats.created > 0 ? (stats.completed / stats.created) * 100 : 0;
  return `- ${day}: ${stats.completed}/${stats.created}개 완료 (${rate.toFixed(1)}%)`;
}).join("\n")}
${mostProductiveDay[1].created > 0 ? `→ 가장 생산적인 요일: ${mostProductiveDay[0]} (완료율 ${((mostProductiveDay[1].completed / mostProductiveDay[1].created) * 100).toFixed(1)}%)` : ""}

시간대별 생산성 (생성 시간 기준):
${Object.entries(hourStats).map(([time, stats]) => {
  const rate = stats.created > 0 ? (stats.completed / stats.created) * 100 : 0;
  return `- ${time}: ${stats.completed}/${stats.created}개 완료 (${rate.toFixed(1)}%)`;
}).join("\n")}
${mostProductiveTime[1].created > 0 ? `→ 가장 생산적인 시간대: ${mostProductiveTime[0]} (완료율 ${((mostProductiveTime[1].completed / mostProductiveTime[1].created) * 100).toFixed(1)}%)` : ""}

=== 작업 유형 분석 ===
${mostPostponedCategory ? `자주 미루는 작업: ${mostPostponedCategory[0]} 카테고리 (${mostPostponedCategory[1]}개)` : "연기된 할 일 없음"}
${mostCompletedCategory ? `가장 잘 완료하는 작업: ${mostCompletedCategory[0]} 카테고리 (${mostCompletedCategory[1]}개 완료)` : ""}

=== 할 일 상세 목록 ===
${todos.map((todo, idx) => {
  const dueDateStr = todo.due_date ? new Date(todo.due_date).toLocaleString("ko-KR") : "마감일 없음";
  const createdDateStr = new Date(todo.created_date).toLocaleString("ko-KR");
  const status = todo.completed ? "✅ 완료" : "⏳ 진행중";
  const priority = todo.priority ? `[${todo.priority}]` : "[미설정]";
  const category = todo.category && Array.isArray(todo.category) ? todo.category.join(", ") : "카테고리 없음";
  const isOverdue = todo.due_date && !todo.completed && new Date(todo.due_date) < koreaTime ? "⚠️ 연기됨" : "";
  return `${idx + 1}. ${status} ${priority} "${todo.title}" - 생성: ${createdDateStr}, 마감: ${dueDateStr}, 카테고리: ${category} ${isOverdue}`;
}).join("\n")}

=== 분석 요청사항 ===

다음 형식으로 깊이 있는 분석 결과를 제공해주세요:

1. summary (요약):
   ${period === "today" 
     ? "오늘의 집중도와 생산성을 요약하고, 남은 할 일의 우선순위를 제시해주세요. 완료율과 함께 오늘 하루의 성과를 긍정적으로 평가해주세요."
     : "이번 주 전체 패턴을 요약하고, 완료율, 생산성 트렌드, 주요 성과를 포함해주세요. 다음 주 계획에 대한 제안도 포함해주세요."}

2. urgentTasks (긴급한 할 일):
   미완료 상태이면서 높은 우선순위이거나 마감일이 임박한(24시간 이내) 할 일 제목 목록 (최대 5개)

3. insights (인사이트):
   다음 항목들을 포함하여 3-5개의 구체적인 인사이트를 제공해주세요:
   - 완료율 분석: 우선순위별, 카테고리별 완료 패턴의 특징
   - 시간 관리: 마감일 준수율, 연기 패턴, 시간대별 집중도
   - 생산성 패턴: 가장 생산적인 요일/시간대, 생산성 높은 작업의 특징
   - 개선 기회: 자주 미루는 작업 유형, 완료하기 쉬운 작업의 공통점
   ${period === "week" ? "- 주간 트렌드: 이번 주의 변화와 개선점" : ""}
   
   각 인사이트는 구체적인 수치와 함께 자연스러운 한국어 문장으로 작성해주세요.

4. recommendations (추천 사항):
   다음을 포함하여 3-4개의 실행 가능한 추천을 제공해주세요:
   - 구체적인 시간 관리 팁 (예: "오후 시간대에 집중이 필요한 작업을 배치하세요")
   - 우선순위 조정 및 일정 재배치 제안
   - 업무 과부하를 줄이는 분산 전략
   - 생산성 향상을 위한 실용적 조언
   
   각 추천은 즉시 실행 가능하도록 구체적이고 명확하게 작성해주세요.

=== 작성 가이드라인 ===

1. 긍정적인 톤 유지:
   - 사용자가 잘하고 있는 부분을 먼저 강조하고 격려해주세요
   - 개선점을 비판이 아닌 건설적인 제안으로 제시해주세요
   - 동기부여가 되는 메시지를 포함해주세요

2. 자연스러운 한국어:
   - 딱딱한 통계 나열이 아닌, 대화하듯이 자연스럽게 작성해주세요
   - 전문 용어보다는 일상적인 표현을 사용해주세요
   - 사용자가 이해하기 쉽고 바로 실천할 수 있는 문장으로 구성해주세요

3. 기간별 차별화:
   ${period === "today"
     ? "- 오늘의 요약: 당일 집중도, 남은 시간 활용 방안, 긴급한 할 일 우선순위에 집중"
     : "- 이번 주 요약: 주간 패턴 분석, 트렌드 파악, 다음 주 계획 제안에 집중"}

4. 구체성:
   - 추상적인 조언보다는 구체적인 수치와 예시를 포함해주세요
   - "더 잘하세요"보다는 "이렇게 하면 더 좋습니다" 형식으로 제시해주세요

위 가이드라인을 따라 분석 결과를 작성해주세요.`;

    // Gemini API 호출
    const result = await generateObject({
      model: google("gemini-2.0-flash-exp"),
      schema: TodoAnalysisSchema,
      prompt: systemPrompt,
      temperature: 0.7, // 창의적인 분석을 위해 약간 높은 temperature
    });

    const analysisData = result.object;

    // 응답 데이터 구성
    const responseData = {
      summary: analysisData.summary,
      urgentTasks: analysisData.urgentTasks,
      insights: analysisData.insights,
      recommendations: analysisData.recommendations,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    // 오류 처리
    console.error("AI 할 일 분석 오류:", error);

    let errorMessage = "할 일 분석 중 오류가 발생했습니다.";
    let statusCode = 500;

    if (error && typeof error === "object") {
      const errorObj = error as Record<string, unknown>;

      // 할당량 초과 오류 감지 (429)
      if (
        "message" in errorObj &&
        typeof errorObj.message === "string" &&
        (errorObj.message.includes("quota") ||
          errorObj.message.includes("Quota exceeded") ||
          errorObj.message.includes("exceeded your current quota") ||
          errorObj.message.includes("429") ||
          errorObj.message.includes("rate limit"))
      ) {
        errorMessage =
          "AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.";
        statusCode = 429;
      }
      // 입력 관련 오류 감지 (400)
      else if (
        "message" in errorObj &&
        typeof errorObj.message === "string" &&
        (errorObj.message.includes("invalid") ||
          errorObj.message.includes("validation") ||
          errorObj.message.includes("bad request") ||
          errorObj.message.includes("400"))
      ) {
        errorMessage = "입력값이 올바르지 않습니다. 다시 확인해주세요.";
        statusCode = 400;
      }
      // 기타 오류 메시지가 있는 경우
      else if ("message" in errorObj && typeof errorObj.message === "string") {
        errorMessage = process.env.NODE_ENV === "development"
          ? errorObj.message
          : "할 일 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
