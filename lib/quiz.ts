export type QuizChoiceType = "text" | "image";
export type QuizPromptType = "text" | "image";
export type QuizFormat = "text-text" | "text-image" | "image-text";

export type QuizQuestion = {
  id: string;
  prompt: string;
  promptType: QuizPromptType;
  promptImage?: string | null;
  visual?: string | null;
  choices: string[];
  choiceImages?: string[];
  choiceType: QuizChoiceType;
  answerIndex: number;
  answerIndexes?: number[];
  isActive?: boolean;
  createdAt?: string;
};

export type QuizRow = {
  id: string;
  prompt: string;
  prompt_type?: QuizPromptType | null;
  prompt_image?: string | null;
  visual: string | null;
  choice_1: string;
  choice_2: string;
  choice_3: string;
  choice_4: string;
  choice_type?: QuizChoiceType | null;
  choice_image_1?: string | null;
  choice_image_2?: string | null;
  choice_image_3?: string | null;
  choice_image_4?: string | null;
  answer_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function normalizeAnswerIndexes(value: unknown, fallback = 0) {
  const source = Array.isArray(value) ? value : [value];
  const indexes = [
    ...new Set(
      source
        .map((item) => Number(item))
        .filter((index) => Number.isInteger(index) && index >= 0 && index <= 3)
    )
  ].sort((left, right) => left - right);

  return indexes.length > 0 ? indexes : [fallback];
}

export function getAnswerIndexes(
  question: Pick<QuizQuestion, "answerIndex" | "answerIndexes">
) {
  return normalizeAnswerIndexes(question.answerIndexes, question.answerIndex);
}

export function isCorrectChoice(
  question: Pick<QuizQuestion, "answerIndex" | "answerIndexes">,
  choiceIndex: number
) {
  return getAnswerIndexes(question).includes(choiceIndex);
}

export function parseStoredAnswerIndexes(visual: string | null | undefined, answerIndex: number) {
  if (visual && visual.startsWith("A:")) {
    return normalizeAnswerIndexes(
      visual
        .slice(2)
        .split(",")
        .map((item) => Number(item.trim())),
      answerIndex
    );
  }

  return normalizeAnswerIndexes(answerIndex);
}

export function storedAnswerVisual(answerIndexes: number[]) {
  const indexes = normalizeAnswerIndexes(answerIndexes);
  return indexes.length > 1 ? `A:${indexes.join(",")}` : null;
}

export function getQuizFormat(question: Pick<QuizQuestion, "promptType" | "choiceType">): QuizFormat {
  if (question.promptType === "image" && question.choiceType === "text") {
    return "image-text";
  }

  if (question.promptType === "text" && question.choiceType === "image") {
    return "text-image";
  }

  return "text-text";
}

export function getQuizFormatLabel(format: QuizFormat) {
  switch (format) {
    case "text-image":
      return "글자 문제 · 사진 선택지";
    case "image-text":
      return "사진 문제 · 글자 선택지";
    default:
      return "글자 문제 · 글자 선택지";
  }
}

export function formatToTypes(format: QuizFormat): {
  promptType: QuizPromptType;
  choiceType: QuizChoiceType;
} {
  switch (format) {
    case "text-image":
      return { promptType: "text", choiceType: "image" };
    case "image-text":
      return { promptType: "image", choiceType: "text" };
    default:
      return { promptType: "text", choiceType: "text" };
  }
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: "church-pastor-name",
    prompt: "우리교회 담임목사님 성함은?",
    promptType: "text",
    choices: ["홍길동", "홍갈동", "혼긴돈", "홍길똥"],
    choiceType: "text",
    answerIndex: 0
  },
  {
    id: "church-name",
    prompt: "우리교회 이름은?",
    promptType: "text",
    choices: ["코이노니아교회", "코리아교회", "코너니아교회", "코이노스교회"],
    choiceType: "text",
    answerIndex: 0
  },
  {
    id: "worship-time",
    prompt: "주일 예배가 시작되는 시간은?",
    promptType: "text",
    choices: ["오전 9시", "오전 11시", "오후 1시", "오후 3시"],
    choiceType: "text",
    answerIndex: 1
  },
  {
    id: "church-event-gift",
    prompt: "오늘 스피드퀴즈 1등에게 드리는 것은?",
    promptType: "text",
    choices: ["선물", "숙제", "벌칙", "청소"],
    choiceType: "text",
    answerIndex: 0
  }
];

export function isTemplateQuiz(question: QuizQuestion) {
  const templateIds = new Set(quizQuestions.map((template) => template.id));

  if (templateIds.has(question.id)) {
    return true;
  }

  return quizQuestions.some(
    (template) =>
      template.prompt === question.prompt &&
      template.choiceType === question.choiceType &&
      template.choices.length === question.choices.length &&
      template.choices.every((choice, index) => choice === question.choices[index])
  );
}

export function splitQuizPool(questions: QuizQuestion[] = []) {
  const source = questions.filter((question) => !isTemplateQuiz(question));

  if (source.length === 0) {
    return {
      practiceQuestion: null as QuizQuestion | null,
      realQuestions: [] as QuizQuestion[]
    };
  }

  const indexed = source.map((question, index) => ({ question, index }));

  indexed.sort((left, right) => {
    const leftTime = left.question.createdAt ?? "";
    const rightTime = right.question.createdAt ?? "";

    if (leftTime && rightTime && leftTime !== rightTime) {
      return leftTime.localeCompare(rightTime);
    }

    return left.index - right.index;
  });

  const practiceQuestion = indexed[0].question;
  const realQuestions = source.filter((question) => question.id !== practiceQuestion.id);

  return {
    practiceQuestion,
    realQuestions
  };
}

export function shuffleIds(ids: string[]) {
  const shuffled = [...ids];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function createShuffledQueue(questions: QuizQuestion[], lastId?: string | null) {
  let ids = shuffleIds(questions.map((question) => question.id));

  if (ids.length > 1 && lastId && ids[0] === lastId) {
    ids = [...ids.slice(1), ids[0]];
  }

  return ids;
}

export function toQuizQuestion(row: QuizRow): QuizQuestion {
  const answerIndexes = parseStoredAnswerIndexes(row.visual, row.answer_index);

  return {
    id: row.id,
    prompt: row.prompt,
    promptType: row.prompt_type === "image" ? "image" : "text",
    promptImage: row.prompt_image ?? null,
    visual: null,
    choices: [row.choice_1, row.choice_2, row.choice_3, row.choice_4],
    choiceImages: [
      row.choice_image_1 ?? "",
      row.choice_image_2 ?? "",
      row.choice_image_3 ?? "",
      row.choice_image_4 ?? ""
    ],
    choiceType: row.choice_type === "image" ? "image" : "text",
    answerIndex: answerIndexes[0],
    answerIndexes,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}
