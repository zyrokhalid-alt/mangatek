// public/js/extractor.js

console.log("🔥 CLIENT EXTRACTOR LOADED");

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".jfif"
];

const GARBAGE_WORDS = [
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
  "thumbnail"
];

const GARBAGE_EXTENSIONS = [
  ".svg",
  ".gif",
  ".ico"
];


// ======================================================
// URL NORMALIZATION
// ======================================================

function normalizeUrl(raw, baseUrl) {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let value = raw.trim();

  value = value.replace(/^["'`]+|["'`]+$/g, "");

  value = value
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/");

  value = value.split(/\s+/)[0];

  if (!value) {
    return null;
  }

  if (value.startsWith("//")) {
    value = "https:" + value;
  }

  try {
    const url = new URL(value, baseUrl);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.href;

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

  return IMAGE_EXTENSIONS.some(ext =>
    clean.endsWith(ext)
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

  if (
    GARBAGE_WORDS.some(word =>
      lower.includes(word)
    )
  ) {
    return true;
  }

  const clean = lower
    .split("?")[0]
    .split("#")[0];

  if (
    GARBAGE_EXTENSIONS.some(ext =>
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
// DOM IMAGE EXTRACTION
// ======================================================

function extractFromDocument(
  document,
  baseUrl
) {
  const images = [];
  const seen = new Set();

  // ====================================================
  // IMG
  // ====================================================

  document
    .querySelectorAll("img")
    .forEach(img => {

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
        "data-filename"
      ];

      for (const attr of attributes) {
        const value =
          img.getAttribute(attr);

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
        img.getAttribute("srcset"),
        baseUrl,
        images,
        seen
      );

      extractSrcset(
        img.getAttribute("data-srcset"),
        baseUrl,
        images,
        seen
      );
    });


  // ====================================================
  // SOURCE
  // ====================================================

  document
    .querySelectorAll("source")
    .forEach(source => {

      const src =
        source.getAttribute("src");

      if (src) {
        addImage(
          src,
          baseUrl,
          images,
          seen
        );
      }

      extractSrcset(
        source.getAttribute("srcset"),
        baseUrl,
        images,
        seen
      );
    });


  // ====================================================
  // LINKS TO IMAGES
  // ====================================================

  document
    .querySelectorAll("a[href]")
    .forEach(link => {

      const href =
        link.getAttribute("href");

      if (href) {
        addImage(
          href,
          baseUrl,
          images,
          seen
        );
      }
    });


  return images;
}


// ======================================================
// SCRIPT EXTRACTION
// ======================================================

function extractFromScripts(
  document,
  baseUrl,
  images,
  seen
) {
  document
    .querySelectorAll("script")
    .forEach(script => {

      const content =
        script.textContent || "";

      if (!content) {
        return;
      }

      // Direct URLs
      const directRegex =
        /https?:\/\/[^"'\\\s<>]+/gi;

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


      // Protocol-relative
      const protocolRegex =
        /\/\/[^"'\\\s<>]+/gi;

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
}


// ======================================================
// EXTRACT FROM HTML
// ======================================================

function extractFromHtml(
  html,
  baseUrl
) {
  const parser =
    new DOMParser();

  const document =
    parser.parseFromString(
      html,
      "text/html"
    );

  const images =
    extractFromDocument(
      document,
      baseUrl
    );

  const seen =
    new Set(images);

  extractFromScripts(
    document,
    baseUrl,
    images,
    seen
  );

  return images;
}


// ======================================================
// FETCH CHAPTER
// ======================================================

async function fetchChapterHtml(
  chapterUrl
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      20000
    );

  try {

    const response =
      await fetch(chapterUrl, {
        method: "GET",

        credentials: "include",

        signal:
          controller.signal,

        headers: {
          "Accept":
            "text/html,application/xhtml+xml"
        }
      });

    if (!response.ok) {
      throw new Error(
        `Website returned HTTP ${response.status}`
      );
    }

    return await response.text();

  } finally {
    clearTimeout(timeout);
  }
}


// ======================================================
// MAIN EXTRACTOR
// ======================================================

async function extractChapterImages(
  chapterUrl
) {
  if (!chapterUrl) {
    throw new Error(
      "Chapter URL is required"
    );
  }

  let url;

  try {
    url = new URL(
      chapterUrl.trim()
    );
  } catch {
    throw new Error(
      "Invalid chapter URL"
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are supported"
    );
  }

  console.log(
    "🌐 Fetching chapter:",
    url.href
  );

  let html;

  try {

    html =
      await fetchChapterHtml(
        url.href
      );

  } catch (error) {

    if (
      error.name ===
      "AbortError"
    ) {
      throw new Error(
        "Request timed out after 20 seconds"
      );
    }

    // Usually CORS/network/browser blocking
    throw new Error(
      "المتصفح مش قادر يقرأ الصفحة مباشرة. الموقع غالبًا مانع CORS أو الوصول من موقع خارجي."
    );
  }

  console.log(
    "📄 HTML length:",
    html.length
  );

  const images =
    extractFromHtml(
      html,
      url.href
    );

  console.log(
    "🖼️ Images found:",
    images.length
  );

  return {
    success: true,

    source:
      url.hostname,

    chapterUrl:
      url.href,

    count:
      images.length,

    images
  };
}


// ======================================================
// UI HELPER
// ======================================================

function setExtractorStatus(
  message,
  type = "info"
) {
  const status =
    document.getElementById(
      "extract-status"
    );

  if (!status) {
    return;
  }

  status.textContent =
    message;

  status.dataset.type =
    type;
}


// ======================================================
// RENDER RESULTS
// ======================================================

function renderImages(result) {
  const container =
    document.getElementById(
      "extract-results"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!result.images.length) {

    container.innerHTML = `
      <div class="extract-empty">
        لم يتم العثور على صور في الفصل
      </div>
    `;

    return;
  }

  const fragment =
    document.createDocumentFragment();

  result.images.forEach(
    (url, index) => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "extract-image";

      item.innerHTML = `
        <span class="extract-number">
          ${index + 1}
        </span>

        <a
          href="${escapeHtml(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(url)}
        </a>
      `;

      fragment.appendChild(item);
    }
  );

  container.appendChild(
    fragment
  );
}


// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ======================================================
// COPY RESULTS
// ======================================================

async function copyImages() {
  const container =
    document.getElementById(
      "extract-results"
    );

  if (!container) {
    return;
  }

  const links =
    [...container.querySelectorAll("a")]
      .map(a => a.href);

  if (!links.length) {
    return;
  }

  try {

    await navigator.clipboard.writeText(
      links.join("\n")
    );

    setExtractorStatus(
      `تم نسخ ${links.length} رابط`,
      "success"
    );

  } catch {

    setExtractorStatus(
      "فشل نسخ الروابط",
      "error"
    );
  }
}


// ======================================================
// DOWNLOAD JSON
// ======================================================

function downloadResult(result) {
  const blob =
    new Blob(
      [
        JSON.stringify(
          result,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href =
    url;

  a.download =
    "chapter-images.json";

  a.click();

  URL.revokeObjectURL(url);
}


// ======================================================
// INIT
// ======================================================

function initExtractor() {

  const form =
    document.getElementById(
      "extract-form"
    );

  const input =
    document.getElementById(
      "chapter-url"
    );

  const button =
    document.getElementById(
      "extract-button"
    );

  const copyButton =
    document.getElementById(
      "copy-images"
    );

  const downloadButton =
    document.getElementById(
      "download-json"
    );

  if (!form || !input || !button) {
    console.warn(
      "⚠️ Extractor UI not found"
    );

    return;
  }

  let lastResult = null;

  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const chapterUrl =
        input.value.trim();

      if (!chapterUrl) {

        setExtractorStatus(
          "اكتب رابط الفصل أولًا",
          "error"
        );

        return;
      }

      button.disabled =
        true;

      button.textContent =
        "جاري الاستخراج...";

      setExtractorStatus(
        "جاري فتح الفصل من المتصفح...",
        "loading"
      );

      if (copyButton) {
        copyButton.disabled = true;
      }

      if (downloadButton) {
        downloadButton.disabled = true;
      }

      try {

        const result =
          await extractChapterImages(
            chapterUrl
          );

        lastResult =
          result;

        renderImages(
          result
        );

        if (result.count > 0) {

          setExtractorStatus(
            `تم استخراج ${result.count} صورة بنجاح`,
            "success"
          );

          if (copyButton) {
            copyButton.disabled =
              false;
          }

          if (downloadButton) {
            downloadButton.disabled =
              false;
          }

        } else {

          setExtractorStatus(
            "الصفحة اشتغلت لكن لم يتم العثور على صور",
            "error"
          );
        }

      } catch (error) {

        console.error(
          "❌ Extraction failed:",
          error
        );

        setExtractorStatus(
          error.message ||
          "حدث خطأ أثناء الاستخراج",
          "error"
        );

      } finally {

        button.disabled =
          false;

        button.textContent =
          "استخراج الصور";
      }
    }
  );


  if (copyButton) {

    copyButton.addEventListener(
      "click",
      copyImages
    );
  }


  if (downloadButton) {

    downloadButton.addEventListener(
      "click",
      () => {

        if (lastResult) {
          downloadResult(
            lastResult
          );
        }
      }
    );
  }
}


// ======================================================
// START
// ======================================================

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initExtractor
  );

} else {

  initExtractor();
}


// Optional global API
window.MangaExtractor = {
  extractChapterImages,
  extractFromHtml
};