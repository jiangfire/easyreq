import type { StorageProvider } from './types'
import { LocalStorageProvider } from './local'
import { S3StorageProvider } from './s3'

export type StorageProviderName = 'local' | 's3'

export function createStorageProvider(
  providerName?: string,
): StorageProvider {
  const name = providerName ?? process.env.STORAGE_PROVIDER ?? 'local'

  switch (name) {
    case 'local':
      return new LocalStorageProvider({
        baseDir: process.env.STORAGE_LOCAL_DIR ?? 'public/uploads',
        baseUrl: process.env.STORAGE_LOCAL_BASE_URL ?? '/uploads',
      })
    case 's3':
      return new S3StorageProvider({
        bucket: process.env.S3_BUCKET ?? '',
        region: process.env.S3_REGION ?? 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        endpoint: process.env.S3_ENDPOINT,
        publicUrl: process.env.S3_PUBLIC_URL,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      })
    default:
      throw new Error(`Unsupported storage provider: ${name}`)
  }
}

export function getAttachmentPublicUrl(
  storageProvider: 'LOCAL' | 'S3',
  storageKey: string,
): string {
  const provider = createStorageProvider(
    storageProvider === 'S3' ? 's3' : 'local',
  )
  return provider.getPublicUrl(storageKey)
}
