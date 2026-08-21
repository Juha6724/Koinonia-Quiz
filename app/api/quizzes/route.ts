import { NextRequest, NextResponse } from "next/server";

import {
  fetchQuizRows,
  isMissingPromptTypeColumnError,
  MIGRATION_HINT,
  QUIZ_SELECT,
  QUIZ_SELECT_LEGACY,
  toQuizRowInsert,
  toQuizRowInsertFromDefault
} from "@/lib/quizDb";
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

  const normalizedPrompt = promptType === "image" ? prompt || "문제 사진" : prompt;
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

async function insertQuizRow(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  payload: QuizPayload,
  usesLegacySchema: boolean
) {
  if (usesLegacySchema && payload.promptType === "image") {
    return {
      data: null,
      error: {
        message: `사진 문제 형식을 쓰려면 DB 마이그레이션이 필요합니다. ${MIGRATION_HINT}`
      }
    };
  }

  const select = usesLegacySchema ? QUIZ_SELECT_LEGACY : QUIZ_SELECT;

  return supabase
    .from("quizzes")
    .insert(toQuizRowInsert(payload, !usesLegacySchema))
    .select(select)
    .single();
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

  let { rows, usesLegacySchema, error } = await fetchQuizRows(supabase, isAdmin);

  if (error) {
    return jsonError(error, 500);
  }

  if (isAdmin && rows.length === 0) {
    const insertPayload = quizQuestions.map((question) =>
      toQuizRowInsertFromDefault(question, !usesLegacySchema)
    );
    const seeded = usesLegacySchema
      ? await supabase
          .from("quizzes")
          .insert(insertPayload)
          .select(QUIZ_SELECT_LEGACY)
          .order("created_at", { ascending: false })
      : await supabase
          .from("quizzes")
          .insert(insertPayload)
          .select(QUIZ_SELECT)
          .order("created_at", { ascending: false });

    if (seeded.error) {
      if (!usesLegacySchema && isMissingPromptTypeColumnError(seeded.error.message)) {
        const legacySeeded = await supabase
          .from("quizzes")
          .insert(quizQuestions.map((question) => toQuizRowInsertFromDefault(question, false)))
          .select(QUIZ_SELECT_LEGACY)
          .order("created_at", { ascending: false });

        if (legacySeeded.error) {
          return jsonError(legacySeeded.error.message, 500);
        }

        rows = (legacySeeded.data ?? []) as QuizRow[];
        usesLegacySchema = true;
      } else {
        return jsonError(seeded.error.message, 500);
      }
    } else {
      rows = (seeded.data ?? []) as QuizRow[];
    }
  }

  return NextResponse.json({
    configured: true,
    schemaNeedsMigration: usesLegacySchema,
    migrationHint: usesLegacySchema ? MIGRATION_HINT : null,
    quizzes: rows.map(toQuizQuestion)
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

  const { usesLegacySchema } = await fetchQuizRows(supabase, true);
  const { data, error } = await insertQuizRow(supabase, payload, usesLegacySchema);

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

  const { usesLegacySchema } = await fetchQuizRows(supabase, true);

  if (usesLegacySchema && payload.promptType === "image") {
    return jsonError(`사진 문제 형식을 쓰려면 DB 마이그레이션이 필요합니다. ${MIGRATION_HINT}`, 500);
  }

  const select = usesLegacySchema ? QUIZ_SELECT_LEGACY : QUIZ_SELECT;
  const { data, error } = await supabase
    .from("quizzes")
    .update(toQuizRowInsert(payload, !usesLegacySchema))
    .eq("id", id)
    .select(select)
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
