"use client";

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
    return;
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
      <section className="orb orb-one" />
      <section className="orb orb-two" />

      <div className="kiosk-card">
        <header className="app-header">
          <div>
            <p className="eyebrow">Koinonia Speed Quiz</p>
            <h1>빛의 속도로 정답을 클릭하세요!</h1>
          </div>
          <div className={`storage-pill storage-pill-${storageMode}`}>
            {storageMode === "checking" && "연결 확인 중"}
            {storageMode === "supabase" && "Supabase 랭킹"}
            {storageMode === "local" && "기기 저장 모드"}
          </div>
        </header>

        {phase === "intro" && (
          <section className="screen intro-screen">
            <div className="hero-copy">
              <span className="spark-badge">순발력 챌린지</span>
              <h2>퀴즈가 나오자마자 빛의 속도로 정답을 클릭하세요!</h2>
              <p>
                가장 빨리 퀴즈를 맞춘 사람에게 선물을 드립니다. 이름을 입력하고
                연습 문제로 손을 풀어 보세요.
              </p>
            </div>

            <form className="name-form" onSubmit={handleNameSubmit}>
              <label htmlFor="playerName">이름</label>
              <input
                id="playerName"
                maxLength={20}
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="예: 민준"
                autoComplete="off"
                autoFocus
              />
              <button type="submit" disabled={!cleanName}>
                다음으로
              </button>
            </form>

            {topRanking && (
              <div className="today-best">
                <span>오늘 1등</span>
                <strong>
                  {topRanking.playerName} · {formatElapsed(topRanking.elapsedMs)}
                </strong>
              </div>
            )}
          </section>
        )}

        {phase === "ready" && (
          <section className="screen ready-screen">
            <span className="spark-badge">첫 라운드는 연습!</span>
            <h2>{cleanName}님, 손가락을 준비하세요.</h2>
            <p>Start를 누르는 순간 문제가 나타나고 시간이 바로 측정됩니다.</p>
            <button className="start-button" onClick={() => startRound(true)}>
              Start
            </button>
          </section>
        )}

        {phase === "quiz" && (
          <section className="screen quiz-screen">
            <div className="quiz-topline">
              <span>{isPracticeRound ? "연습 게임" : "실전 게임"}</span>
              <strong>{elapsedMs === null ? "측정 중..." : formatElapsed(elapsedMs)}</strong>
            </div>

            <div className="question-card">
              <div className="visual-card">{question.visual}</div>
              <h2>{question.prompt}</h2>
            </div>

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
                    key={choice}
                    className={`choice-button ${revealClass}`}
                    disabled={selectedIndex !== null}
                    onClick={() => void handleChoice(index)}
                  >
                    <span>{index + 1}</span>
                    {choice}
                  </button>
                );
              })}
            </div>

            {selectedIndex !== null && (
              <div className={`answer-toast answer-toast-${resultState}`}>
                {resultState === "practice" && "좋아요! 방금은 연습게임이었어요."}
                {resultState === "correct" && (isSaving ? "랭킹 등록 중..." : "정답! 랭킹에 등록합니다.")}
                {resultState === "wrong" && "땡! 아쉽지만 이번 기록은 등록되지 않아요."}
              </div>
            )}
          </section>
        )}

        {phase === "practiceDone" && (
          <section className="screen ready-screen">
            <span className="spark-badge">처음은 연습게임!</span>
            <h2>이제 진짜 기록이 시작됩니다.</h2>
            <p>다음 문제에서 정답을 맞히면 오늘의 랭킹에 바로 올라갑니다.</p>
            <button className="start-button" onClick={() => startRound(false)}>
              Real Start
            </button>
          </section>
        )}

        {phase === "ranking" && (
          <section className="screen ranking-screen">
            <div className="result-summary">
              {resultState === "correct" ? (
                <>
                  <span className="spark-badge">정답 등록 완료</span>
                  <h2>
                    {cleanName}님 기록 {elapsedMs === null ? "" : formatElapsed(elapsedMs)}
                  </h2>
                  <p>{myRank ? `현재 ${myRank}위입니다!` : "랭킹을 불러오고 있습니다."}</p>
                </>
              ) : (
                <>
                  <span className="spark-badge fail-badge">땡!</span>
                  <h2>이번 문제는 아쉽게 실패했어요.</h2>
                  <p>랭킹에는 정답자 기록만 올라갑니다.</p>
                </>
              )}
            </div>

            <RankingBoard rankings={rankings} lastRankingId={lastRankingId} />

            <p className="auto-return">
              {autoReturnLeft}초 뒤 처음 화면으로 돌아갑니다.
              <button onClick={resetToIntro}>바로 처음으로</button>
            </p>
          </section>
        )}

        <footer className="app-footer">
          <span>오늘 기준: {getKstDayKey()} KST</span>
          <button className="reset-button" onClick={() => void handleResetRankings()}>
            관리자 랭킹 리셋
          </button>
        </footer>
      </div>
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
    <div className="ranking-board">
      <div className="ranking-title">
        <h3>오늘의 랭킹</h3>
        <span>빠른 순서</span>
      </div>

      {rankings.length === 0 ? (
        <div className="empty-ranking">아직 등록된 정답 기록이 없습니다.</div>
      ) : (
        <ol>
          {rankings.slice(0, 10).map((ranking, index) => (
            <li
              key={ranking.id}
              className={ranking.id === lastRankingId ? "my-ranking" : undefined}
            >
              <span className="rank-number">{index + 1}</span>
              <strong>{ranking.playerName}</strong>
              <em>{formatElapsed(ranking.elapsedMs)}</em>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
