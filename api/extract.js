// ======================================================
// VERCEL EXTRACT FUNCTION - TEST VERSION
// ======================================================

console.log("🔥 EXTRACT.JS LOADED");

export default function handler(req, res) {
  console.log("🔥 EXTRACT FUNCTION CALLED");
  console.log("📥 METHOD:", req.method);

  // ====================================================
  // CORS
  // ====================================================

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // ====================================================
  // OPTIONS
  // ====================================================

  if (req.method === "OPTIONS") {
    return res.status(200).json({
      success: true,
      message: "CORS OK"
    });
  }

  // ====================================================
  // TEST RESPONSE
  // ====================================================

  return res.status(200).json({
    success: true,
    message: "EXTRACT WORKS",
    method: req.method,
    timestamp: new Date().toISOString(),
    runtime: "Vercel Serverless Function"
  });
}