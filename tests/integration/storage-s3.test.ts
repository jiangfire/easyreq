import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { S3StorageProvider } from '@/lib/storage/s3'

// SAFETY GUARD: refuse to run when S3 is not configured or when the bucket
// name does not look like a test bucket. Real-bucket accidents are the kind of
// bug CI must never allow to ship.
const bucket = process.env.S3_BUCKET ?? ''
const region = process.env.S3_REGION ?? 'us-east-1'
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? ''
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? ''
const endpoint = process.env.S3_ENDPOINT ?? ''
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'

if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
  throw new Error(
    'S3 environment not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, ' +
      'S3_SECRET_ACCESS_KEY, and S3_ENDPOINT before running `npm run test:s3`.',
  )
}
if (!/test/i.test(bucket)) {
  throw new Error(
    `Refusing to run S3 tests against bucket "${bucket}": bucket name must contain "test".`,
  )
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
  endpoint,
  forcePathStyle,
})

async function ensureBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

async function cleanupKey(key: string) {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch {
    // best effort
  }
}

describe('S3StorageProvider integration (real S3/MinIO)', () => {
  const provider = new S3StorageProvider({
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint,
    forcePathStyle,
  })

  beforeAll(async () => {
    await ensureBucket()
  })

  afterAll(async () => {
    // Drain anything left behind by failing tests.
    await client.destroy()
  })

  it('uploads an object and stores it under requirements/<id>/', async () => {
    const payload = Buffer.from(`hello-s3-${Date.now()}`)
    const key = await provider.upload(payload, {
      fileName: 'probe.txt',
      mimeType: 'text/plain',
      requirementId: 'req-s3-it',
    })

    expect(key.startsWith('requirements/req-s3-it/')).toBe(true)

    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    expect(head.ContentLength).toBe(payload.length)
    expect(head.ContentType).toBe('text/plain')

    await cleanupKey(key)
  })

  it('download() returns a working presigned redirect target', async () => {
    const payload = Buffer.from('presign-body')
    const key = await provider.upload(payload, {
      fileName: 'presign.txt',
      mimeType: 'text/plain',
      requirementId: 'req-s3-it',
    })

    const target = await provider.download(key)
    expect(target.type).toBe('redirect')

    if (target.type === 'redirect') {
      const url = target.url
      expect(url.startsWith(endpoint)).toBe(true)
      // The presigned URL keeps the key as a path segment; MinIO's AWS
      // signature library does not percent-encode slashes inside the path.
      // Just confirm the bucket and the key suffix are present.
      expect(url).toContain(`/${bucket}/`)
      expect(url).toContain(key.split('/').pop() ?? key)

      const res = await fetch(url)
      expect(res.ok).toBe(true)
      const body = await res.text()
      expect(body).toBe('presign-body')
    }

    await cleanupKey(key)
  })

  it('delete() removes the object from the bucket', async () => {
    const key = await provider.upload(Buffer.from('to-be-deleted'), {
      fileName: 'gone.txt',
      mimeType: 'text/plain',
      requirementId: 'req-s3-it',
    })

    await provider.delete(key)

    await expect(client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))).rejects.toThrow()
  })
})
