import { describe, it, expect, beforeEach } from 'vitest'
import { seedBasics } from '../../__tests__/fixtures'
import { createLocalArchive, listLocalArchives, purgeLegacyLocalStorageArchives, ensureDailyLocalArchive, MAX_LOCAL_ARCHIVES } from '../archiveService'

describe('local archives', () => {
  beforeEach(() => localStorage.clear())

  it('never stores database copies in localStorage', async () => {
    await seedBasics()
    await createLocalArchive('manual')
    const heavy = Object.keys(localStorage).filter(k => (localStorage.getItem(k) || '').length > 10_000)
    expect(heavy).toEqual([])
    expect((await listLocalArchives()).length).toBe(1)
  })

  it('keeps only the newest archives (rotation) and does not hit any quota', async () => {
    await seedBasics()
    for (let i = 0; i < MAX_LOCAL_ARCHIVES + 5; i++) await createLocalArchive('daily')
    expect((await listLocalArchives()).length).toBe(MAX_LOCAL_ARCHIVES)
  })

  it('purges legacy localStorage archives and leaves other keys alone', () => {
    localStorage.setItem('tayba-archive-abc', 'x'.repeat(1000))
    localStorage.setItem('tayba-archive-def', 'y'.repeat(1000))
    localStorage.setItem('tayba-offline-session-v1', 'user-1')
    expect(purgeLegacyLocalStorageArchives()).toBe(2)
    expect(localStorage.getItem('tayba-offline-session-v1')).toBe('user-1')
    expect(localStorage.getItem('tayba-archive-abc')).toBeNull()
  })

  it('daily archive runs once per day', async () => {
    await seedBasics()
    const first = await ensureDailyLocalArchive()
    const second = await ensureDailyLocalArchive()
    expect(first.skipped).toBe(false)
    expect(second.skipped).toBe(true)
  })
})
