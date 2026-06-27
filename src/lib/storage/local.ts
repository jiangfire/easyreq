import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import type { StorageProvider, StorageUploadOptions, DownloadTarget } from './types'

export interface LocalStorageConfig {
  baseDir: string
  baseUrl: string
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/\.\./g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string
  private baseUrl: string

  constructor(config: LocalStorageConfig) {
    this.baseDir = config.baseDir
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
  }

  async upload(
    file: Buffer,
    options: StorageUploadOptions,
  ): Promise<string> {
    const random = crypto.randomBytes(8).toString('hex')
    const safeName = sanitizeFileName(options.fileName) || 'file'
    const key = path.posix.join(
      options.requirementId,
      `${random}-${safeName}`,
    )

    const filePath = path.join(this.baseDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, file)

    return key
  }

  getPublicUrl(storageKey: string): string {
    return `${this.baseUrl}/${storageKey.replace(/\\/g, '/')}`
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = path.join(this.baseDir, storageKey)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  async download(storageKey: string): Promise<DownloadTarget> {
    const filePath = path.join(this.baseDir, storageKey)
    const body = await fs.readFile(filePath)
    return { type: 'stream', body }
  }
}
