export async function GET() {
  const key = (process.env.BEEHIIV_API_KEY || "").trim();
  const pub = (process.env.BEEHIIV_PUBLICATION_ID || "").trim();

  return new Response(
    JSON.stringify({
      hasKey: key.length > 0,
      hasV2Pub: pub.startsWith("pub_"),
      pubPrefix: pub.slice(0, 4),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
