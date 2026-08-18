"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useState } from "react";

import {
  formatToTypes,
  getQuizFormat,
  getQuizFormatLabel,
  QuizChoiceType,
  QuizFormat,
  QuizPromptType,
  QuizQuestion
} from "@/lib/quiz";

type QuizFormState = {
  id: string | null;
  prompt: string;
  promptType: QuizPromptType;
  promptImage: string;
  choices: string[];
  choiceType: QuizChoiceType;
  choiceImages: string[];
  answerIndex: number;
  isActive: boolean;
};

const emptyForm: QuizFormState = {
  id: null,
  prompt: "",
  promptType: "text",
  promptImage: "",
  choices: ["", "", "", ""],
  choiceType: "text",
  choiceImages: ["", "", "", ""],
  answerIndex: 0,
  isActive: true
};

const QUIZ_FORMAT_OPTIONS: Array<{
  format: QuizFormat;
  title: string;
  description: string;
}> = [
  {
    format: "text-text",
    title: "글자 문제",
    description: "글자 선택지 4개"
  },
  {
    format: "text-image",
    title: "글자 문제",
    description: "사진 선택지 4개"
  },
  {
    format: "image-text",
    title: "사진 문제",
    description: "글자 선택지 4개"
  }
];

function isPlaceholderChoice(value: string) {
  return /^사진 선택지 \d+$/.test(value) || /^선택지 \d+$/.test(value);
}

function readFileAsImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file: File) {
  const image = await readFileAsImage(file);
  const maxSize = 900;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지를 처리할 수 없습니다.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.78);
}

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

  const currentFormat = getQuizFormat(form);

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

  async function updateChoiceImage(index: number, file: File | undefined) {
    if (!file) {
      return;
    }

    setMessage("사진을 압축하고 있습니다.");

    try {
      const imageDataUrl = await compressImageFile(file);
      setForm((current) => ({
        ...current,
        choiceImages: current.choiceImages.map((image, imageIndex) =>
          imageIndex === index ? imageDataUrl : image
        )
      }));
      setMessage("사진을 불러왔습니다.");
    } catch {
      setMessage("사진을 불러오지 못했습니다. 다른 이미지를 선택해 주세요.");
    }
  }

  async function updatePromptImage(file: File | undefined) {
    if (!file) {
      return;
    }

    setMessage("문제 사진을 압축하고 있습니다.");

    try {
      const imageDataUrl = await compressImageFile(file);
      setForm((current) => ({
        ...current,
        promptImage: imageDataUrl
      }));
      setMessage("문제 사진을 불러왔습니다.");
    } catch {
      setMessage("문제 사진을 불러오지 못했습니다. 다른 이미지를 선택해 주세요.");
    }
  }

  function updateQuizFormat(format: QuizFormat) {
    const { promptType, choiceType } = formatToTypes(format);

    setForm((current) => ({
      ...current,
      promptType,
      choiceType,
      promptImage: promptType === "text" ? "" : current.promptImage,
      choiceImages:
        choiceType === "text" ? ["", "", "", ""] : current.choiceImages,
      choices:
        choiceType === "text"
          ? current.choices.map((choice) => (isPlaceholderChoice(choice) ? "" : choice))
          : current.choices.map((choice, index) => choice || `선택지 ${index + 1}`)
    }));
  }

  function editQuiz(quiz: QuizQuestion) {
    setForm({
      id: quiz.id,
      prompt: quiz.prompt,
      promptType: quiz.promptType ?? "text",
      promptImage: quiz.promptImage ?? "",
      choices: quiz.choices.map((choice) =>
        quiz.choiceType === "text" && isPlaceholderChoice(choice) ? "" : choice
      ),
      choiceType: quiz.choiceType,
      choiceImages: quiz.choiceImages ?? ["", "", "", ""],
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
          promptType: form.promptType,
          promptImage: form.promptImage,
          choices: form.choices,
          choiceType: form.choiceType,
          choiceImages: form.choiceImages,
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
          <Link href="/" className="admin-home-link">
            메인 게임으로
          </Link>
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

              <fieldset className="quiz-format-fieldset">
                <legend>문제 형식</legend>
                <div className="quiz-format-grid">
                  {QUIZ_FORMAT_OPTIONS.map((option) => (
                    <button
                      key={option.format}
                      type="button"
                      className={`quiz-format-card quiz-format-${option.format} ${
                        currentFormat === option.format ? "quiz-format-card-active" : ""
                      }`}
                      onClick={() => updateQuizFormat(option.format)}
                    >
                      <span className="quiz-format-card-tag">{option.title}</span>
                      <strong className="quiz-format-card-title">{option.description}</strong>
                      <span className="quiz-format-card-caption">
                        {getQuizFormatLabel(option.format)}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {form.promptType === "text" ? (
                <label>
                  문제 문장
                  <textarea
                    value={form.prompt}
                    onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                    placeholder="예: 우리교회 목사님 성함은?"
                    required
                  />
                </label>
              ) : (
                <div className="prompt-image-editor">
                  <label>
                    문제 사진 설명 (선택)
                    <input
                      value={form.prompt}
                      onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                      placeholder="예: 교회 로고"
                    />
                  </label>
                  <label>
                    문제 사진
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void updatePromptImage(event.target.files?.[0])}
                      required={!form.promptImage}
                    />
                  </label>
                  {form.promptImage && (
                    <img
                      src={form.promptImage}
                      alt={form.prompt || "문제 사진 미리보기"}
                      className="admin-prompt-preview"
                    />
                  )}
                </div>
              )}

              <fieldset>
                <legend>{form.choiceType === "image" ? "사진 선택지 4개" : "글자 선택지 4개"}</legend>
                {form.choices.map((choice, index) => (
                  <label key={index}>
                    선택지 {index + 1}
                    <div
                      className={
                        form.choiceType === "image"
                          ? "choice-editor-row image-choice-editor-row"
                          : "choice-editor-row"
                      }
                    >
                      {form.choiceType === "text" ? (
                        <input
                          value={choice}
                          onChange={(event) => updateChoice(index, event.target.value)}
                          placeholder={`선택지 ${index + 1}`}
                          required
                        />
                      ) : (
                        <div className="image-choice-fields">
                          <input
                            value={isPlaceholderChoice(choice) ? "" : choice}
                            onChange={(event) => updateChoice(index, event.target.value)}
                            placeholder={`사진 설명 ${index + 1}`}
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              void updateChoiceImage(index, event.target.files?.[0])
                            }
                            required={!form.choiceImages[index]}
                          />
                          {form.choiceImages[index] && (
                            <img
                              src={form.choiceImages[index]}
                              alt={choice || `선택지 ${index + 1} 미리보기`}
                              className="admin-choice-preview"
                            />
                          )}
                        </div>
                      )}
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
                        <strong>{getQuizFormatLabel(getQuizFormat(quiz))}</strong>
                        {quiz.promptType === "image" && quiz.promptImage ? (
                          <img
                            src={quiz.promptImage}
                            alt={quiz.prompt || "문제 사진"}
                            className="admin-prompt-preview admin-prompt-preview-list"
                          />
                        ) : (
                          <p>{quiz.prompt}</p>
                        )}
                        <small>
                          정답: {quiz.choices[quiz.answerIndex]}
                          {quiz.choiceType === "text" ? ` / ${quiz.choices.join(", ")}` : ""}
                        </small>
                        {quiz.choiceType === "image" && (
                          <div className="admin-list-images">
                            {(quiz.choiceImages ?? []).map((image, index) =>
                              image ? (
                                <img
                                  key={index}
                                  src={image}
                                  alt={quiz.choices[index] || `선택지 ${index + 1}`}
                                />
                              ) : null
                            )}
                          </div>
                        )}
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
