import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('aggregates the sample night and counts its malformed line', () => {
    const digest = readNight('runs', '2026-10-28');

    expect(digest?.rows).toHaveLength(5);
    expect(digest?.malformedLines).toBe(1);
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest?.rows.find((row) => row.job === 'fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
    });
    expect(digest?.rows.find((row) => row.job === 'digest/render')?.owner).toBeNull();
  });

  it('returns null for a missing or invalid night', () => {
    expect(readNight('runs', '2026-10-29')).toBeNull();
    expect(readNight('runs', '../2026-10-28')).toBeNull();
  });
});
