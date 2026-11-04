import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function appWithNight(contents: string, night = '2026-10-28') {
  const directory = await mkdtemp(join(tmpdir(), 'rig-digest-route-'));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, `${night}.jsonl`), contents);
  return createApp({ adapter: 'shim', installed: 'now', beatEverySeconds: 60, runsDir: directory });
}

describe('digest routes', () => {
  it('renders sorted rows, marks retries and failures, and uses the layout', async () => {
    const app = await appWithNight(
      '{"at":"2026-10-28T01:00:00+01:00","job":"z-job","status":"fail","owner":null,"error":"broken"}\n' +
      '{"at":"2026-10-28T00:00:00+01:00","job":"a-job","status":"retry","owner":"rook"}\n' +
      '{"at":"2026-10-28T00:01:00+01:00","job":"a-job","status":"retry","owner":"rook"}\n' +
      '{"at":"2026-10-28T00:02:00+01:00","job":"a-job","status":"retry","owner":"rook"}\n',
    );

    const response = await app.request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>rig · digest · 2026-10-28</title>');
    expect(html.indexOf('a-job')).toBeLessThan(html.indexOf('z-job'));
    expect(html.match(/class="warn"/g)).toHaveLength(2);
    expect(html).toContain('—');
  });

  it('returns sorted rows as JSON and ignores bad lines', async () => {
    const app = await appWithNight(
      '{"at":"2026-10-28T01:00:00+01:00","job":"z-job","status":"ok","owner":"z"}\n' +
      'not json\n' +
      '{"at":"2026-10-28T00:00:00+01:00","job":"a-job","status":"ok","owner":"a"}\n',
    );

    const response = await app.request('/api/digest/2026-10-28');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ job: 'a-job' }),
      expect.objectContaining({ job: 'z-job' }),
    ]);
  });

  it('returns 404 for a missing night', async () => {
    const app = await appWithNight('');
    expect((await app.request('/digest/missing')).status).toBe(404);
    expect((await app.request('/api/digest/missing')).status).toBe(404);
  });

  it('renders an empty night', async () => {
    const app = await appWithNight('');
    const response = await app.request('/digest/2026-10-28');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('nothing ran');
  });
});
