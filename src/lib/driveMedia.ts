/**
 * Google Shared Drive photo and video upload helpers for BCC News Feed
 */

import { authFetch } from './db';

/**
 * Uploads a video directly to the shared Google Drive folder (0AGPGJ8Knm3Y7Uk9PVA)
 */
export async function uploadVideoToSharedDrive(
  fileOrBase64: File | string,
  riderName?: string,
  folderId: string = '0AGPGJ8Knm3Y7Uk9PVA',
  onProgress?: (progressText: string) => void
): Promise<{ url: string; fileId?: string; webViewLink?: string }> {
  onProgress?.('Preparing video for Club Cloud Storage...');
  let base64String = '';

  if (typeof fileOrBase64 === 'string') {
    base64String = fileOrBase64;
  } else {
    base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  }

  onProgress?.('Uploading video to Club Shared Drive...');

  try {
    const res = await authFetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64String,
        fileName: `video_${Date.now()}.mp4`,
        folder: 'feed',
        riderName: riderName || 'rider',
        folderId,
      }),
    });

    const data = await res.json();
    if (!res.ok || (!data.url && !data.success)) {
      return { url: base64String };
    }

    return {
      url: data.url || base64String,
      fileId: data.fileId,
      webViewLink: data.webViewLink,
    };
  } catch (e) {
    return { url: base64String };
  }
}

/**
 * Uploads a photo to the shared Google Drive folder (0AGPGJ8Knm3Y7Uk9PVA)
 */
export async function uploadPhotoToSharedDrive(
  fileOrBase64: File | string,
  riderName?: string,
  folderId: string = '0AGPGJ8Knm3Y7Uk9PVA',
  onProgress?: (progressText: string) => void
): Promise<{ url: string; fileId?: string; webViewLink?: string }> {
  onProgress?.('Optimizing photo...');
  let base64String = '';

  if (typeof fileOrBase64 === 'string') {
    base64String = fileOrBase64;
  } else {
    // Compress and scale before upload for optimal transfer
    base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDimension = 1920; // Crisp high-resolution photo
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  }

  onProgress?.('Uploading to Google Shared Drive...');

  const res = await authFetch('/api/drive/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64String,
      folder: 'feed',
      riderName: riderName || 'rider',
      folderId,
    }),
  });

  const data = await res.json();
  if (!res.ok || (!data.url && !data.success)) {
    throw new Error(data.error || 'Failed to upload photo to Google Drive');
  }

  return {
    url: data.url || base64String,
    fileId: data.fileId,
    webViewLink: data.webViewLink,
  };
}
