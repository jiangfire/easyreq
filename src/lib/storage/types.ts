export interface StorageUploadOptions {
  fileName: string
  mimeType: string
  requirementId: string
}

export type DownloadTarget =
  | { type: 'stream'; body: Buffer; mimeType?: string }
  | { type: 'redirect'; url: string }

export interface StorageProvider {
  upload(file: Buffer, options: StorageUploadOptions): Promise<string>
  getPublicUrl(storageKey: string): string
  delete(storageKey: string): Promise<void>
  download(storageKey: string): Promise<DownloadTarget>
}
