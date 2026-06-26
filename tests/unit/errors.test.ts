import { describe, it, expect } from 'vitest'
import { AppError, HTTP_STATUS } from '@/lib/errors'

describe('AppError', () => {
  it('creates error with correct code and message', () => {
    const err = new AppError('NOT_FOUND', 'Requirement not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Requirement not found')
    expect(err.name).toBe('AppError')
  })

  it('maps code to correct HTTP status code', () => {
    expect(new AppError('VALIDATION_ERROR', 'test').statusCode).toBe(422)
    expect(new AppError('UNAUTHORIZED', 'test').statusCode).toBe(401)
    expect(new AppError('FORBIDDEN', 'test').statusCode).toBe(403)
    expect(new AppError('NOT_FOUND', 'test').statusCode).toBe(404)
    expect(new AppError('CONFLICT', 'test').statusCode).toBe(409)
    expect(new AppError('INVALID_TRANSITION', 'test').statusCode).toBe(422)
    expect(new AppError('RATE_LIMITED', 'test').statusCode).toBe(429)
  })

  it('serializes to API error format without details', () => {
    const err = new AppError('FORBIDDEN', 'No permission')
    expect(err.toJSON()).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'No permission',
      },
    })
  })

  it('serializes to API error format with details', () => {
    const err = new AppError('VALIDATION_ERROR', 'Invalid input', {
      field: 'title',
      issue: 'required',
    })
    expect(err.toJSON()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'title', issue: 'required' },
      },
    })
  })

  it('is an instance of Error', () => {
    const err = new AppError('NOT_FOUND', 'test')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('HTTP_STATUS', () => {
  it('has a mapping for every error code', () => {
    const codes: Array<keyof typeof HTTP_STATUS> = [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'INVALID_TRANSITION',
      'RATE_LIMITED',
    ]
    for (const code of codes) {
      expect(HTTP_STATUS[code]).toBeDefined()
      expect(typeof HTTP_STATUS[code]).toBe('number')
    }
  })
})
