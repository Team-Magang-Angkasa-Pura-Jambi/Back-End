// utils/uploadthing.ts
import { UTApi } from 'uploadthing/server';

const utapi = new UTApi();

export const deleteFileFromUT = async (url: string | null | undefined) => {
  if (!url?.includes('utfs.io')) {
    console.log('[UT] URL tidak valid atau bukan UploadThing link');
    return;
  }

  try {
    // Pastikan kita ambil bagian terakhir setelah slash terakhir
    // Contoh: https://utfs.io/f/867b86...png -> 867b86...png
    const fileKey = url.split('/').pop();

    if (fileKey) {
      const response = await utapi.deleteFiles(fileKey);

      if (response.success) {
        console.log(`[UT] Berhasil hapus file: ${fileKey}`);
      } else {
        console.error(`[UT] Gagal hapus file:`, response);
      }
    }
  } catch (error) {
    console.error('[UT] Error saat koneksi ke API UploadThing:', error);
  }
};
