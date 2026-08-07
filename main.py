import io
import cloudscraper
from fastapi import FastAPI, HTTPException, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup
import img2pdf
from PIL import Image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return FileResponse("index.html")

@app.post("/download")
def download_manga_pdf(chapter_url: str = Form(...)):
    try:
        # 🟢 استخدام cloudscraper لتخطي حماية Cloudflare و Turnstile تلقائياً
        scraper = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'desktop': True
            }
        )

        # 1. فتح رابط الفصل بتخطي الحماية
        response = scraper.get(chapter_url, timeout=20)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"فشل فتح الرابط (كود: {response.status_code})")

        soup = BeautifulSoup(response.text, "html.parser")
        
        # 2. استخراج روابط الصور (بما فيها Lazy Loading)
        img_tags = soup.find_all("img")
        img_urls = []
        
        for img in img_tags:
            src = (
                img.get("data-src") or 
                img.get("data-lazy-src") or 
                img.get("data-original") or 
                img.get("src")
            )
            
            if src:
                src = src.strip().split()[0]
                if any(ext in src.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]) or "image" in src.lower():
                    if src.startswith("//"):
                        src = "https:" + src
                    elif src.startswith("/"):
                        base_domain = "/".join(chapter_url.split("/")[:3])
                        src = base_domain + src

                    # استبعاد الإعلانات واللوجو
                    is_garbage = any(x in src.lower() for x in ["logo", "banner", "avatar", "icon", "favicon"])
                    if not is_garbage and src not in img_urls:
                        img_urls.append(src)

        if not img_urls:
            raise HTTPException(status_code=404, detail="لم يتم العثور على أي صور داخل الرابط")

        print(f"✅ تم العثور على {len(img_urls)} صورة. جاري التنزيل والمعالجة...")

        # 3. تحميل الصور ومعالجة الشفافية (Alpha Channel)
        cleaned_image_bytes = []

        for idx, url in enumerate(img_urls, start=1):
            try:
                # التحميل باستخدام cloudscraper لنفس جلسة التشفير
                img_resp = scraper.get(url, timeout=12)
                if img_resp.status_code == 200:
                    img = Image.open(io.BytesIO(img_resp.content))

                    # تحويل الشفافية إلى خلفية بيضاء
                    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                        img = img.convert("RGBA")
                        background = Image.new("RGB", img.size, (255, 255, 255))
                        background.paste(img, mask=img.split()[3])
                        img = background
                    else:
                        img = img.convert("RGB")

                    output = io.BytesIO()
                    img.save(output, format="JPEG", quality=95)
                    cleaned_image_bytes.append(output.getvalue())

            except Exception as err:
                print(f"⚠️ فشل تحميل الصورة {idx}: {err}")
                continue

        if not cleaned_image_bytes:
            raise HTTPException(status_code=500, detail="فشل تنزيل ومعالجة صور الفصل")

        # 4. تحويل الصور إلى PDF
        pdf_bytes = img2pdf.convert(cleaned_image_bytes)

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=manga_chapter.pdf"}
        )

    except Exception as e:
        print("❌ خطأ:", str(e))
        raise HTTPException(status_code=500, detail=str(e))