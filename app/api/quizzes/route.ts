import { NextRequest, NextResponse } from "next/server";

import { quizQuestions, QuizChoiceType, QuizPromptType, QuizRow, toQuizQuestion } from "@/lib/quiz";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type QuizPayload = {
  prompt: string;
  promptType: QuizPromptType;
  promptImage: string;
  choices: string[];
  choiceType: QuizChoiceType;
  choiceImages: string[];
  answerIndex: number;
  isActive: boolean;
};

const QUIZ_SELECT =
  "id, prompt, prompt_type, prompt_image, visual, choice_1, choice_2, choice_3, choice_4, choice_type, choice_image_1, choice_image_2, choice_image_3, choice_image_4, answer_index, is_active, created_at, updated_at";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isAdminRequest(request: NextRequest, body?: unknown) {
  const adminPin = process.env.ADMIN_RESET_PIN;
  const bodyPin =
    body && typeof body === "object" && "pin" in body ? String(body.pin ?? "") : "";
  const requestPin = request.headers.get("x-admin-pin") ?? bodyPin;

  return Boolean(adminPin && requestPin === adminPin);
}

function readPayload(body: unknown): QuizPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const source = body as Record<string, unknown>;
  const prompt = String(source.prompt ?? "").trim().slice(0, 180);
  const promptType: QuizPromptType = source.promptType === "image" ? "image" : "text";
  const promptImage = String(source.promptImage ?? "").trim();
  const choiceType: QuizChoiceType = source.choiceType === "image" ? "image" : "text";
  const choices = Array.isArray(source.choices)
    ? source.choices.map((choice) => String(choice ?? "").trim().slice(0, 80))
    : [];
  const choiceImages = Array.isArray(source.choiceImages)
    ? source.choiceImages.map((image) => String(image ?? "").trim())
    : [];
  const answerIndex = Number(source.answerIndex);
  const isActive = typeof source.isActive === "boolean" ? source.isActive : true;

  if (choices.length !== 4) {
    return null;
  }

  if (promptType === "text" && prompt.length < 2) {
    return null;
  }

  if (promptType === "image" && !promptImage) {
    return null;
  }

  if (choiceType === "text" && choices.some((choice) => !choice)) {
    return null;
  }

  if (choiceType === "image") {
    if (choiceImages.length !== 4 || choiceImages.some((image) => !image)) {
      return null;
    }
  }

  const normalizedPrompt =
    promptType === "image" ? prompt || "문제 사진" : prompt;
  const normalizedChoices = choices.map((choice, index) =>
    choiceType === "image" ? choice || `선택지 ${index + 1}` : choice
  );
  const normalizedImages = choiceType === "image" ? choiceImages : ["", "", "", ""];

  if (choiceType === "text" && normalizedChoices.some((choice) => !choice)) {
    return null;
  }

  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return null;
  }

  return {
    prompt: normalizedPrompt,
    promptType,
    promptImage: promptType === "image" ? promptImage : "",
    choices: normalizedChoices,
    choiceType,
    choiceImages: normalizedImages,
    answerIndex,
    isActive
  };
}

function toQuizInsert(payload: QuizPayload) {
  return {
    prompt: payload.prompt,
    prompt_type: payload.promptType,
    prompt_image: payload.promptType === "image" ? payload.promptImage : null,
    visual: null,
    choice_1: payload.choices[0],
    choice_2: payload.choices[1],
    choice_3: payload.choices[2],
    choice_4: payload.choices[3],
    choice_type: payload.choiceType,
    choice_image_1: payload.choiceImages[0] || null,
    choice_image_2: payload.choiceImages[1] || null,
    choice_image_3: payload.choiceImages[2] || null,
    choice_image_4: payload.choiceImages[3] || null,
    answer_index: payload.answerIndex,
    is_active: payload.isActive
  };
}

function toQuizInsertFromDefault(question: (typeof quizQuestions)[number]) {
  return {
    prompt: question.prompt,
    prompt_type: question.promptType ?? "text",
    prompt_image: question.promptImage ?? null,
    visual: null,
    choice_1: question.choices[0],
    choice_2: question.choices[1],
    choice_3: question.choices[2],
    choice_4: question.choices[3],
    choice_type: question.choiceType,
    choice_image_1: question.choiceImages?.[0] || null,
    choice_image_2: question.choiceImages?.[1] || null,
    choice_image_3: question.choiceImages?.[2] || null,
    choice_image_4: question.choiceImages?.[3] || null,
    answer_index: question.answerIndex,
    is_active: true
  };
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      quizzes: quizQuestions
    });
  }

  const isAdmin = isAdminRequest(request);
  const adminPinWasSupplied = request.headers.has("x-admin-pin");

  if (adminPinWasSupplied && !isAdmin) {
    return jsonError("관리자 PIN이 올바르지 않습니다.", 401);
  }

  let query = supabase.from("quizzes").select(QUIZ_SELECT).order("created_at", {
    ascending: false
  });

  if (!isAdmin) {
    query = query.eq("is_active", true);
  }

  const result = await query;
  let data = result.data ?? [];

  if (result.error) {
    return jsonError(result.error.message, 500);
  }

  if (isAdmin && data.length === 0) {
    const seeded = await supabase
      .from("quizzes")
      .insert(quizQuestions.map(toQuizInsertFromDefault))
      .select(QUIZ_SELECT)
      .order("created_at", { ascending: false });

    if (seeded.error) {
      return jsonError(seeded.error.message, 500);
    }

    data = seeded.data;
  }

  return NextResponse.json({
    configured: true,
    quizzes: (data as QuizRow[]).map(toQuizQuestion)
  });
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  const body = await request.json().catch(() => null);

  if (!isAdminRequest(request, body)) {
    return jsonError("관리자 PIN이 올바르지 않습니다.", 401);
  }

  const payload = readPayload(body);

  if (!payload) {
    return jsonError("퀴즈 내용을 모두 올바르게 입력해 주세요.", 400);
  }

  const { data, error } = await supabase
    .from("quizzes")
    .insert(toQuizInsert(payload))
    .select(QUIZ_SELECT)
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    configured: true,
    quiz: toQuizQuestion(data as QuizRow)
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  const body = await request.json().catch(() => null);

  if (!isAdminRequest(request, body)) {
    return jsonError("관리자 PIN이 올바르지 않습니다.", 401);
  }

  const id =
    body && typeof body === "object" && "id" in body ? String(body.id ?? "").trim() : "";
  const payload = readPayload(body);

  if (!id || !payload) {
    return jsonError("수정할 퀴즈 정보가 올바르지 않습니다.", 400);
  }

  const { data, error } = await supabase
    .from("quizzes")
    .update(toQuizInsert(payload))
    .eq("id", id)
    .select(QUIZ_SELECT)
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    configured: true,
    quiz: toQuizQuestion(data as QuizRow)
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  const body = await request.json().catch(() => null);

  if (!isAdminRequest(request, body)) {
    return jsonError("관리자 PIN이 올바르지 않습니다.", 401);
  }

  const id =
    body && typeof body === "object" && "id" in body ? String(body.id ?? "").trim() : "";

  if (!id) {
    return jsonError("삭제할 퀴즈를 선택해 주세요.", 400);
  }

  const { error } = await supabase.from("quizzes").delete().eq("id", id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ configured: true, ok: true });
}
