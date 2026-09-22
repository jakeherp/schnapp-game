import { GameError, startGame } from "@/lib/game-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const playerId = typeof body.playerId === "string" ? body.playerId : "";

    const game = await startGame(id, playerId);
    return Response.json({ game });
  } catch (error) {
    if (error instanceof GameError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
