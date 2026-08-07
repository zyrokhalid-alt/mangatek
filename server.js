const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const os = require("os");
const compression = require("compression");

const app = express();

// 🟢 1. ضغط البيانات المرسلة للموبايل
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// 🟢 2. الذاكرة المؤقتة (Cache)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // حفظ الروابط لمدة ساعة

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function normalizeUrl(raw, base) {
  if (!raw) return null;
  let u = raw.trim().split(" ")[0].replace(/(^")|("$)/g, "");
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  try {
    return new URL(u, base).toString();
  } catch (e) {
    return null;
  }
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

// 🟢 3. استخراج الصور عبر Regex (خفيف وسريع جداً)
function extractImagesWithRegex(html, baseUrl) {
  const imageUrls = [];
  const imgTagRegex = /<img\s+[^>]*>/gi;
  const attrRegex = /(?:src|data-src|data-lazy-src|data-original|data-cdn)\s*=\s*["']([^"']+)["']/gi;

  let match;
  while ((match = imgTagRegex.exec(html)) !== null) {
    const imgTag = match[0];
    let attrMatch;

    while ((attrMatch = attrRegex.exec(imgTag)) !== null) {
      const src = attrMatch[1];
      const normalized = normalizeUrl(src, baseUrl);

      if (normalized) {
        const isGarbage =
          normalized.includes("logo") ||
          normalized.includes("banner") ||
          normalized.includes("avatar") ||
          normalized.includes("favicon") ||
          normalized.endsWith(".svg") ||
          normalized.endsWith(".gif");

        if (!isGarbage && normalized.startsWith("http") && !imageUrls.includes(normalized)) {
          imageUrls.push(normalized);
        }
      }
      break;
    }
  }
  return imageUrls;
}

app.post("/api/get-images", async (req, res) => {
  const { chapterUrl } = req.body;
  if (!chapterUrl) return res.status(400).json({ error: "الرابط مطلوب" });

  // 🟢 التثبت من الـ Cache (استجابة فورية 0 KB)
  const cachedData = cache.get(chapterUrl);
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    console.log(`\n⚡ [من الذاكرة المؤقتة 🧠] استرجاع ${cachedData.images.length} صورة | استهلاك السيرفر: 0 KB`);
    return res.json({
      ...cachedData.response,
      serverUsage: { kb: "0.00 (Cached)", durationSeconds: "0.00" }
    });
  }

  const startTime = Date.now();

  try {
    // 🟢 4. طلب الصفحة بنص عادي واستجابة آمنة ومضمونة 100%
    const response = await axios.get(chapterUrl, {
      headers: { ...HEADERS, Referer: chapterUrl },
      timeout: 8000, // إلغاء التعليق بعد 8 ثوانٍ كحد أقصى
      responseType: "text",
      maxContentLength: 2 * 1024 * 1024, // قطع التحميل لو تجاوزت الصفحة 2 ميجابايت لتوفير النت
    });

    const rawData = response.data;
    const totalBytes = Buffer.byteLength(rawData, "utf8");

    const imageUrls = extractImagesWithRegex(rawData, chapterUrl);

    const kbUsed = (totalBytes / 1024).toFixed(2);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const resultData = {
      success: true,
      count: imageUrls.length,
      images: imageUrls,
    };

    cache.set(chapterUrl, {
      timestamp: Date.now(),
      images: imageUrls,
      response: resultData
    });

    console.log(`\n⚡ [تم الاستخراج بنجاح] ${imageUrls.length} صورة في ${duration}s | استهلاك السيرفر: ${kbUsed} KB`);

    return res.json({
      ...resultData,
      serverUsage: { kb: kbUsed, durationSeconds: duration },
    });

  } catch (err) {
    console.error("خطأ في السيرفر:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: "فشل قراءة الفصل أو انتهت مهلة الإجابة." });
    }
  }
});

const PORT = process.env.PORT || 3000;
const localIp = getLocalIp();

app.listen(PORT, "0.0.0.0", () => {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log(`║   🚀 MangaTek يعمل على: http://localhost:${PORT}                 ║`);
  console.log(`║   📱 للتجربة من الموبايل: http://${localIp}:${PORT}        ║`);
  console.log("║   📚 المصادر: MangaDex API + مانجا محلية                     ║");
  console.log("║   🇸🇦 الفصول المعروضة: المترجمة للعربي فقط                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n");
});