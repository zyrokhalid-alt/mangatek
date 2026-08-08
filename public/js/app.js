"use strict";

/*
|--------------------------------------------------------------------------
| MangaVault Extractor
|--------------------------------------------------------------------------
| الصفحة:
| /convert-manga-to-pdf.html
|
| API:
| /api/extract
|--------------------------------------------------------------------------
*/


document.addEventListener("DOMContentLoaded", () => {

    console.log("🔥 MangaVault Extractor Loaded");


    // ============================================================
    // Elements
    // ============================================================

    const form = document.getElementById("extract-form");

    const urlInput = document.getElementById("chapter-url");

    const extractBtn = document.getElementById("extract-btn");

    const loadingBox = document.getElementById("extract-loading");

    const resultsBox = document.getElementById("extract-results");

    const errorBox = document.getElementById("extract-error");

    const errorMessage = document.getElementById("error-message");

    const resultCount = document.getElementById("result-count");

    const downloadBtn = document.getElementById("download-btn");

    const viewBtn = document.getElementById("view-btn");

    const retryBtn = document.getElementById("retry-btn");

    const gallery = document.getElementById("results-gallery");

    const previewContainer =
        document.getElementById("preview-container");

    const downloadStatus =
        document.getElementById("download-status");


    // ============================================================
    // State
    // ============================================================

    let extractedImages = [];

    let currentChapterUrl = "";


    // ============================================================
    // Helpers
    // ============================================================

    function show(element) {

        if (!element) return;

        element.classList.remove("hidden");
    }


    function hide(element) {

        if (!element) return;

        element.classList.add("hidden");
    }


    function setButtonLoading(button, loading, text) {

        if (!button) return;

        if (loading) {

            button.disabled = true;

            button.dataset.originalText =
                button.textContent.trim();

            button.textContent = text || "جاري المعالجة...";

        } else {

            button.disabled = false;

            if (button.dataset.originalText) {

                button.textContent =
                    button.dataset.originalText;

            }

        }

    }


    function resetUI() {

        hide(resultsBox);

        hide(errorBox);

        hide(loadingBox);

        hide(previewContainer);

        hide(downloadStatus);

        if (gallery) {

            gallery.innerHTML = "";

        }

        if (errorMessage) {

            errorMessage.textContent = "";

        }

        if (downloadStatus) {

            downloadStatus.textContent = "";

        }

    }


    function showError(message) {

        hide(loadingBox);

        hide(resultsBox);

        show(errorBox);

        if (errorMessage) {

            errorMessage.textContent =
                message || "حدث خطأ غير معروف.";

        }

    }


    // ============================================================
    // Validate URL
    // ============================================================

    function validateChapterUrl(value) {

        try {

            const url = new URL(value);

            if (
                url.protocol !== "http:" &&
                url.protocol !== "https:"
            ) {

                return false;
            }

            return true;

        } catch {

            return false;
        }

    }


    // ============================================================
    // Extract Images
    // ============================================================

    async function extractImages(chapterUrl) {

        resetUI();

        show(loadingBox);

        extractBtn.disabled = true;


        try {

            console.log(
                "📡 Extracting:",
                chapterUrl
            );


            const response = await fetch(
                "/api/extract",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        chapterUrl: chapterUrl
                    })
                }
            );


            let data;


            try {

                data = await response.json();

            } catch {

                throw new Error(
                    "الخادم رجع استجابة غير صالحة."
                );

            }


            console.log(
                "📦 API Response:",
                data
            );


            if (!response.ok || !data.success) {

                throw new Error(
                    data.error ||
                    "فشل استخراج صور الفصل."
                );

            }


            if (
                !Array.isArray(data.images) ||
                data.images.length === 0
            ) {

                throw new Error(
                    "لم يتم العثور على صور في هذا الفصل."
                );

            }


            // Save state

            extractedImages = data.images;

            currentChapterUrl = chapterUrl;


            // Update count

            if (resultCount) {

                resultCount.innerHTML =
                    `وجدنا <strong>${extractedImages.length}</strong> صورة`;

            }


            hide(loadingBox);

            hide(errorBox);

            show(resultsBox);


            console.log(
                `✅ Extracted ${extractedImages.length} images`
            );


        } catch (error) {

            console.error(
                "❌ Extract Error:",
                error
            );

            showError(
                error.message ||
                "حدث خطأ أثناء استخراج الصور."
            );

        } finally {

            extractBtn.disabled = false;

        }

    }


    // ============================================================
    // Form Submit
    // ============================================================

    if (form) {

        form.addEventListener(
            "submit",
            async (event) => {

                // مهم جدًا
                event.preventDefault();

                event.stopPropagation();


                const value =
                    urlInput
                        ? urlInput.value.trim()
                        : "";


                if (!value) {

                    showError(
                        "من فضلك أدخل رابط الفصل."
                    );

                    return;

                }


                if (!validateChapterUrl(value)) {

                    showError(
                        "رابط الفصل غير صالح."
                    );

                    return;

                }


                await extractImages(value);

            }
        );

    }


    // ============================================================
    // Download Images
    // ============================================================

    async function downloadImages() {

        if (
            !Array.isArray(extractedImages) ||
            extractedImages.length === 0
        ) {

            showError(
                "لا توجد صور للتحميل. استخرج الفصل أولًا."
            );

            return;

        }


        console.log(
            `⬇️ Starting download of ${extractedImages.length} images`
        );


        downloadBtn.disabled = true;


        show(downloadStatus);

        downloadStatus.textContent =
            `جاري تجهيز ${extractedImages.length} صورة...`;


        let successCount = 0;

        let failedCount = 0;


        try {

            for (
                let i = 0;
                i < extractedImages.length;
                i++
            ) {

                const imageUrl =
                    extractedImages[i];


                downloadStatus.textContent =
                    `جاري تحميل الصورة ${i + 1} من ${extractedImages.length}...`;


                try {

                    await downloadSingleImage(
                        imageUrl,
                        i + 1
                    );

                    successCount++;


                } catch (error) {

                    console.warn(
                        `⚠️ Failed image ${i + 1}:`,
                        error
                    );

                    failedCount++;

                }


                // تأخير صغير عشان مانضربش السيرفر
                await sleep(150);

            }


            if (failedCount === 0) {

                downloadStatus.textContent =
                    `✅ تم تحميل ${successCount} صورة بنجاح.`;

            } else {

                downloadStatus.textContent =
                    `تم تحميل ${successCount} صورة، وفشل تحميل ${failedCount} صورة.`;

            }


        } finally {

            downloadBtn.disabled = false;

        }

    }


    // ============================================================
    // Single Image Download
    // ============================================================

    async function downloadSingleImage(
        imageUrl,
        index
    ) {

        const response = await fetch(
            imageUrl
        );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const blob =
            await response.blob();


        const blobUrl =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = blobUrl;


        link.download =
            `manga-page-${String(index).padStart(3, "0")}.webp`;


        link.style.display = "none";


        document.body.appendChild(link);


        link.click();


        link.remove();


        setTimeout(
            () => URL.revokeObjectURL(blobUrl),
            1000
        );

    }


    // ============================================================
    // Preview
    // ============================================================

    function showPreview() {

        if (
            !Array.isArray(extractedImages) ||
            extractedImages.length === 0
        ) {

            showError(
                "لا توجد صور للمعاينة."
            );

            return;

        }


        gallery.innerHTML = "";


        extractedImages.forEach(
            (imageUrl, index) => {

                const img =
                    document.createElement("img");


                img.loading = "lazy";


                img.alt =
                    `صفحة ${index + 1}`;


                img.src =
                    imageUrl;


                img.addEventListener(
                    "error",
                    () => {

                        img.style.opacity =
                            "0.3";

                    }
                );


                gallery.appendChild(img);

            }
        );


        show(previewContainer);


        // نروح للمعاينة بدل ما الصفحة تعمل refresh
        setTimeout(() => {

            previewContainer.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }, 100);

    }


    // ============================================================
    // Buttons
    // ============================================================

    if (downloadBtn) {

        downloadBtn.addEventListener(
            "click",
            async (event) => {

                event.preventDefault();

                event.stopPropagation();

                await downloadImages();

            }
        );

    }


    if (viewBtn) {

        viewBtn.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                event.stopPropagation();

                showPreview();

            }
        );

    }


    if (retryBtn) {

        retryBtn.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                event.stopPropagation();


                hide(errorBox);


                if (urlInput) {

                    urlInput.focus();

                }

            }
        );

    }


    // ============================================================
    // Utility
    // ============================================================

    function sleep(ms) {

        return new Promise(
            resolve => setTimeout(resolve, ms)
        );

    }


    // ============================================================
    // Expose resetForm for compatibility
    // ============================================================

    window.resetForm = function () {

        resetUI();

        extractedImages = [];

        currentChapterUrl = "";

        if (urlInput) {

            urlInput.value = "";

            urlInput.focus();

        }

    };


});