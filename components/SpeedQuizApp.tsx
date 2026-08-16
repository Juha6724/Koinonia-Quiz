"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatElapsed, getKstDayKey } from "@/lib/day";
import {
  getRandomQuizQuestion,
  practiceQuestion,
  QuizQuestion,
  quizQuestions
} from "@/lib/quiz";
import { Ranking, sortRankings } from "@/lib/rankings";

type Phase = "intro" | "ready" | "quiz" | "practiceDone" | "ranking";
type ResultState = "idle" | "correct" | "wrong" | "practice";
type StorageMode = "checking" | "supabase" | "local";

const AUTO_RETURN_SECONDS = 10;

function rankingsStorageKey() {
  return `koinonia-quiz-rankings-${getKstDayKey()}`;
}

function readLocalRankings() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(rankingsStorageKey());
    return stored ? sortRankings(JSON.parse(stored) as Ranking[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRankings(rankings: Ranking[]) {
  window.localStorage.setItem(rankingsStorageKey(), JSON.stringify(sortRankings(rankings)));
}

function createLocalRanking(playerName: string, elapsedMs: number, quizId: string): Ranking {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    playerName,
    elapsedMs: Math.round(elapsedMs),
    quizId,
    createdAt: new Date().toISOString()
  };
}

export default function SpeedQuizApp() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [playerName, setPlayerName] = useState("");
  const [question, setQuestion] = useState<QuizQuestion>(practiceQuestion);
  const [isPracticeRound, setIsPracticeRound] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [quizPool, setQuizPool] = useState<QuizQuestion[]>(quizQuestions);
  const [storageMode, setStorageMode] = useState<StorageMode>("checking");
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [lastRankingId, setLastRankingId] = useState<string | null>(null);
  const [autoReturnLeft, setAutoReturnLeft] = useState(AUTO_RETURN_SECONDS);
  const [isSaving, setIsSaving] = useState(false);
  const hasAnsweredRef = useRef(false);

  const cleanName = playerName.trim();
  const topRanking = rankings[0];
  const myRank = useMemo(() => {
    if (!lastRankingId) {
      return null;
    }

    const index = rankings.findIndex((ranking) => ranking.id === lastRankingId);
    return index >= 0 ? index + 1 : null;
  }, [lastRankingId, rankings]);

  const loadRankings = useCallback(async () => {
    try {
      const response = await fetch("/api/rankings", { cache: "no-store" });
      const data = await response.json();

      if (response.ok && data.configured) {
        const nextRankings = sortRankings(data.rankings as Ranking[]);
        setStorageMode("supabase");
        setRankings(nextRankings);
        return nextRankings;
      }
    } catch {
      // The kiosk can keep running locally when Supabase is not configured yet.
    }

    const localRankings = readLocalRankings();
    setStorageMode("local");
    setRankings(localRankings);
    return localRankings;
  }, []);

  const loadQuizQuestions = useCallback(async () => {
    try {
      const response = await fetch("/api/quizzes", { cache: "no-store" });
      const data = await response.json();

      if (response.ok && Array.isArray(data.quizzes) && data.quizzes.length > 0) {
        setQuizPool(data.quizzes as QuizQuestion[]);
        return;
      }
    } catch {
      // Keep the built-in quiz set when Supabase quizzes are unavailable.
    }

    setQuizPool(quizQuestions);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRankings();
      void loadQuizQuestions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadQuizQuestions, loadRankings]);

  useEffect(() => {
    if (phase !== "ranking") {
      return;
    }

    const interval = window.setInterval(() => {
      setAutoReturnLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    const timeout = window.setTimeout(() => {
      resetToIntro();
    }, AUTO_RETURN_SECONDS * 1000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [phase]);

  function showRankingAfterDelay() {
    window.setTimeout(() => {
      setAutoReturnLeft(AUTO_RETURN_SECONDS);
      setPhase("ranking");
    }, 650);
  }

  function resetToIntro() {
    setPhase("intro");
    setPlayerName("");
    setQuestion(practiceQuestion);
    setIsPracticeRound(true);
    setSelectedIndex(null);
    setElapsedMs(null);
    setResultState("idle");
    setLastRankingId(null);
    hasAnsweredRef.current = false;
  }

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cleanName) {
      return;
    }

    setPhase("ready");
  }

  function startRound(practice: boolean) {
    setQuestion(practice ? practiceQuestion : getRandomQuizQuestion(quizPool));
    setIsPracticeRound(practice);
    setSelectedIndex(null);
    setElapsedMs(null);
    setResultState("idle");
    setLastRankingId(null);
    hasAnsweredRef.current = false;
    setStartedAt(performance.now());
    setPhase("quiz");
  }

  async function saveRanking(answerElapsedMs: number, quizId: string) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/rankings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          playerName: cleanName,
          elapsedMs: answerElapsedMs,
          quizId
        })
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.configured && data.ranking) {
        setStorageMode("supabase");
        setLastRankingId(data.ranking.id);
        const nextRankings = await loadRankings();
        setRankings(nextRankings);
        return;
      }
    } catch {
      // Fall back to local storage below.
    }

    const localRanking = createLocalRanking(cleanName, answerElapsedMs, quizId);
    const nextRankings = sortRankings([...readLocalRankings(), localRanking]);
    writeLocalRankings(nextRankings);
    setStorageMode("local");
    setLastRankingId(localRanking.id);
    setRankings(nextRankings);
    setIsSaving(false);
  }

  async function handleChoice(choiceIndex: number) {
    if (hasAnsweredRef.current) {
      return;
    }

    hasAnsweredRef.current = true;
    const answerElapsedMs = performance.now() - startedAt;
    const isCorrect = choiceIndex === question.answerIndex;

    setSelectedIndex(choiceIndex);
    setElapsedMs(answerElapsedMs);

    if (isPracticeRound) {
      setResultState("practice");
      window.setTimeout(() => setPhase("practiceDone"), 650);
      return;
    }

    if (!isCorrect) {
      setResultState("wrong");
      await loadRankings();
      showRankingAfterDelay();
      return;
    }

    setResultState("correct");
    await saveRanking(answerElapsedMs, question.id);
    setIsSaving(false);
    showRankingAfterDelay();
  }

  async function handleResetRankings() {
    const pin = window.prompt("오늘 랭킹을 초기화할 관리자 PIN을 입력하세요.");

    if (pin === null) {
      return;
    }

    if (storageMode === "supabase") {
      const response = await fetch("/api/rankings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        window.alert(data?.error ?? "초기화에 실패했습니다.");
        return;
      }

      await loadRankings();
      window.alert("오늘 랭킹을 초기화했습니다.");
      return;
    }

    const localAdminPin = process.env.NEXT_PUBLIC_ADMIN_PIN;

    if (localAdminPin && pin !== localAdminPin) {
      window.alert("관리자 PIN이 올바르지 않습니다.");
      return;
    }

    writeLocalRankings([]);
    setRankings([]);
    window.alert("이 기기에 저장된 오늘 랭킹을 초기화했습니다.");
  }

  return (
    <main className="app-shell">
      <div className="kiosk-card">
        {phase !== "quiz" && (
          <header className="top-bar">
            <p className="top-bar-title">코이노니아 스피드퀴즈</p>
          </header>
        )}

        {phase === "quiz" && (
          <header className="quiz-bar">
            <span className="quiz-bar-label">{isPracticeRound ? "연습 게임" : "실전 게임"}</span>
            <span className="quiz-bar-timer">
              {elapsedMs === null ? "측정 중" : formatElapsed(elapsedMs)}
            </span>
          </header>
        )}

        <div className={`screen-body ${phase === "ranking" ? "screen-body-scroll" : ""}`}>
          {phase === "intro" && (
            <section className="flow-screen">
              <div className="flow-head flow-head-center">
                <span className="chip">순발력 챌린지</span>
                <h1 className="display-title">
                  퀴즈가 나오자마자
                  <br />
                  빛의 속도로 정답을
                  <br />
                  클릭하세요
                </h1>
                <p className="body-text">
                  가장 빨리 맞춘 사람에게 선물을 드려요.
                  <br />
                  이름을 입력하고 연습 문제로 손을 풀어 보세요.
                </p>
              </div>

              <form className="name-form" onSubmit={handleNameSubmit}>
                <div className="field-group">
                  <label className="field-label" htmlFor="playerName">
                    이름
                  </label>
                  <input
                    id="playerName"
                    className="text-field text-field-lg"
                    maxLength={20}
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="예: 민준"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-primary btn-primary-xl" disabled={!cleanName}>
                  다음으로
                </button>
              </form>

              {topRanking && (
                <div className="list-row list-row-highlight list-row-single">
                  <span className="list-row-single-label">오늘 1등</span>
                  <strong className="list-row-title">{topRanking.playerName}</strong>
                  <span className="list-row-value">{formatElapsed(topRanking.elapsedMs)}</span>
                </div>
              )}
            </section>
          )}

          {phase === "ready" && (
            <section className="flow-screen flow-screen-center">
              <div className="flow-head flow-head-center">
                <span className="chip">첫 라운드는 연습</span>
                <h1 className="display-title display-title-sm">
                  {cleanName}님,
                  <br />
                  손가락을 준비하세요
                </h1>
                <p className="body-text">
                  시작하기를 누르면
                  <br />
                  문제가 바로 나오고 시간이 측정돼요.
                </p>
              </div>
            </section>
          )}

          {phase === "quiz" && (
            <section className="quiz-screen">
              <article className="question-card question-card-text-only">
                <h2 className="question-title">{question.prompt}</h2>
              </article>

              <div className="choice-grid">
                {question.choices.map((choice, index) => {
                  const isSelected = selectedIndex === index;
                  const isAnswer = question.answerIndex === index;
                  const revealClass =
                    selectedIndex === null
                      ? ""
                      : isAnswer
                        ? "choice-correct"
                        : isSelected
                          ? "choice-wrong"
                          : "choice-muted";

                  return (
                    <button
                      key={`${choice}-${index}`}
                      className={`choice-button ${
                        question.choiceType === "image" ? "choice-button-image" : ""
                      } ${revealClass}`}
                      disabled={selectedIndex !== null}
                      onClick={() => void handleChoice(index)}
                    >
                      <span className="choice-index">{index + 1}</span>
                      {question.choiceType === "image" && question.choiceImages?.[index] ? (
                        <img
                          src={question.choiceImages[index]}
                          alt={choice || `선택지 ${index + 1}`}
                          className="choice-photo"
                          draggable={false}
                        />
                      ) : (
                        <span className="choice-label">{choice}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedIndex !== null && (
                <div className={`toast toast-${resultState}`}>
                  {resultState === "practice" && "좋아요! 방금은 연습이었어요."}
                  {resultState === "correct" &&
                    (isSaving ? "랭킹 등록 중이에요." : "정답! 랭킹에 등록할게요.")}
                  {resultState === "wrong" && "아쉽지만 이번 기록은 등록되지 않아요."}
                </div>
              )}
            </section>
          )}

          {phase === "practiceDone" && (
            <section className="flow-screen flow-screen-center">
              <div className="flow-head flow-head-center">
                <span className="chip">연습 완료</span>
                <h1 className="display-title display-title-sm">
                  이제 진짜 기록이
                  <br />
                  시작돼요
                </h1>
                <p className="body-text">
                  다음 문제에서 정답을 맞히면
                  <br />
                  오늘의 랭킹에 바로 올라가요.
                </p>
              </div>
            </section>
          )}

          {phase === "ranking" && (
            <section className="ranking-screen">
              <div className="result-card flow-head-center">
                {resultState === "correct" ? (
                  <>
                    <span className="chip chip-success">정답 등록 완료</span>
                    <h1 className="display-title display-title-sm">
                      {cleanName}님 기록
                      <br />
                      <span className="tabular">{elapsedMs === null ? "" : formatElapsed(elapsedMs)}</span>
                    </h1>
                    <p className="body-text">
                      {myRank ? `현재 ${myRank}위예요.` : "랭킹을 불러오고 있어요."}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="chip chip-danger">오답</span>
                    <h1 className="display-title display-title-sm">
                      이번 문제는
                      <br />
                      아쉽게 실패했어요
                    </h1>
                    <p className="body-text">랭킹에는 정답자 기록만 올라가요.</p>
                  </>
                )}
              </div>

              <RankingBoard rankings={rankings} lastRankingId={lastRankingId} />

              <p className="notice-bar">
                <span>{autoReturnLeft}초 뒤 처음 화면으로 돌아가요.</span>
                <button type="button" className="text-button" onClick={resetToIntro}>
                  바로 처음으로
                </button>
              </p>
            </section>
          )}
        </div>

        {(phase === "ready" || phase === "practiceDone") && (
          <div className="bottom-cta">
            <button
              type="button"
              className="btn-primary btn-primary-xl"
              onClick={() => startRound(phase === "ready")}
            >
              {phase === "ready" ? "시작하기" : "실전 시작"}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="admin-reset-fab"
        onClick={() => void handleResetRankings()}
      >
        관리자 랭킹 리셋
      </button>
    </main>
  );
}

function RankingBoard({
  rankings,
  lastRankingId
}: {
  rankings: Ranking[];
  lastRankingId: string | null;
}) {
  return (
    <section className="ranking-panel">
      <div className="list-header">
        <h2 className="section-title">오늘의 랭킹</h2>
        <span className="section-caption">빠른 순</span>
      </div>

      {rankings.length === 0 ? (
        <p className="empty-state">아직 등록된 정답 기록이 없어요.</p>
      ) : (
        <ol className="ranking-list">
          {rankings.slice(0, 10).map((ranking, index) => (
            <li
              key={ranking.id}
              className={`list-row ${index === 0 ? "list-row-first" : ""} ${
                ranking.id === lastRankingId ? "list-row-me" : ""
              }`}
            >
              <span className={`rank-badge ${index === 0 ? "rank-badge-first" : ""}`}>
                {index + 1}
              </span>
              <strong className="list-row-title">{ranking.playerName}</strong>
              <span className="list-row-value tabular">{formatElapsed(ranking.elapsedMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
