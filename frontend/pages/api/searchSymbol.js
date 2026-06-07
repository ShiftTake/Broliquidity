export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ||
    "https://us-central1-broliquidity.cloudfunctions.net";

  try {
    const response = await fetch(
      `${baseUrl}/searchSymbol?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "Search upstream request failed",
        details: text.slice(0, 300)
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to search symbols",
      details: error?.message || "Unknown error"
    });
  }
}
