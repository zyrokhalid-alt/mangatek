const axios = require("axios");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SERVER = "http://localhost:3000";

const chapterUrl = process.argv[2];
const outputFile = process.argv[3] || "chapter.pdf";

if (!chapterUrl) {
  console.log("Usage:");
  console.log('node download_chapter_to_pdf.js "CHAPTER_URL" [output.pdf]');
  process.exit(1);
}

async function getImages() {
  console.log("🔍 Getting chapter images...");

  const res = await axios.post(
    `${SERVER}/api/get-images`,
    {
      chapterUrl,
    },
    {
      timeout: 30000,
    }
  );

  if (!res.data.success) {
    throw new Error("Failed to get images.");
  }

  return res.data.images;
}

async function downloadImage(url) {
  const proxy =
    `${SERVER}/api/proxy-image?` +
    `url=${encodeURIComponent(url)}` +
    `&referer=${encodeURIComponent(chapterUrl)}`;

  const response = await axios.get(proxy, {
    responseType: "arraybuffer",
    timeout: 30000,
  });

  return Buffer.from(response.data);
}

(async () => {
  try {
    const images = await getImages();

    console.log(`📖 Found ${images.length} pages`);

    const doc = new PDFDocument({
      autoFirstPage: false,
      margin: 0,
    });

    const stream = fs.createWriteStream(outputFile);
    doc.pipe(stream);

    for (let i = 0; i < images.length; i++) {
      console.log(`📥 Page ${i + 1}/${images.length}`);

      try {
        const buffer = await downloadImage(images[i]);

        const meta = await sharp(buffer).metadata();

        doc.addPage({
          size: [meta.width, meta.height],
          margin: 0,
        });

        doc.image(buffer, 0, 0, {
          width: meta.width,
          height: meta.height,
        });

      } catch (err) {
        console.log(`❌ Failed page ${i + 1}`);
      }
    }

    doc.end();

    stream.on("finish", () => {
      console.log("");
      console.log("✅ PDF Created Successfully");
      console.log(outputFile);
    });

  } catch (err) {
    console.error(err.message);
  }
})();