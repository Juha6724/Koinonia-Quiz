import { NextRequest, NextResponse } from "next/server";

import { getKstDayRange } from "@/lib/day";
import { RankingRow, toRanking } from "@/lib/rankings";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ configured: false, rankings: [] });
  }

  const { since, until } = getKstDayRange();
  const { data, error } = await supabase
    .from("rankings")
    .select("id, player_name, elapsed_ms, quiz_id, created_at")
    .gte("created_at", since)
    .lt("created_at", until)
    .order("elapsed_ms", { ascending: true })
    .limit(100);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    configured: true,
    rankings: (data as RankingRow[]).map(toRanking)
  });
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const playerName = String(body?.playerName ?? "").trim().slice(0, 20);
  const elapsedMs = Number(body?.elapsedMs);
  const quizId = String(body?.quizId ?? "").trim().slice(0, 64);

  if (!playerName) {
    return jsonError("이름을 입력해 주세요.", 400);
  }

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 60000) {
    return jsonError("기록 시간이 올바르지 않습니다.", 400);
  }

  if (!quizId) {
    return jsonError("퀴즈 정보가 올바르지 않습니다.", 400);
  }

  const { data, error } = await supabase
    .from("rankings")
    .insert({
      player_name: playerName,
      elapsed_ms: Math.round(elapsedMs),
      quiz_id: quizId
    })
    .select("id, player_name, elapsed_ms, quiz_id, created_at")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    configured: true,
    ranking: toRanking(data as RankingRow)
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  const adminPin = process.env.ADMIN_RESET_PIN;

  if (!adminPin) {
    return jsonError("ADMIN_RESET_PIN 환경변수를 설정해야 초기화할 수 있습니다.", 428);
  }

  const body = await request.json().catch(() => null);

  if (String(body?.pin ?? "") !== adminPin) {
    return jsonError("관리자 PIN이 올바르지 않습니다.", 401);
  }

  const { since, until } = getKstDayRange();
  const { error } = await supabase
    .from("rankings")
    .delete()
    .gte("created_at", since)
    .lt("created_at", until);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ configured: true, ok: true });
}
