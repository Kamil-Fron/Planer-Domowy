// Utility to compress and downscale high-resolution images (such as iPhone camera photos)
// This reduces file sizes from 15MB+ down to ~200-400KB while preserving sharp text for OCR.

export async function compressImageBase64(
  base64OrDataUrl: string,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    // If not running in browser environment, return as-is
    if (typeof window === "undefined" || typeof Image === "undefined") {
      const clean = base64OrDataUrl.replace(/^data:[^;]+;base64,/i, "");
      resolve({ base64: clean, mimeType: "image/jpeg" });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;

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
        const clean = base64OrDataUrl.replace(/^data:[^;]+;base64,/i, "");
        resolve({ base64: clean, mimeType: "image/jpeg" });
        return;
      }

      // Fill white background (useful for transparent PNGs)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Output as optimized JPEG
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      const clean = compressedDataUrl.replace(/^data:image\/jpeg;base64,/i, "");
      resolve({ base64: clean, mimeType: "image/jpeg" });
    };

    img.onerror = () => {
      const clean = base64OrDataUrl.replace(/^data:[^;]+;base64,/i, "");
      resolve({ base64: clean, mimeType: "image/jpeg" });
    };

    img.src = base64OrDataUrl.startsWith("data:")
      ? base64OrDataUrl
      : `data:image/jpeg;base64,${base64OrDataUrl}`;
  });
}
