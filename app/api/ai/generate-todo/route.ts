import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";

/**
 * AI가 생성할 할 일 데이터 구조 스키마
 */
const TodoGenerateSchema = z.object({
  title: z.string().describe("할 일 제목"),
  description: z.string().nullable().optional().describe("할 일 상세 설명"),
  due_date: z.string().nullable().optional().describe("마감일 (ISO 8601 형식: YYYY-MM-DDTHH:mm:ss 또는 YYYY-MM-DD)"),
  priority: z.enum(["high", "medium", "low"]).nullable().optional().describe("우선순위 (high: 중요/긴급, medium: 보통, low: 낮음)"),
  category: z.array(z.string()).nullable().optional().describe("카테고리 (업무, 개인, 학습 중 하나 이상)"),
});

/**
 * 자연어 입력을 구조화된 할 일 데이터로 변환하는 API 엔드포인트
 * @param request - POST 요청 (body: { input: string })
 * @returns 구조화된 할 일 데이터
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

    const { input } = body;

    // 개발 환경에서 요청 로깅 (디버깅용)
    if (process.env.NODE_ENV === "development") {
      console.log("[AI Generate Todo API] 요청 수신:", {
        timestamp: new Date().toISOString(),
        inputLength: input?.length || 0,
        userAgent: request.headers.get("user-agent"),
      });
    }

    // 입력 검증: 타입 및 존재 여부 확인
    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "입력값은 문자열이어야 합니다." },
        { status: 400 }
      );
    }

    // 전처리: 앞뒤 공백 제거 및 연속된 공백을 하나로 통합
    const trimmedInput = input.trim();
    const normalizedInput = trimmedInput.replace(/\s+/g, " ");

    // 입력 검증: 빈 문자열 체크
    if (normalizedInput.length === 0) {
      return NextResponse.json(
        { error: "할 일을 입력해주세요." },
        { status: 400 }
      );
    }

    // 입력 검증: 최소 길이 체크 (2자)
    if (normalizedInput.length < 2) {
      return NextResponse.json(
        { error: "할 일은 최소 2자 이상 입력해주세요." },
        { status: 400 }
      );
    }

    // 입력 검증: 최대 길이 체크 (500자)
    if (normalizedInput.length > 500) {
      return NextResponse.json(
        { error: "할 일은 최대 500자까지 입력할 수 있습니다. (현재: " + normalizedInput.length + "자)" },
        { status: 400 }
      );
    }

    // 전처리 완료된 입력값 사용
    const processedInput = normalizedInput;

    // 현재 날짜/시간 정보 (한국 시간 기준)
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const currentYear = koreaTime.getFullYear();
    const currentMonth = String(koreaTime.getMonth() + 1).padStart(2, "0");
    const currentDay = String(koreaTime.getDate()).padStart(2, "0");
    const currentDateStr = `${currentYear}-${currentMonth}-${currentDay}`;
    const currentTimeStr = `${String(koreaTime.getHours()).padStart(2, "0")}:${String(koreaTime.getMinutes()).padStart(2, "0")}`;
    const dayOfWeek = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][koreaTime.getDay()];

    // 프롬프트 작성
    const systemPrompt = `당신은 자연어로 입력된 할 일을 구조화된 데이터로 변환하는 AI 어시스턴트입니다.

현재 날짜/시간 정보:
- 오늘: ${currentDateStr} (${dayOfWeek})
- 현재 시간: ${currentTimeStr}

다음 규칙을 반드시 준수하여 자연어 입력을 분석하고 구조화된 JSON 형식의 데이터로 변환하세요:

1. 제목(title):
   - 입력문에서 핵심 할 일 내용을 추출하여 간결한 제목으로 작성
   - 예: "내일 오후 3시까지 중요한 팀 회의 준비하기" → "팀 회의 준비"

2. 설명(description):
   - 원본 입력문을 그대로 사용하거나, 필요시 보완
   - 없으면 null

3. 마감일(due_date) - 다음 날짜 처리 규칙을 반드시 준수:
   - "오늘" → 현재 날짜 (${currentDateStr})
   - "내일" → 현재 날짜 + 1일
   - "모레" → 현재 날짜 + 2일
   - "이번 주 [요일]" (예: "이번 주 금요일") → 가장 가까운 해당 요일
   - "다음 주 [요일]" (예: "다음 주 월요일") → 다음 주의 해당 요일
   - 시간 표현 해석 (시간이 명시되지 않은 경우 "09:00"을 기본값으로 사용):
     * "아침" → 09:00
     * "점심" → 12:00
     * "오후" → 14:00
     * "저녁" → 18:00
     * "밤" → 21:00
     * "오전/오후 N시" → 24시간 형식으로 변환 (오전: 00-11, 오후: 12-23)
     * "N시", "N:MM" → 그대로 사용
   - 형식: "YYYY-MM-DDTHH:mm:ss" (시간 포함) 또는 "YYYY-MM-DD" (시간 없으면 날짜만)

4. 우선순위(priority) - 다음 키워드를 반드시 참고:
   - "high": "급하게", "중요한", "빨리", "꼭", "반드시" 등의 키워드가 포함된 경우
   - "medium": "보통", "적당히" 등의 키워드가 포함되거나 키워드가 없는 경우
   - "low": "여유롭게", "천천히", "언젠가" 등의 키워드가 포함된 경우

5. 카테고리(category) - 다음 키워드를 반드시 참고:
   - "업무": "회의", "보고서", "프로젝트", "업무" 등의 키워드가 포함된 경우
   - "개인": "쇼핑", "친구", "가족", "개인" 등의 키워드가 포함된 경우
   - "건강": "운동", "병원", "건강", "요가" 등의 키워드가 포함된 경우
   - "학습": "공부", "책", "강의", "학습" 등의 키워드가 포함된 경우
   - 여러 카테고리에 해당하면 배열에 여러 개 포함

6. 출력 형식:
   - 반드시 JSON 형식을 준수하여 응답
   - 모든 필드는 스키마에 정의된 형식으로 반환

입력된 자연어: "${processedInput}"

위 규칙을 정확히 준수하여 구조화된 JSON 데이터를 생성하세요.`;

    // Gemini API 호출
    const result = await generateObject({
      model: google("gemini-2.0-flash-exp"),
      schema: TodoGenerateSchema,
      prompt: systemPrompt,
      temperature: 0.3, // 일관성을 위해 낮은 temperature 사용
    });

    const generatedData = result.object;

    // 후처리: 제목 자동 조정
    let title = generatedData.title || processedInput.slice(0, 100); // 기본값: 입력값의 처음 100자
    title = title.trim();
    
    // 제목이 너무 짧은 경우 (2자 미만)
    if (title.length < 2) {
      title = processedInput.slice(0, 50).trim() || "할 일";
    }
    
    // 제목이 너무 긴 경우 (200자 초과) 자동 자르기
    if (title.length > 200) {
      title = title.slice(0, 197) + "...";
    }

    // 후처리: due_date 처리 및 과거 날짜 확인
    let dueDateFormatted: string | null = null;
    if (generatedData.due_date) {
      // ISO 형식인지 확인
      const dateMatch = generatedData.due_date.match(/^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2})?/);
      if (dateMatch) {
        const dateOnly = dateMatch[1];
        const timePart = dateMatch[2];
        
        // 날짜 파싱
        const dueDate = new Date(dateOnly + (timePart || "T09:00:00"));
        const currentDate = new Date(koreaTime);
        currentDate.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        // 과거 날짜인지 확인 (하루 전까지는 허용, 그 이전은 null로 설정)
        const daysDiff = Math.floor((dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < -1) {
          // 과거 날짜(2일 전 이전)인 경우 null로 설정
          dueDateFormatted = null;
        } else {
          // 정상적인 날짜인 경우
          if (timePart) {
            dueDateFormatted = generatedData.due_date;
          } else {
            // 시간이 없는 경우 기본값 09:00 추가
            dueDateFormatted = `${dateOnly}T09:00:00`;
          }
        }
      } else {
        // 형식이 맞지 않으면 null
        dueDateFormatted = null;
      }
    }

    // 후처리: 필수 필드 기본값 설정
    const responseData = {
      title: title,
      description: generatedData.description?.trim() || null,
      due_date: dueDateFormatted,
      priority: generatedData.priority || "medium", // 기본값: medium
      category: (generatedData.category && generatedData.category.length > 0) 
        ? generatedData.category 
        : ["개인"], // 기본값: 개인
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    // 오류 처리
    console.error("AI 할 일 생성 오류:", error);

    let errorMessage = "할 일 생성 중 오류가 발생했습니다.";
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
          "AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요. API 할당량은 Google AI Studio에서 확인할 수 있습니다.";
        statusCode = 429; // Too Many Requests
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
        statusCode = 400; // Bad Request
      }
      // 인증/권한 오류 (401)
      else if (
        "message" in errorObj &&
        typeof errorObj.message === "string" &&
        (errorObj.message.includes("unauthorized") ||
          errorObj.message.includes("authentication") ||
          errorObj.message.includes("API key") ||
          errorObj.message.includes("401"))
      ) {
        errorMessage = "API 인증에 실패했습니다. API 키 설정을 확인해주세요.";
        statusCode = 500; // 내부 서버 오류로 처리 (API 키 설정 문제)
      }
      // 기타 오류 메시지가 있는 경우
      else if ("message" in errorObj && typeof errorObj.message === "string") {
        // 개발 환경에서는 상세한 오류 메시지, 프로덕션에서는 일반 메시지
        errorMessage = process.env.NODE_ENV === "development"
          ? errorObj.message
          : "할 일 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
