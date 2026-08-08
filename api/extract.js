
import axios from "axios";
import * as cheerio from "cheerio";

console.log("🔥 EXTRACT.JS LOADED");

// ======================================================
// CACHE
// ======================================================

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedData(url) {
  const cached = cache.get(url);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(url);
    return null;
  }

  return cached.data;
}

function setCachedData(url, data) {
  cache.set(url, {
    timestamp: Date.now(),
    data,
  });
}

// ======================================================
// ALLOWED HOSTS
// ======================================================

const allowedHosts = new Set([
  "mangadex.org",
  "manga-starz.net",
  "mangalek.me",
  "mangakakalot.com",
  "manhuaplus.com",
  "mangaraw.org",
  "mangatek.com",
]);

// ======================================================
// USER AGENTS
// ======================================================

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",

  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

function getRandomUserAgent() {
  return userAgents[
    Math.floor(Math.random() * userAgents.length)
  ];
}

// ======================================================
// URL NORMALIZATION
// ======================================================

function normalizeUrl(raw, baseUrl) {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let value = raw.trim();

  // Remove quotes
  value = value.replace(/^["'`]+|["'`]+$/g, "");

  // Decode escaped URLs
  value = value
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");

  // Remove whitespace
  value = value.split(/\s+/)[0];

  if (!value) {
    return null;
  }

  // Protocol-relative
  if (value.startsWith("//")) {
    value = "https:" + value;
  }

  try {
    const parsed = new URL(value, baseUrl);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

// ======================================================
// IMAGE CHECK
// ======================================================

function looksLikeImage(url) {
  if (!url) {
    return false;
  }

  const clean = url
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();

  return (
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".png") ||
    clean.endsWith(".webp") ||
    clean.endsWith(".avif") ||
    clean.endsWith(".jfif")
  );
}

// ======================================================
// GARBAGE FILTER
// ======================================================

function isGarbageImage(url) {
  if (!url) {
    return true;
  }

  const lower = url.toLowerCase();

  const garbageWords = [
    "logo",
    "banner",
    "avatar",
    "favicon",
    "watermark",
    "badge",
    "icon",
    "stamp",
    "advertisement",
    "/ads/",
    "ads.",
    "sprite",
    "emoji",
    "loading",
    "placeholder",
    "thumb",
    "thumbnail",
  ];

  const garbageExtensions = [
    ".svg",
    ".gif",
    ".ico",
  ];

  if (
    garbageWords.some((word) =>
      lower.includes(word)
    )
  ) {
    return true;
  }

  const clean = lower
    .split("?")[0]
    .split("#")[0];

  if (
    garbageExtensions.some((ext) =>
      clean.endsWith(ext)
    )
  ) {
    return true;
  }

  return false;
}

// ======================================================
// ADD IMAGE
// ======================================================

function addImage(raw, baseUrl, images, seen) {
  const url = normalizeUrl(
    raw,
    baseUrl
  );

  if (!url) {
    return;
  }

  if (!looksLikeImage(url)) {
    return;
  }

  if (isGarbageImage(url)) {
    return;
  }

  if (seen.has(url)) {
    return;
  }

  seen.add(url);
  images.push(url);
}

// ======================================================
// SRCSET
// ======================================================

function extractSrcset(
  srcset,
  baseUrl,
  images,
  seen
) {
  if (!srcset) {
    return;
  }

  const parts = srcset.split(",");

  for (const part of parts) {
    const value = part
      .trim()
      .split(/\s+/)[0];

    if (value) {
      addImage(
        value,
        baseUrl,
        images,
        seen
      );
    }
  }
}

// ======================================================
// CHEERIO EXTRACTION
// ======================================================

function extractWithCheerio(
  html,
  baseUrl
) {
  const images = [];
  const seen = new Set();

  if (!html) {
    return images;
  }

  try {
    const $ = cheerio.load(html);

    // ==================================================
    // IMG
    // ==================================================

    $("img").each((_, element) => {
      const attributes = [
        "src",
        "data-src",
        "data-original",
        "data-lazy-src",
        "data-original-src",
        "data-cdn",
        "data-image",
        "data-url",
        "data-page",
        "data-lazy",
        "data-filename",
      ];

      for (const attr of attributes) {
        const value = $(element).attr(attr);

        if (value) {
          addImage(
            value,
            baseUrl,
            images,
            seen
          );
        }
      }

      extractSrcset(
        $(element).attr("srcset"),
        baseUrl,
        images,
        seen
      );

      extractSrcset(
        $(element).attr("data-srcset"),
        baseUrl,
        images,
        seen
      );
    });

    // ==================================================
    // SOURCE
    // ==================================================

    $("source").each((_, element) => {
      const src =
        $(element).attr("src");

      if (src) {
        addImage(
          src,
          baseUrl,
          images,
          seen
        );
      }

      extractSrcset(
        $(element).attr("srcset"),
        baseUrl,
        images,
        seen
      );
    });

    // ==================================================
    // PICTURE
    // ==================================================

    $("picture source").each(
      (_, element) => {
        const src =
          $(element).attr("src");

        if (src) {
          addImage(
            src,
            baseUrl,
            images,
            seen
          );
        }

        extractSrcset(
          $(element).attr("srcset"),
          baseUrl,
          images,
          seen
        );
      }
    );

  } catch (error) {
    console.error(
      "❌ Cheerio extraction error:",
      error.message
    );
  }

  return images;
}

// ======================================================
// REGEX EXTRACTION
// ======================================================

function extractWithRegex(
  html,
  baseUrl
) {
  const images = [];
  const seen = new Set();

  if (!html) {
    return images;
  }

  // ==================================================
  // DIRECT HTTPS URLs
  // ==================================================

  const directRegex =
    /https?:\/\/[^"'<>\\\s]+/gi;

  const directMatches =
    html.match(directRegex) || [];

  for (let url of directMatches) {
    url = url
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
      .replace(/\\u003f/gi, "?")
      .replace(/\\u003d/gi, "=")
      .replace(/\\u002f/gi, "/");

    addImage(
      url,
      baseUrl,
      images,
      seen
    );
  }

  // ==================================================
  // PROTOCOL RELATIVE
  // ==================================================

  const protocolRegex =
    /\/\/[^"'<>\\\s]+/gi;

  const protocolMatches =
    html.match(protocolRegex) || [];

  for (const url of protocolMatches) {
    if (!url.startsWith("//")) {
      continue;
    }

    addImage(
      url,
      baseUrl,
      images,
      seen
    );
  }

  // ==================================================
  // RELATIVE URLs
  // ==================================================

  const relativeRegex =
    /["'`]([^"'`<>\\\s]+\.(?:jpg|jpeg|png|webp|avif|jfif)(?:\?[^"'`]*)?)["'`]/gi;

  const relativeMatches =
    html.matchAll(relativeRegex);

  for (const match of relativeMatches) {
    const url = match[1];

    addImage(
      url,
      baseUrl,
      images,
      seen
    );
  }

  return images;
}

// ======================================================
// SCRIPT / JSON EXTRACTION
// ======================================================

function extractFromScripts(
  html,
  baseUrl
) {
  const images = [];
  const seen = new Set();

  if (!html) {
    return images;
  }

  try {
    const $ = cheerio.load(html);

    $("script").each((_, element) => {
      const content =
        $(element).html();

      if (!content) {
        return;
      }

      // Direct URLs
      const directRegex =
        /https?:\/\/[^"'\\\s]+/gi;

      const directMatches =
        content.match(directRegex) || [];

      for (let url of directMatches) {
        url = url
          .replace(/\\\//g, "/")
          .replace(/\\u0026/gi, "&")
          .replace(/\\u003f/gi, "?")
          .replace(/\\u003d/gi, "=")
          .replace(/\\u002f/gi, "/");

        addImage(
          url,
          baseUrl,
          images,
          seen
        );
      }

      // Protocol-relative URLs
      const protocolRegex =
        /\/\/[^"'\\\s]+/gi;

      const protocolMatches =
        content.match(protocolRegex) || [];

      for (const url of protocolMatches) {
        if (!url.startsWith("//")) {
          continue;
        }

        addImage(
          url,
          baseUrl,
          images,
          seen
        );
      }
    });

  } catch (error) {
    console.error(
      "❌ Script extraction error:",
      error.message
    );
  }

  return images;
}

// ======================================================
// MAIN EXTRACTION
// ======================================================

function extractImages(
  html,
  baseUrl
) {
  const allImages = [];
  const seen = new Set();

  const methods = [
    extractWithCheerio,
    extractWithRegex,
    extractFromScripts,
  ];

  for (const method of methods) {
    const results =
      method(
        html,
        baseUrl
      );

    for (const image of results) {
      if (!seen.has(image)) {
        seen.add(image);
        allImages.push(image);
      }
    }
  }

  return allImages;
}

// ======================================================
// SOURCE DETECTION
// ======================================================

function detectSource(url) {
  try {
    const hostname =
      new URL(url)
        .hostname
        .toLowerCase();

    if (
      hostname.includes(
        "mangatek"
      )
    ) {
      return "mangatek";
    }

    if (
      hostname.includes(
        "mangadex"
      )
    ) {
      return "mangadex";
    }

    if (
      hostname.includes(
        "manga-starz"
      )
    ) {
      return "manga-starz";
    }

    if (
      hostname.includes(
        "mangalek"
      )
    ) {
      return "mangalek";
    }

    if (
      hostname.includes(
        "mangakakalot"
      )
    ) {
      return "mangakakalot";
    }

    if (
      hostname.includes(
        "manhuaplus"
      )
    ) {
      return "manhuaplus";
    }

    if (
      hostname.includes(
        "mangaraw"
      )
    ) {
      return "mangaraw";
    }

    return "unknown";

  } catch {
    return "unknown";
  }
}

// ======================================================
// JSON RESPONSE
// ======================================================

function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Access-Control-Allow-Origin":
          "*",

        "Access-Control-Allow-Methods":
          "POST, OPTIONS",

        "Access-Control-Allow-Headers":
          "Content-Type",

        "Cache-Control":
          "no-store",
      },
    }
  );
}

// ======================================================
// HANDLER
// ======================================================

export default async function handler(req) {
  const method =
    req.method || "GET";

  console.log(
    "📥 Request:",
    method
  );

  // ====================================================
  // OPTIONS
  // ====================================================

  if (method === "OPTIONS") {
    return json({}, 200);
  }

  // ====================================================
  // POST ONLY
  // ====================================================

  if (method !== "POST") {
    return json(
      {
        success: false,
        error:
          "Method Not Allowed",
        method,
      },
      405
    );
  }

  // ====================================================
  // BODY
  // ====================================================

  let body;

  try {
    body = await req.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "Invalid JSON body",
      },
      400
    );
  }

  const chapterUrl =
    body?.chapterUrl;

  // ====================================================
  // VALIDATION
  // ====================================================

  if (
    !chapterUrl ||
    typeof chapterUrl !== "string"
  ) {
    return json(
      {
        success: false,
        error:
          "chapterUrl is required and must be a string",
      },
      400
    );
  }

  // ====================================================
  // PARSE URL
  // ====================================================

  let url;

  try {
    url = new URL(
      chapterUrl.trim()
    );

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return json(
        {
          success: false,
          error:
            "Only HTTP and HTTPS URLs are allowed",
        },
        400
      );
    }

  } catch {
    return json(
      {
        success: false,
        error:
          "Invalid URL format",
      },
      400
    );
  }

  // ====================================================
  // WHITELIST
  // ====================================================

  const hostname =
    url.hostname.toLowerCase();

  const allowed =
    Array.from(
      allowedHosts
    ).some(
      (host) =>
        hostname === host ||
        hostname.endsWith(
          "." + host
        )
    );

  if (!allowed) {
    return json(
      {
        success: false,
        error:
          "Website not supported",

        hostname,

        allowedHosts:
          Array.from(
            allowedHosts
          ),
      },
      403
    );
  }

  // ====================================================
  // NORMALIZED CACHE KEY
  // ====================================================

  const cacheKey =
    url.href;

  const cached =
    getCachedData(
      cacheKey
    );

  if (cached) {
    console.log(
      "💾 CACHE HIT:",
      cacheKey
    );

    return json({
      success: true,

      source:
        detectSource(
          cacheKey
        ),

      count:
        cached.count,

      images:
        cached.images,

      cached: true,
    });
  }

  // ====================================================
  // FETCH WEBSITE
  // ====================================================

  try {
    console.log(
      "🌐 Fetching:",
      cacheKey
    );

    const response =
      await axios.get(
        cacheKey,
        {
          headers: {
            "User-Agent":
              getRandomUserAgent(),

            "Referer":
              cacheKey,

            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

            "Accept-Language":
              "en-US,en;q=0.9",

            "Cache-Control":
              "no-cache",

            "Pragma":
              "no-cache",
          },

          timeout: 15000,

          maxRedirects: 5,

          maxContentLength:
            10 * 1024 * 1024,

          responseType: "text",

          validateStatus:
            () => true,
        }
      );

    console.log(
      "📡 HTTP Status:",
      response.status
    );

    const html =
      typeof response.data === "string"
        ? response.data
        : "";

    console.log(
      "📄 HTML Length:",
      html.length
    );

    // ==================================================
    // HTTP ERRORS
    // ==================================================

    if (
      response.status === 404
    ) {
      return json(
        {
          success: false,
          error:
            "Chapter not found on the website",
          status:
            response.status,
        },
        404
      );
    }

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      return json(
        {
          success: false,
          error:
            "The website blocked the request",
          status:
            response.status,
        },
        403
      );
    }

    if (
      response.status >= 400
    ) {
      return json(
        {
          success: false,
          error:
            "Website returned an error",
          status:
            response.status,
        },
        502
      );
    }

    // ==================================================
    // EXTRACT IMAGES
    // ==================================================

    const imageUrls =
      extractImages(
        html,
        cacheKey
      );

    console.log(
      "🖼️ Images found:",
      imageUrls.length
    );

    // ==================================================
    // NO IMAGES
    // ==================================================

    if (
      imageUrls.length === 0
    ) {
      return json(
        {
          success: false,

          error:
            "No images found in this chapter",

          debug: {
            source:
              detectSource(
                cacheKey
              ),

            htmlLength:
              html.length,

            contentType:
              response.headers[
                "content-type"
              ] || null,

            finalUrl:
              response.request
                ?.res
                ?.responseUrl ||
              cacheKey,
          },
        },
        404
      );
    }

    // ==================================================
    // RESULT
    // ==================================================

    const result = {
      count:
        imageUrls.length,

      images:
        imageUrls,
    };

    // ==================================================
    // CACHE
    // ==================================================

    setCachedData(
      cacheKey,
      result
    );

    // ==================================================
    // RESPONSE
    // ==================================================

    return json(
      {
        success: true,

        source:
          detectSource(
            cacheKey
          ),

        count:
          result.count,

        images:
          result.images,

        cached: false,
      },
      200
    );

  } catch (error) {
    console.error(
      "❌ EXTRACT ERROR:",
      error
    );

    // ==================================================
    // TIMEOUT
    // ==================================================

    if (
      error.code ===
        "ECONNABORTED" ||
      error.code ===
        "ETIMEDOUT"
    ) {
      return json(
        {
          success: false,
          error:
            "Request timeout. The website took too long to respond.",
        },
        504
      );
    }

    // ==================================================
    // DNS
    // ==================================================

    if (
      error.code ===
      "ENOTFOUND"
    ) {
      return json(
        {
          success: false,
          error:
            "Could not resolve the website hostname.",
        },
        400
      );
    }

    // ==================================================
    // NETWORK ERROR
    // ==================================================

    if (
      error.code ===
        "ECONNRESET" ||
      error.code ===
        "ECONNREFUSED" ||
      error.code ===
        "EAI_AGAIN"
    ) {
      return json(
        {
          success: false,
          error:
            "Network error while connecting to the website.",
          code:
            error.code,
        },
        502
      );
    }

    // ==================================================
    // GENERIC ERROR
    // ==================================================

    return json(
      {
        success: false,

        error:
          "Failed to fetch chapter",

        details:
          error?.message ||
          "Unknown error",
      },
      500
    );
  }
}
