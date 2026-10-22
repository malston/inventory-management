import { describe, it, expect } from 'vitest'
import { parseDate } from './date'

describe('parseDate', () => {
  it('reads a date-only string as local midnight', () => {
    const date = parseDate('2026-10-22')
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 9, 22
    ])
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0])
  })

  it('leaves strings with a time component to Date', () => {
    const date = parseDate('2025-09-30T10:30:00')
    expect([date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      8, 30, 10
    ])
  })

  it('returns an invalid Date for unparseable input', () => {
    expect(isNaN(parseDate('not a date').getTime())).toBe(true)
  })
})
