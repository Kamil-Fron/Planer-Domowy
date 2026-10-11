// Utility to compress and downscale high-resolution images (such as iPhone camera photos)
// This reduces file sizes from 15MB+ down to ~150-300KB while preserving sharp text for OCR.

export function extractRawBase64(base64OrDataUrl: string): string {
  if (!base64OrDataUrl) return "";
  // Strip any data URI prefix: data:image/...;base64, or data:application/pdf;base64,
  return base64OrDataUrl.replace(/^data:[^;]+;base64,/i, "").replace(/\s+/g, "").trim();
}

export async function compressImageBase64(
  base64OrDataUrl: string,
  maxWidth = 1400,
  maxHeight = 1400,
  quality = 0.8
): Promise<{ base64: string; mimeType: string }> {
  const fallbackClean = extractRawBase64(base64OrDataUrl);

  return new Promise((resolve) => {
    // If not running in browser environment, return as-is
    if (typeof window === "undefined" || typeof Image === "undefined") {
      resolve({ base64: fallbackClean, mimeType: "image/jpeg" });
      return;
    }

    // Safety timeout: Never hang image compression (max 3.5s)
    let isSettled = false;
    const safetyTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        console.warn("Kompresja obrazu przekroczyła limit 3.5s - używam oryginalnego obrazu.");
        resolve({ base64: fallbackClean, mimeType: "image/jpeg" });
      }
    }, 3500);

    const finish = (result: { base64: string; mimeType: string }) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(safetyTimer);
        resolve(result);
      }
    };

    const img = new Image();
    // Do NOT set crossOrigin on data: URIs as WebKit/Safari can fail or hang
    img.onload = () => {
      try {
        let { width, height } = img;

        if (width === 0 || height === 0) {
          finish({ base64: fallbackClean, mimeType: "image/jpeg" });
          return;
        }

        // Calculate aspect-ratio-preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          finish({ base64: fallbackClean, mimeType: "image/jpeg" });
          return;
        }

        // Fill white background (useful for transparent PNGs)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Output as optimized JPEG
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        const clean = extractRawBase64(compressedDataUrl);
        finish({ base64: clean, mimeType: "image/jpeg" });
      } catch (err) {
        console.warn("Błąd podczas rysowania na canvas:", err);
        finish({ base64: fallbackClean, mimeType: "image/jpeg" });
      }
    };

    img.onerror = () => {
      console.warn("Błąd ładowania obrazu do kompresji - używam oryginału.");
      finish({ base64: fallbackClean, mimeType: "image/jpeg" });
    };

    img.src = base64OrDataUrl.startsWith("data:")
      ? base64OrDataUrl
      : `data:image/jpeg;base64,${base64OrDataUrl}`;
  });
}
