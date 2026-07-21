import type { SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from '@/lib/config/app.config';
import { storagePaths } from '@/lib/config/storage.config';

export interface UploadedFile {
  storagePath: string;
  publicUrl: string;
}

/** Wraps Supabase Storage; the only place storage paths are generated. */
export class StorageService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly bucket: string = appConfig.storage.bucket,
  ) {}

  buildImagePath(millSlug: string, fabricCode: string, filename: string): string {
    return storagePaths.fabricImage(millSlug, fabricCode, filename);
  }

  buildDocumentPath(millSlug: string, fabricCode: string, filename: string): string {
    return storagePaths.fabricDocument(millSlug, fabricCode, filename);
  }

  async uploadImage(
    millSlug: string,
    fabricCode: string,
    filename: string,
    body: ArrayBuffer | Buffer | Blob,
    contentType: string,
  ): Promise<UploadedFile> {
    const path = this.buildImagePath(millSlug, fabricCode, filename);
    return this.upload(path, body, contentType);
  }

  async uploadDocument(
    millSlug: string,
    fabricCode: string,
    filename: string,
    body: ArrayBuffer | Buffer | Blob,
    contentType: string,
  ): Promise<UploadedFile> {
    const path = this.buildDocumentPath(millSlug, fabricCode, filename);
    return this.upload(path, body, contentType);
  }

  /** Get a public URL for a file (if bucket is public). */
  getPublicUrl(path: string): string {
    return this.db.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  /** Get a signed URL (valid for 1 hour) for a private bucket file. */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.db.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  }

  private async upload(
    path: string,
    body: ArrayBuffer | Buffer | Blob,
    contentType: string,
  ): Promise<UploadedFile> {
    const { error } = await this.db.storage
      .from(this.bucket)
      .upload(path, body, { contentType, upsert: true });
    if (error) throw error;
    // Store the permanent URL — signed URLs expire and must never be saved to the DB.
    // If the bucket is made private, switch reads to getSignedUrl(path) at render time.
    return { storagePath: path, publicUrl: this.getPublicUrl(path) };
  }
}
