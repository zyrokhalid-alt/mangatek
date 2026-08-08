export default async function handler(req) {
  console.log("🔥 EXTRACT TEST START");

  return new Response(
    JSON.stringify({
      success: true,
      message: "Vercel Function is working",
      method: req.method,
      time: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}