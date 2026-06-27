import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import type { StorageProvider, StorageUploadOptions, DownloadTarget } from './types'

export interface S3StorageConfig {
  bucket: string
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  endpoint?: string
  publicUrl?: string
  forcePathStyle?: boolean
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/\.\./g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client
  private bucket: string
  private publicUrl?: string

  constructor(config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? !!config.endpoint,
    })
    this.bucket = config.bucket
    this.publicUrl = config.publicUrl
  }

  async upload(
    file: Buffer,
    options: StorageUploadOptions,
  ): Promise<string> {
    const random = crypto.randomBytes(8).toString('hex')
    const safeName = sanitizeFileName(options.fileName) || 'file'
    const key = `requirements/${options.requirementId}/${random}-${safeName}`

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: options.mimeType,
      }),
    )

    return key
  }

  getPublicUrl(storageKey: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${storageKey}`
    }
    return `https://${this.bucket}.s3.amazonaws.com/${storageKey}`
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    )
  }

  async download(storageKey: string): Promise<DownloadTarget> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: 3600 },
    )
    return { type: 'redirect', url }
  }
}
