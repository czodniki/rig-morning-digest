import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  atMs: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | undefined;
};

type MutableRow = {
  row: DigestRow;
  firstAtMs: number;
  lastAtMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (
    typeof at !== 'string' ||
    !Number.isFinite(Date.parse(at)) ||
    typeof job !== 'string' ||
    job.length === 0 ||
    (status !== 'ok' && status !== 'retry' && status !== 'fail') ||
    (owner !== null && typeof owner !== 'string') ||
    (error !== undefined && typeof error !== 'string')
  ) {
    return null;
  }

  return { at, atMs: Date.parse(at), job, status, owner, error };
}

function aggregate(events: RunEvent[], malformedLines: number): NightDigest {
  const byJob = new Map<string, MutableRow>();

  for (const event of [...events].sort((left, right) => left.atMs - right.atMs)) {
    const current = byJob.get(event.job);
    if (!current) {
      byJob.set(event.job, {
        row: {
          job: event.job,
          owner: event.owner,
          runs: 1,
          retries: event.status === 'retry' ? 1 : 0,
          lastStatus: event.status,
          lastError: event.error ?? null,
          firstAt: event.at,
          lastAt: event.at,
        },
        firstAtMs: event.atMs,
        lastAtMs: event.atMs,
      });
      continue;
    }

    current.row.runs += 1;
    if (event.status === 'retry') current.row.retries += 1;

    if (event.atMs < current.firstAtMs) {
      current.firstAtMs = event.atMs;
      current.row.firstAt = event.at;
    }
    if (event.atMs >= current.lastAtMs) {
      current.lastAtMs = event.atMs;
      current.row.owner = event.owner;
      current.row.lastStatus = event.status;
      current.row.lastAt = event.at;
    }
    if (event.error !== undefined) current.row.lastError = event.error;
  }

  return {
    rows: [...byJob.values()]
      .map(({ row }) => row)
      .sort((left, right) => left.job.localeCompare(right.job)),
    malformedLines,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return null;
    throw error;
  }

  const lines = contents === '' ? [] : contents.split(/\r?\n/);
  if (contents.endsWith('\n')) lines.pop();

  const events: RunEvent[] = [];
  let malformedLines = 0;
  for (const line of lines) {
    const event = parseEvent(line);
    if (event) events.push(event);
    else malformedLines += 1;
  }

  return aggregate(events, malformedLines);
};
