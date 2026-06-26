import { describe, it, expect } from 'vitest'
import {
  canTransition,
  isQuickPathTransition,
  hasTransitionPermission,
  getAvailableTransitions,
  type ReqStatus,
} from '@/lib/transitions'

describe('canTransition', () => {
  describe('standard path (forward)', () => {
    it('allows SUBMITTED → UNDER_REVIEW', () => {
      expect(canTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true)
    })
    it('allows UNDER_REVIEW → PLANNED', () => {
      expect(canTransition('UNDER_REVIEW', 'PLANNED')).toBe(true)
    })
    it('allows UNDER_REVIEW → REJECTED', () => {
      expect(canTransition('UNDER_REVIEW', 'REJECTED')).toBe(true)
    })
    it('allows PLANNED → IN_DEVELOPMENT', () => {
      expect(canTransition('PLANNED', 'IN_DEVELOPMENT')).toBe(true)
    })
    it('allows IN_DEVELOPMENT → IN_TESTING', () => {
      expect(canTransition('IN_DEVELOPMENT', 'IN_TESTING')).toBe(true)
    })
    it('allows IN_TESTING → DELIVERED', () => {
      expect(canTransition('IN_TESTING', 'DELIVERED')).toBe(true)
    })
    it('allows DELIVERED → ACCEPTED', () => {
      expect(canTransition('DELIVERED', 'ACCEPTED')).toBe(true)
    })
    it('allows REJECTED → SUBMITTED (resubmit)', () => {
      expect(canTransition('REJECTED', 'SUBMITTED')).toBe(true)
    })
  })

  describe('retreat paths', () => {
    it('allows PLANNED → REJECTED', () => {
      expect(canTransition('PLANNED', 'REJECTED')).toBe(true)
    })
    it('allows IN_TESTING → IN_DEVELOPMENT (bugs found)', () => {
      expect(canTransition('IN_TESTING', 'IN_DEVELOPMENT')).toBe(true)
    })
    it('allows DELIVERED → IN_DEVELOPMENT (not accepted)', () => {
      expect(canTransition('DELIVERED', 'IN_DEVELOPMENT')).toBe(true)
    })
    it('allows ACCEPTED → IN_DEVELOPMENT (reopen)', () => {
      expect(canTransition('ACCEPTED', 'IN_DEVELOPMENT')).toBe(true)
    })
  })

  describe('quick path (Manager/Admin skip)', () => {
    it('allows SUBMITTED → PLANNED (skip review)', () => {
      expect(canTransition('SUBMITTED', 'PLANNED')).toBe(true)
    })
    it('allows SUBMITTED → IN_DEVELOPMENT (skip review+plan)', () => {
      expect(canTransition('SUBMITTED', 'IN_DEVELOPMENT')).toBe(true)
    })
    it('allows IN_DEVELOPMENT → DELIVERED (skip testing)', () => {
      expect(canTransition('IN_DEVELOPMENT', 'DELIVERED')).toBe(true)
    })
  })

  describe('forbidden transitions', () => {
    it('forbids SUBMITTED → ACCEPTED (too far jump)', () => {
      expect(canTransition('SUBMITTED', 'ACCEPTED')).toBe(false)
    })
    it('forbids SUBMITTED → DELIVERED', () => {
      expect(canTransition('SUBMITTED', 'DELIVERED')).toBe(false)
    })
    it('forbids UNDER_REVIEW → ACCEPTED', () => {
      expect(canTransition('UNDER_REVIEW', 'ACCEPTED')).toBe(false)
    })
    it('forbids PLANNED → ACCEPTED', () => {
      expect(canTransition('PLANNED', 'ACCEPTED')).toBe(false)
    })
    it('forbids PLANNED → DELIVERED', () => {
      expect(canTransition('PLANNED', 'DELIVERED')).toBe(false)
    })
    it('forbids ACCEPTED → REJECTED', () => {
      expect(canTransition('ACCEPTED', 'REJECTED')).toBe(false)
    })
    it('forbids REJECTED → ACCEPTED', () => {
      expect(canTransition('REJECTED', 'ACCEPTED')).toBe(false)
    })
    it('forbids same-state transition', () => {
      const states: ReqStatus[] = [
        'SUBMITTED', 'UNDER_REVIEW', 'PLANNED', 'IN_DEVELOPMENT',
        'IN_TESTING', 'DELIVERED', 'ACCEPTED', 'REJECTED',
      ]
      for (const s of states) {
        expect(canTransition(s, s)).toBe(false)
      }
    })
  })
})

describe('isQuickPathTransition', () => {
  it('returns false for adjacent standard transitions', () => {
    expect(isQuickPathTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(false)
    expect(isQuickPathTransition('UNDER_REVIEW', 'PLANNED')).toBe(false)
    expect(isQuickPathTransition('PLANNED', 'IN_DEVELOPMENT')).toBe(false)
  })
  it('returns true for quick path skips', () => {
    expect(isQuickPathTransition('SUBMITTED', 'PLANNED')).toBe(true)
    expect(isQuickPathTransition('SUBMITTED', 'IN_DEVELOPMENT')).toBe(true)
    expect(isQuickPathTransition('IN_DEVELOPMENT', 'DELIVERED')).toBe(true)
  })
  it('returns false for retreat paths (not quick path)', () => {
    expect(isQuickPathTransition('IN_TESTING', 'IN_DEVELOPMENT')).toBe(false)
    expect(isQuickPathTransition('DELIVERED', 'IN_DEVELOPMENT')).toBe(false)
    expect(isQuickPathTransition('ACCEPTED', 'IN_DEVELOPMENT')).toBe(false)
  })
})

describe('hasTransitionPermission', () => {
  describe('ADMIN (superuser)', () => {
    it('allows all legal transitions', () => {
      const cases: Array<[ReqStatus, ReqStatus]> = [
        ['SUBMITTED', 'UNDER_REVIEW'],
        ['SUBMITTED', 'IN_DEVELOPMENT'],
        ['PLANNED', 'REJECTED'],
        ['ACCEPTED', 'IN_DEVELOPMENT'],
      ]
      for (const [from, to] of cases) {
        expect(hasTransitionPermission(from, to, 'ADMIN')).toBe(true)
      }
    })
  })

  describe('MANAGER', () => {
    it('allows standard forward transitions', () => {
      expect(hasTransitionPermission('SUBMITTED', 'UNDER_REVIEW', 'MANAGER')).toBe(true)
      expect(hasTransitionPermission('UNDER_REVIEW', 'PLANNED', 'MANAGER')).toBe(true)
    })
    it('allows quick path transitions', () => {
      expect(hasTransitionPermission('SUBMITTED', 'IN_DEVELOPMENT', 'MANAGER')).toBe(true)
    })
    it('allows reject', () => {
      expect(hasTransitionPermission('UNDER_REVIEW', 'REJECTED', 'MANAGER')).toBe(true)
      expect(hasTransitionPermission('PLANNED', 'REJECTED', 'MANAGER')).toBe(true)
    })
    it('allows reopen', () => {
      expect(hasTransitionPermission('ACCEPTED', 'IN_DEVELOPMENT', 'MANAGER')).toBe(true)
    })
    it('allows accept', () => {
      expect(hasTransitionPermission('DELIVERED', 'ACCEPTED', 'MANAGER')).toBe(true)
    })
  })

  describe('DEVELOPER', () => {
    it('allows IN_DEVELOPMENT → IN_TESTING', () => {
      expect(hasTransitionPermission('IN_DEVELOPMENT', 'IN_TESTING', 'DEVELOPER')).toBe(true)
    })
    it('allows IN_TESTING → IN_DEVELOPMENT (retreat)', () => {
      expect(hasTransitionPermission('IN_TESTING', 'IN_DEVELOPMENT', 'DEVELOPER')).toBe(true)
    })
    it('allows IN_TESTING → DELIVERED', () => {
      expect(hasTransitionPermission('IN_TESTING', 'DELIVERED', 'DEVELOPER')).toBe(true)
    })
    it('forbids review transitions', () => {
      expect(hasTransitionPermission('SUBMITTED', 'UNDER_REVIEW', 'DEVELOPER')).toBe(false)
      expect(hasTransitionPermission('UNDER_REVIEW', 'REJECTED', 'DEVELOPER')).toBe(false)
    })
    it('forbids quick path', () => {
      expect(hasTransitionPermission('SUBMITTED', 'IN_DEVELOPMENT', 'DEVELOPER')).toBe(false)
    })
    it('forbids accept', () => {
      expect(hasTransitionPermission('DELIVERED', 'ACCEPTED', 'DEVELOPER')).toBe(false)
    })
  })

  describe('SUBMITTER', () => {
    it('allows REJECTED → SUBMITTED (resubmit)', () => {
      expect(hasTransitionPermission('REJECTED', 'SUBMITTED', 'SUBMITTER')).toBe(true)
    })
    it('allows DELIVERED → ACCEPTED (accept delivery)', () => {
      expect(hasTransitionPermission('DELIVERED', 'ACCEPTED', 'SUBMITTER')).toBe(true)
    })
    it('forbids review transitions', () => {
      expect(hasTransitionPermission('SUBMITTED', 'UNDER_REVIEW', 'SUBMITTER')).toBe(false)
    })
    it('forbids development transitions', () => {
      expect(hasTransitionPermission('IN_DEVELOPMENT', 'IN_TESTING', 'SUBMITTER')).toBe(false)
    })
    it('forbids quick path', () => {
      expect(hasTransitionPermission('SUBMITTED', 'IN_DEVELOPMENT', 'SUBMITTER')).toBe(false)
    })
    it('forbids reject', () => {
      expect(hasTransitionPermission('UNDER_REVIEW', 'REJECTED', 'SUBMITTER')).toBe(false)
    })
  })
})

describe('getAvailableTransitions', () => {
  it('returns available targets for SUBMITTED as MANAGER', () => {
    const targets = getAvailableTransitions('SUBMITTED', 'MANAGER')
    expect(targets).toContain('UNDER_REVIEW')
    expect(targets).toContain('PLANNED')
    expect(targets).toContain('IN_DEVELOPMENT')
    expect(targets).not.toContain('ACCEPTED')
    expect(targets).not.toContain('REJECTED')
  })

  it('returns available targets for SUBMITTED as SUBMITTER', () => {
    const targets = getAvailableTransitions('SUBMITTED', 'SUBMITTER')
    expect(targets).toEqual([])
  })

  it('returns available targets for DELIVERED as SUBMITTER', () => {
    const targets = getAvailableTransitions('DELIVERED', 'SUBMITTER')
    expect(targets).toContain('ACCEPTED')
  })

  it('returns empty for ACCEPTED as SUBMITTER (no reopen permission)', () => {
    const targets = getAvailableTransitions('ACCEPTED', 'SUBMITTER')
    expect(targets).toEqual([])
  })
})
