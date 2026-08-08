export default async function handler(req) {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "Manga Downloader API is running"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}