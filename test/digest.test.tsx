import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const configFor = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const tempDirs: string[] = [];

function makeRunsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('renders the table and returns its ordered rows as JSON', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const app = createApp(configFor('runs'));

    const pageResponse = await app.request('/digest/2026-10-28');
    const html = await pageResponse.text();
    expect(pageResponse.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('1 malformed line counted');
    expect(html).toContain('—');
    expect(html).toContain('<strong class="warn">3</strong>');
    expect(html).toContain('<strong class="warn">fail</strong>');
    expect(html.indexOf('digest/render')).toBeLessThan(html.indexOf('fixtures/refresh'));

    const jsonResponse = await app.request('/api/digest/2026-10-28');
    expect(jsonResponse.status).toBe(200);
    const json = await jsonResponse.json() as { rows: Array<{ job: string }> };
    expect(json.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('returns 404 for a missing night on both routes', async () => {
    const app = createApp(configFor('runs'));
    expect((await app.request('/digest/2026-10-29')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-29')).status).toBe(404);
  });

  it('renders an empty file and counts malformed lines without failing', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');
    writeFileSync(join(runsDir, '2026-10-31.jsonl'), '{bad json}\n');
    const app = createApp(configFor(runsDir));

    const emptyPage = await app.request('/digest/2026-10-30');
    expect(emptyPage.status).toBe(200);
    expect(await emptyPage.text()).toContain('nothing ran');

    const malformedPage = await app.request('/digest/2026-10-31');
    expect(malformedPage.status).toBe(200);
    const html = await malformedPage.text();
    expect(html).toContain('1 malformed line counted');
    expect(html).toContain('nothing ran');

    const malformedJson = await app.request('/api/digest/2026-10-31');
    expect(await malformedJson.json()).toEqual({ rows: [], malformedLines: 1 });
  });
});
