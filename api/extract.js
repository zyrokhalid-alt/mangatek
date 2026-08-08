import axios from "axios";

console.log("🔥 EXTRACT.JS LOADED");

export default async function handler(req, res) {
  console.log("🔥 EXTRACT FUNCTION CALLED");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "POST only"
    });
  }

  const chapterUrl = req.body?.chapterUrl;

  if (!chapterUrl) {
    return res.status(400).json({
      success: false,
      error: "chapterUrl is required"
    });
  }

  console.log("🌐 FETCHING:", chapterUrl);

  try {
    const response = await axios.get(chapterUrl, {
      timeout: 10000,

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

        "Accept-Language":
          "en-US,en;q=0.9"
      },

      maxRedirects: 5,

      validateStatus: () => true,

      responseType: "text"
    });

    console.log("📡 STATUS:", response.status);

    return res.status(200).json({
      success: true,
      status: response.status,
      htmlLength:
        typeof response.data === "string"
          ? response.data.length
          : 0,
      contentType:
        response.headers["content-type"] || null
    });

  } catch (error) {

    console.error("❌ FETCH ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
}