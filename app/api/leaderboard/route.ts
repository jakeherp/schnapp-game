import { getLeaderboard } from "@/lib/leaderboard";

export async function GET() {
  const entries = await getLeaderboard(20);
  return Response.json({ entries });
}
