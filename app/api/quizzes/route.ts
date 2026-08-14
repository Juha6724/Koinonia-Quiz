import { NextRequest, NextResponse } from "next/server";

import { quizQuestions, QuizChoiceType, QuizRow, toQuizQuestion } from "@/lib/quiz";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type QuizPayload = {
  prompt: string;
  choices: string[];
  choiceType: QuizChoiceType;
  choiceImages: string[];
  answerIndex: number;
  isActive: boolean;
};

const QUIZ_SELECT =
  "id, prompt, visual, choice_1, choice_2, choice_3, choice_4, choice_type, choice_image_1, choice_image_2, choice_image_3, choice_image_4, answer_index, is_active, created_at, updated_at";

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
  const choiceType: QuizChoiceType = source.choiceType === "image" ? "image" : "text";
  const choices = Array.isArray(source.choices)
    ? source.choices.map((choice) => String(choice ?? "").trim().slice(0, 80))
    : [];
  const choiceImages = Array.isArray(source.choiceImages)
    ? source.choiceImages.map((image) => String(image ?? "").trim())
    : [];
  const answerIndex = Number(source.answerIndex);
  const isActive = typeof source.isActive === "boolean" ? source.isActive : true;

  if (prompt.length < 2 || choices.length !== 4) {
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

  const normalizedChoices = choices.map((choice, index) =>
    choice || `사진 선택지 ${index + 1}`
  );
  const normalizedImages =
    choiceType === "image" ? choiceImages : ["", "", "", ""];

  if (choiceType === "text" && normalizedChoices.some((choice) => !choice)) {
    return null;
  }

  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return null;
  }

  return {
    prompt,
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

  let { data, error } = await query;

  if (error) {
    return jsonError(error.message, 500);
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
