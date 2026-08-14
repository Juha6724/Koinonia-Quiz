export type Ranking = {
  id: string;
  playerName: string;
  elapsedMs: number;
  quizId: string;
  createdAt: string;
};

export type RankingRow = {
  id: string;
  player_name: string;
  elapsed_ms: number;
  quiz_id: string;
  created_at: string;
};

export function toRanking(row: RankingRow): Ranking {
  return {
    id: row.id,
    playerName: row.player_name,
    elapsedMs: row.elapsed_ms,
    quizId: row.quiz_id,
    createdAt: row.created_at
  };
}

export function sortRankings(rankings: Ranking[]) {
  return [...rankings].sort((a, b) => a.elapsedMs - b.elapsedMs);
}
