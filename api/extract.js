import puppeteer from "puppeteer";

console.log("🔥 PUPPETEER EXTRACT LOADED");

export default async function handler(req, res) {
  console.log("🔥 FUNCTION CALLED");

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

  let browser;

  try {
    console.log("🚀 Launching browser...");

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote"
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36"
    );

    await page.setViewport({
      width: 1366,
      height: 768
    });

    console.log("🌐 Opening:", chapterUrl);

    const response = await page.goto(chapterUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    console.log(
      "📡 STATUS:",
      response ? response.status() : "NO RESPONSE"
    );

    await new Promise(resolve =>
      setTimeout(resolve, 5000)
    );

    const title = await page.title();

    const html = await page.content();

    console.log("📄 TITLE:", title);
    console.log("📄 HTML:", html.length);

    await browser.close();
    browser = null;

    return res.status(200).json({
      success: true,

      status:
        response
          ? response.status()
          : null,

      title,

      htmlLength:
        html.length,

      url:
        page.url()
    });

  } catch (error) {

    console.error(
      "❌ PUPPETEER ERROR:",
      error
    );

    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
}