/**
 * Fundora — Client-Side Image Compression Utility
 * Compresses identity documents and milestone evidence before upload
 * so documents remain crisp for OCR while respecting Firestore document size limits.
 */

export async function compressImageFileToDataUrl(
  file: File,
  maxDimensionPx = 1280,
  quality = 0.78
): Promise<{ dataUrl: string; sizeBytes: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read uploaded file.'));
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      // In non-browser or test environments where Image decoding doesn't fire, return directly
      if (typeof window === 'undefined' || import.meta.env.MODE === 'test') {
        resolve({
          dataUrl: resultStr || `data:${file.type || 'image/jpeg'};base64,dGVzdA==`,
          sizeBytes: file.size || resultStr.length,
          mimeType: file.type || 'image/jpeg',
        });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve({
          dataUrl: resultStr,
          sizeBytes: file.size || resultStr.length,
          mimeType: file.type || 'image/jpeg',
        });
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimensionPx || height > maxDimensionPx) {
            if (width >= height) {
              height = Math.round((height * maxDimensionPx) / width);
              width = maxDimensionPx;
            } else {
              width = Math.round((width * maxDimensionPx) / height);
              height = maxDimensionPx;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              dataUrl: resultStr,
              sizeBytes: file.size || resultStr.length,
              mimeType: file.type || 'image/jpeg',
            });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
          resolve({
            dataUrl: compressedDataUrl,
            sizeBytes: approxBytes,
            mimeType: 'image/jpeg',
          });
        } catch {
          resolve({
            dataUrl: resultStr,
            sizeBytes: file.size || resultStr.length,
            mimeType: file.type || 'image/jpeg',
          });
        }
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}
