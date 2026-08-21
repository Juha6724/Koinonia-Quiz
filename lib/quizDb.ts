import type { SupabaseClient } from "@supabase/supabase-js";

import { QuizRow } from "@/lib/quiz";

export const QUIZ_SELECT =
  "id, prompt, prompt_type, prompt_image, visual, choice_1, choice_2, choice_3, choice_4, choice_type, choice_image_1, choice_image_2, choice_image_3, choice_image_4, answer_index, is_active, created_at, updated_at";

export const QUIZ_SELECT_LEGACY =
  "id, prompt, visual, choice_1, choice_2, choice_3, choice_4, choice_type, choice_image_1, choice_image_2, choice_image_3, choice_image_4, answer_index, is_active, created_at, updated_at";

export const MIGRATION_HINT =
  "Supabase SQL Editor에서 supabase/migrations/20260818_add_prompt_type.sql 내용을 실행해 주세요.";

type QuizInsertPayload = {
  prompt: string;
  promptType: "text" | "image";
  promptImage: string;
  choices: string[];
  choiceType: "text" | "image";
  choiceImages: string[];
  answerIndex: number;
  isActive: boolean;
};

export function isMissingPromptTypeColumnError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("prompt_type") && lower.includes("does not exist");
}

export function toQuizRowInsert(payload: QuizInsertPayload, includePromptColumns: boolean) {
  const row: Record<string, unknown> = {
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

  if (includePromptColumns) {
    row.prompt_type = payload.promptType;
    row.prompt_image = payload.promptType === "image" ? payload.promptImage : null;
  }

  return row;
}

export async function fetchQuizRows(
  supabase: SupabaseClient,
  isAdmin: boolean
): Promise<{
  rows: QuizRow[];
  usesLegacySchema: boolean;
  error: string | null;
}> {
  const runQuery = async (select: string) => {
    let query = supabase.from("quizzes").select(select).order("created_at", {
      ascending: false
    });

    if (!isAdmin) {
      query = query.eq("is_active", true);
    }

    return query;
  };

  const toRows = (data: unknown): QuizRow[] =>
    Array.isArray(data) ? (data as QuizRow[]) : [];

  const modern = await runQuery(QUIZ_SELECT);

  if (!modern.error) {
    return {
      rows: toRows(modern.data),
      usesLegacySchema: false,
      error: null
    };
  }

  if (!isMissingPromptTypeColumnError(modern.error.message)) {
    return {
      rows: [],
      usesLegacySchema: false,
      error: modern.error.message
    };
  }

  const legacy = await runQuery(QUIZ_SELECT_LEGACY);

  if (legacy.error) {
    return {
      rows: [],
      usesLegacySchema: true,
      error: legacy.error.message
    };
  }

  return {
    rows: toRows(legacy.data),
    usesLegacySchema: true,
    error: null
  };
}
