import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

describe('status board', () => {
  it('links nights to their digests and shows status counts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rig-status-route-'));
    try {
      await writeFile(join(directory, '2026-10-28.jsonl'),
        '{"at":"2026-10-28T01:00:00+01:00","job":"one","status":"ok","owner":"rook"}\n' +
        '{"at":"2026-10-28T01:01:00+01:00","job":"two","status":"retry","owner":"rook"}\n' +
        '{"at":"2026-10-28T01:02:00+01:00","job":"three","status":"fail","owner":null}\n');
      await writeFile(join(directory, '2026-10-27.jsonl'), '');

      const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: directory };
      process.env.LANE_MARKER = 'TEST-MARKER';
      const res = await createApp(config).request('/');
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('TEST-MARKER');
      expect(html).toContain('2026-10-28');
      expect(html).toContain('href="/digest/2026-10-28"');
      expect(html).toContain('ok 1 · retry 1 · fail 1');
      expect(html).toContain('href="/digest/2026-10-27"');
      expect(html).toContain('ok 0 · retry 0 · fail 0');
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp({ adapter: 'shim', installed: 'now', beatEverySeconds: 60, runsDir: 'unused' }).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
