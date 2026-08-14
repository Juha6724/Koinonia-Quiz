"use client";

import { FormEvent, useState } from "react";

import { QuizQuestion } from "@/lib/quiz";

type QuizFormState = {
  id: string | null;
  prompt: string;
  visual: string;
  choices: string[];
  answerIndex: number;
  isActive: boolean;
};

const emptyForm: QuizFormState = {
  id: null,
  prompt: "",
  visual: "",
  choices: ["", "", "", ""],
  answerIndex: 0,
  isActive: true
};

export default function AdminQuizPage() {
  const [pinInput, setPinInput] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [form, setForm] = useState<QuizFormState>(emptyForm);

  async function loadQuizzes(pin: string) {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/quizzes", {
        cache: "no-store",
        headers: {
          "x-admin-pin": pin
        }
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(data?.error ?? "퀴즈를 불러오지 못했습니다.");
        return false;
      }

      if (!data?.configured) {
        setConfigured(false);
        setMessage("Supabase 환경변수가 설정되어야 관리자 퀴즈 편집을 사용할 수 있습니다.");
        return false;
      }

      setConfigured(true);
      setQuizzes(data.quizzes as QuizQuestion[]);
      return true;
    } catch {
      setMessage("퀴즈 API에 연결하지 못했습니다.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPin = pinInput.trim();

    if (!nextPin) {
      setMessage("관리자 PIN을 입력해 주세요.");
      return;
    }

    const ok = await loadQuizzes(nextPin);

    if (ok) {
      setAdminPin(nextPin);
      setIsUnlocked(true);
      setMessage("관리자 모드가 열렸습니다.");
    }
  }

  function updateChoice(index: number, value: string) {
    setForm((current) => ({
      ...current,
      choices: current.choices.map((choice, choiceIndex) =>
        choiceIndex === index ? value : choice
      )
    }));
  }

  function editQuiz(quiz: QuizQuestion) {
    setForm({
      id: quiz.id,
      prompt: quiz.prompt,
      visual: quiz.visual,
      choices: [...quiz.choices],
      answerIndex: quiz.answerIndex,
      isActive: quiz.isActive ?? true
    });
    setMessage("선택한 퀴즈를 수정 중입니다.");
  }

  function resetForm() {
    setForm(emptyForm);
    setMessage("");
  }

  async function saveQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const method = form.id ? "PATCH" : "POST";

    try {
      const response = await fetch("/api/quizzes", {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin
        },
        body: JSON.stringify({
          id: form.id,
          prompt: form.prompt,
          visual: form.visual,
          choices: form.choices,
          answerIndex: form.answerIndex,
          isActive: form.isActive,
          pin: adminPin
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(data?.error ?? "퀴즈 저장에 실패했습니다.");
        return;
      }

      setMessage(form.id ? "퀴즈를 수정했습니다." : "새 퀴즈를 만들었습니다.");
      setForm(emptyForm);
      await loadQuizzes(adminPin);
    } catch {
      setMessage("퀴즈 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteQuiz(id: string) {
    if (!window.confirm("이 퀴즈를 삭제할까요?")) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/quizzes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin
        },
        body: JSON.stringify({ id, pin: adminPin })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(data?.error ?? "퀴즈 삭제에 실패했습니다.");
        return;
      }

      setMessage("퀴즈를 삭제했습니다.");
      await loadQuizzes(adminPin);
      resetForm();
    } catch {
      setMessage("퀴즈 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>퀴즈 관리자</h1>
            <p>관리자 PIN으로 들어와서 실전 게임에 나올 퀴즈를 만들고 수정하세요.</p>
          </div>
          <a href="/" className="admin-home-link">
            메인 게임으로
          </a>
        </header>

        {!isUnlocked ? (
          <form className="admin-login" onSubmit={handleUnlock}>
            <label htmlFor="adminPin">관리자 PIN</label>
            <input
              id="adminPin"
              type="password"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value)}
              placeholder="ADMIN_RESET_PIN 입력"
              autoFocus
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "확인 중..." : "관리자 페이지 열기"}
            </button>
          </form>
        ) : (
          <div className="admin-grid">
            <form className="quiz-editor" onSubmit={saveQuiz}>
              <div className="editor-title">
                <h2>{form.id ? "퀴즈 수정" : "새 퀴즈 만들기"}</h2>
                {form.id && (
                  <button type="button" onClick={resetForm}>
                    새 퀴즈로 전환
                  </button>
                )}
              </div>

              <label>
                문제
                <textarea
                  value={form.prompt}
                  onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                  placeholder="예: 노아가 하나님의 말씀을 따라 만든 것은?"
                  required
                />
              </label>

              <label>
                화면 중앙에 크게 보일 단어/숫자
                <input
                  value={form.visual}
                  onChange={(event) => setForm({ ...form, visual: event.target.value })}
                  placeholder="예: 방주"
                  required
                />
              </label>

              <fieldset>
                <legend>선택지 4개</legend>
                {form.choices.map((choice, index) => (
                  <label key={index}>
                    선택지 {index + 1}
                    <div className="choice-editor-row">
                      <input
                        value={choice}
                        onChange={(event) => updateChoice(index, event.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className={form.answerIndex === index ? "answer-selected" : ""}
                        onClick={() => setForm({ ...form, answerIndex: index })}
                      >
                        정답
                      </button>
                    </div>
                  </label>
                ))}
              </fieldset>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                게임에 사용하기
              </label>

              <button className="admin-primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "저장 중..." : form.id ? "퀴즈 수정 저장" : "퀴즈 생성"}
              </button>
            </form>

            <section className="quiz-list-panel">
              <div className="editor-title">
                <h2>등록된 퀴즈</h2>
                <button type="button" onClick={() => void loadQuizzes(adminPin)}>
                  새로고침
                </button>
              </div>

              {quizzes.length === 0 ? (
                <div className="admin-empty">아직 등록된 퀴즈가 없습니다.</div>
              ) : (
                <ul className="admin-quiz-list">
                  {quizzes.map((quiz) => (
                    <li key={quiz.id}>
                      <div>
                        <span className={quiz.isActive ? "active-label" : "inactive-label"}>
                          {quiz.isActive ? "사용 중" : "숨김"}
                        </span>
                        <strong>{quiz.visual}</strong>
                        <p>{quiz.prompt}</p>
                        <small>
                          정답: {quiz.choices[quiz.answerIndex]} / 선택지{" "}
                          {quiz.choices.join(", ")}
                        </small>
                      </div>
                      <div className="quiz-list-actions">
                        <button type="button" onClick={() => editQuiz(quiz)}>
                          수정
                        </button>
                        <button type="button" onClick={() => void deleteQuiz(quiz.id)}>
                          삭제
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {message && <div className="admin-message">{message}</div>}
        {configured === false && (
          <div className="admin-warning">
            Supabase 연결이 필요합니다. Vercel 환경변수와 `quizzes` 테이블을 확인해 주세요.
          </div>
        )}
      </section>
    </main>
  );
}
