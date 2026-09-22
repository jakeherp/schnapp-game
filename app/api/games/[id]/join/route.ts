import { GameError, joinGame } from "@/lib/game-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const existingPlayerId =
      typeof body.playerId === "string" ? body.playerId : undefined;

    const { game, playerId } = await joinGame(id, name, existingPlayerId);
    return Response.json({ game, playerId });
  } catch (error) {
    if (error instanceof GameError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
