import { NextRequest } from "next/server";
import { GameError, createGame } from "@/lib/game-store";
import { ROUND_COUNTS, type RoundCount } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const totalRounds = body.totalRounds as RoundCount;

    if (!ROUND_COUNTS.includes(totalRounds)) {
      return Response.json({ error: "Invalid round count" }, { status: 400 });
    }

    const { game, playerId } = await createGame(name, totalRounds);
    return Response.json({ game, playerId });
  } catch (error) {
    if (error instanceof GameError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
