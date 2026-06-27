import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { LocalStorageProvider } from '@/lib/storage/local'
import { S3StorageProvider } from '@/lib/storage/s3'
import { createStorageProvider } from '@/lib/storage'

const sendMock = vi.fn()
function MockS3Client() {
  return { send: sendMock }
}
function MockPutObjectCommand(input: unknown) {
  return { ...(input as object), _type: 'PutObject' }
}
function MockDeleteObjectCommand(input: unknown) {
  return { ...(input as object), _type: 'DeleteObject' }
}

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  PutObjectCommand: MockPutObjectCommand,
  DeleteObjectCommand: MockDeleteObjectCommand,
}))

const TEST_DIR = path.join(process.cwd(), 'tmp', 'test-uploads')

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

describe('LocalStorageProvider', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it('uploads a file and returns a storage key', async () => {
    const provider = new LocalStorageProvider({
      baseDir: TEST_DIR,
      baseUrl: '/uploads',
    })

    const buffer = Buffer.from('hello world')
    const key = await provider.upload(buffer, {
      fileName: 'test.txt',
      mimeType: 'text/plain',
      requirementId: 'req-123',
    })

    expect(key.startsWith('req-123/')).toBe(true)
    expect(key.endsWith('-test.txt')).toBe(true)

    const filePath = path.join(TEST_DIR, key)
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('hello world')
  })

  it('returns a public URL for a storage key', async () => {
    const provider = new LocalStorageProvider({
      baseDir: TEST_DIR,
      baseUrl: '/uploads',
    })

    const url = provider.getPublicUrl('req-123/file.png')
    expect(url).toBe('/uploads/req-123/file.png')
  })

  it('deletes a stored file', async () => {
    const provider = new LocalStorageProvider({
      baseDir: TEST_DIR,
      baseUrl: '/uploads',
    })

    const key = await provider.upload(Buffer.from('data'), {
      fileName: 'delete.me',
      mimeType: 'text/plain',
      requirementId: 'req-123',
    })

    await provider.delete(key)

    await expect(fs.access(path.join(TEST_DIR, key))).rejects.toThrow()
  })

  it('sanitizes file names with special characters', async () => {
    const provider = new LocalStorageProvider({
      baseDir: TEST_DIR,
      baseUrl: '/uploads',
    })

    const key = await provider.upload(Buffer.from('data'), {
      fileName: 'hello world/../evil.txt',
      mimeType: 'text/plain',
      requirementId: 'req-123',
    })

    expect(key.includes('..')).toBe(false)
    expect(key.includes(' ')).toBe(false)
  })
})

describe('S3StorageProvider', () => {
  beforeEach(() => {
    sendMock.mockReset()
  })

  it('uploads a file to S3 and returns the storage key', async () => {
    const provider = new S3StorageProvider({
      bucket: 'easyreq-uploads',
      region: 'ap-east-1',
    })

    const key = await provider.upload(Buffer.from('image data'), {
      fileName: 'screenshot.png',
      mimeType: 'image/png',
      requirementId: 'req-456',
    })

    expect(key.startsWith('requirements/req-456/')).toBe(true)
    expect(key.endsWith('-screenshot.png')).toBe(true)
    expect(sendMock).toHaveBeenCalledTimes(1)
    const command = sendMock.mock.calls[0][0]
    expect(command.Bucket).toBe('easyreq-uploads')
    expect(command.ContentType).toBe('image/png')
  })

  it('returns a public URL using the configured public URL', () => {
    const provider = new S3StorageProvider({
      bucket: 'easyreq-uploads',
      region: 'ap-east-1',
      publicUrl: 'https://cdn.example.com',
    })

    const url = provider.getPublicUrl('requirements/req-456/file.png')
    expect(url).toBe('https://cdn.example.com/requirements/req-456/file.png')
  })

  it('returns default S3 URL when no public URL is configured', () => {
    const provider = new S3StorageProvider({
      bucket: 'easyreq-uploads',
      region: 'ap-east-1',
    })

    const url = provider.getPublicUrl('requirements/req-456/file.png')
    expect(url).toBe('https://easyreq-uploads.s3.amazonaws.com/requirements/req-456/file.png')
  })

  it('deletes a file from S3', async () => {
    const provider = new S3StorageProvider({
      bucket: 'easyreq-uploads',
      region: 'ap-east-1',
    })

    await provider.delete('requirements/req-456/file.png')

    expect(sendMock).toHaveBeenCalledTimes(1)
    const command = sendMock.mock.calls[0][0]
    expect(command.Bucket).toBe('easyreq-uploads')
    expect(command.Key).toBe('requirements/req-456/file.png')
  })
})

describe('createStorageProvider', () => {
  it('creates a local provider by default', () => {
    const provider = createStorageProvider()
    expect(provider).toBeInstanceOf(LocalStorageProvider)
  })

  it('creates a local provider when STORAGE_PROVIDER=local', () => {
    const provider = createStorageProvider('local')
    expect(provider).toBeInstanceOf(LocalStorageProvider)
  })

  it('creates an S3 provider when STORAGE_PROVIDER=s3', () => {
    const provider = createStorageProvider('s3')
    expect(provider).toBeInstanceOf(S3StorageProvider)
  })

  it('throws for unsupported providers', () => {
    expect(() => createStorageProvider('unknown' as never)).toThrow(
      'Unsupported storage provider: unknown',
    )
  })
})
