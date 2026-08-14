export type QuizQuestion = {
  id: string;
  prompt: string;
  visual: string;
  choices: string[];
  answerIndex: number;
  isActive?: boolean;
};

export type QuizRow = {
  id: string;
  prompt: string;
  visual: string;
  choice_1: string;
  choice_2: string;
  choice_3: string;
  choice_4: string;
  answer_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const practiceQuestion: QuizQuestion = {
  id: "practice-light",
  prompt: "연습 문제: 화면에 보이는 단어는 무엇일까요?",
  visual: "빛",
  choices: ["빛", "소금", "물", "구름"],
  answerIndex: 0
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: "fruit-spirit-love",
    prompt: "성령의 열매 중 하나로, 가장 먼저 떠오르는 것은?",
    visual: "사랑",
    choices: ["사랑", "시기", "두려움", "분노"],
    answerIndex: 0
  },
  {
    id: "noah-ark",
    prompt: "노아가 하나님의 말씀을 따라 만든 것은?",
    visual: "방주",
    choices: ["성전", "방주", "탑", "우물"],
    answerIndex: 1
  },
  {
    id: "david-instrument",
    prompt: "다윗이 하나님을 찬양할 때 자주 연주한 악기는?",
    visual: "하프",
    choices: ["북", "나팔", "수금", "비파"],
    answerIndex: 2
  },
  {
    id: "jonah-city",
    prompt: "요나가 전하러 가야 했던 도시는?",
    visual: "니느웨",
    choices: ["베들레헴", "여리고", "니느웨", "가나"],
    answerIndex: 2
  },
  {
    id: "ten-commandments",
    prompt: "모세가 하나님께 받은 계명의 개수는?",
    visual: "10",
    choices: ["3개", "7개", "10개", "12개"],
    answerIndex: 2
  },
  {
    id: "jesus-first-miracle",
    prompt: "예수님의 첫 번째 표적으로 알려진 사건은?",
    visual: "가나 혼인잔치",
    choices: ["물을 포도주로", "오병이어", "바다 위 걷기", "나사로 살리기"],
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
    visual: row.visual,
    choices: [row.choice_1, row.choice_2, row.choice_3, row.choice_4],
    answerIndex: row.answer_index,
    isActive: row.is_active
  };
}
