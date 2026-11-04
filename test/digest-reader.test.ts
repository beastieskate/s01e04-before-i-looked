import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight, readNightCounts } from '../src/digest/reader.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('readNight', () => {
  it('counts the bad line in the real fixture', () => {
    expect(readNight('runs', '2026-10-28')).toHaveLength(5);
    expect(readNightCounts('runs', '2026-10-28').badLines).toBe(1);
  });

  it('counts malformed and invalid lines but not blank lines', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rig-digest-'));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, 'night.jsonl'),
      '\n  \nnot json\n{}\nnull\n' +
      '{"at":"2026-10-29T00:00:00+01:00","job":"job/a","status":"ok","owner":null}\n',
    );

    expect(readNightCounts(directory, 'night')).toEqual({
      ok: 1, retry: 0, fail: 0, badLines: 3,
    });
    expect(readNight(directory, 'night')).toHaveLength(1);
  });

  it('reports zero counts for an empty night', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rig-digest-'));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, 'night.jsonl'), '');

    expect(readNightCounts(directory, 'night')).toEqual({
      ok: 0, retry: 0, fail: 0, badLines: 0,
    });
  });

  it('groups runs into one row per job', () => {
    expect(readNight('runs', '2026-10-28')).toEqual([
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'lock held',
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'upstream 503',
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
    ]);
  });

  it('skips bad lines and keeps null owners', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rig-digest-'));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, 'night.jsonl'),
      '{"at":"2026-10-29T00:00:00+01:00","job":"job/a","status":"ok","owner":null}\nnot json\n',
    );

    expect(readNight(directory, 'night')).toEqual([
      {
        job: 'job/a',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T00:00:00+01:00',
        lastAt: '2026-10-29T00:00:00+01:00',
      },
    ]);
  });
});
