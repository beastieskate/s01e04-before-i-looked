import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus } from './types.js';

export type DigestCounts = Record<DigestStatus, number> & { badLines: number };

type Run = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null) return false;

  const run = value as Record<string, unknown>;
  return (
    typeof run.at === 'string' &&
    typeof run.job === 'string' &&
    run.job.length > 0 &&
    (run.status === 'ok' || run.status === 'retry' || run.status === 'fail') &&
    (typeof run.owner === 'string' || run.owner === null) &&
    (run.error === undefined || typeof run.error === 'string')
  );
}

function emptyCounts(): DigestCounts {
  return { ok: 0, retry: 0, fail: 0, badLines: 0 };
}

function readRuns(runsDir: string, night: string): { runs: Run[]; counts: DigestCounts } {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const runs: Run[] = [];
  const counts = emptyCounts();

  for (const line of contents.split('\n')) {
    if (line.trim() === '') continue;

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      counts.badLines += 1;
      continue;
    }
    if (!isRun(value)) {
      counts.badLines += 1;
      continue;
    }
    runs.push(value);
    counts[value.status] += 1;
  }

  return { runs, counts };
}

export function readNight(runsDir: string, night: string): DigestRow[] {
  const { runs } = readRuns(runsDir, night);
  const rows = new Map<string, DigestRow>();

  for (const run of runs) {
    const current = rows.get(run.job);
    if (current === undefined) {
      rows.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error ?? null,
        firstAt: run.at,
        lastAt: run.at,
      });
      continue;
    }

    current.owner = run.owner;
    current.runs += 1;
    if (run.status === 'retry') current.retries += 1;
    current.lastStatus = run.status;
    if (run.error !== undefined) current.lastError = run.error;
    current.lastAt = run.at;
  }

  return [...rows.values()];
}

export function readNightCounts(runsDir: string, night: string): DigestCounts {
  return readRuns(runsDir, night).counts;
}
