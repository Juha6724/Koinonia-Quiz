export type QuizChoiceType = "text" | "image";

export type QuizQuestion = {
  id: string;
  prompt: string;
  visual?: string | null;
  choices: string[];
  choiceImages?: string[];
  choiceType: QuizChoiceType;
  answerIndex: number;
  isActive?: boolean;
};

export type QuizRow = {
  id: string;
  prompt: string;
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

export const practiceQuestion: QuizQuestion = {
  id: "practice-light",
  prompt: "연습 문제: '빛'을 골라 보세요.",
  choices: ["빛", "소금", "물", "구름"],
  choiceType: "text",
  answerIndex: 0
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: "church-pastor-name",
    prompt: "우리교회 담임목사님 성함은?",
    choices: ["홍길동", "홍갈동", "혼긴돈", "홍길똥"],
    choiceType: "text",
    answerIndex: 0
  },
  {
    id: "church-name",
    prompt: "우리교회 이름은?",
    choices: ["코이노니아교회", "코리아교회", "코너니아교회", "코이노스교회"],
    choiceType: "text",
    answerIndex: 0
  },
  {
    id: "worship-time",
    prompt: "주일 예배가 시작되는 시간은?",
    choices: ["오전 9시", "오전 11시", "오후 1시", "오후 3시"],
    choiceType: "text",
    answerIndex: 1
  },
  {
    id: "church-event-gift",
    prompt: "오늘 스피드퀴즈 1등에게 드리는 것은?",
    choices: ["선물", "숙제", "벌칙", "청소"],
    choiceType: "text",
    answerIndex: 0
  }
];

export function getRandomQuizQuestion(questions = quizQuestions) {
  const source = questions.length > 0 ? questions : quizQuestions;
  const randomIndex = Math.floor(Math.random() * source.length);
  return source[randomIndex];
}

export function toQuizQuestion(row: QuizRow): QuizQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    visual: null,
    choices: [row.choice_1, row.choice_2, row.choice_3, row.choice_4],
    choiceImages: [
      row.choice_image_1 ?? "",
      row.choice_image_2 ?? "",
      row.choice_image_3 ?? "",
      row.choice_image_4 ?? ""
    ],
    choiceType: row.choice_type === "image" ? "image" : "text",
    answerIndex: row.answer_index,
    isActive: row.is_active
  };
}
