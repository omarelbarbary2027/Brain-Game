import {
  ALL_DISCIPLINE_IDS,
  DailyCompletionRecord,
  Difficulty,
  DisciplineId,
  PersonalBest,
  PlayerProgress,
  SessionLogEntry,
  StageResult,
} from '../types/game';
import { getPreviousDateKey } from './seededRandom';

const LEGACY_STORAGE_KEY = 'mnemon_progress_v1';
const SCOPED_STORAGE_PREFIX = 'mnemon_progress_v2:';
const MAX_HISTORY_ENTRIES = 500;

export const DEFAULT_BEST: PersonalBest = {
  bestScore: 0,
  fastestAvgMs: 0,
  bestAccuracy: 0,
  gamesPlayed: 0,
};

export function createDefaultBests(): Record<DisciplineId, PersonalBest> {
  return {
    pattern: { ...DEFAULT_BEST },
    tempo: { ...DEFAULT_BEST },
    sequence: { ...DEFAULT_BEST },
    stroop: { ...DEFAULT_BEST },
    pairs: { ...DEFAULT_BEST },
    pulse: { ...DEFAULT_BEST },
    matrix: { ...DEFAULT_BEST },
    digitspan: { ...DEFAULT_BEST },
    cipher: { ...DEFAULT_BEST },
    ruleswitch: { ...DEFAULT_BEST },
  };
}

export function createDefaultProgress(): PlayerProgress {
  return {
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    dailyRecords: {},
    personalBests: createDefaultBests(),
    sessionHistory: [],
    muted: false,
  };
}

function getStorageKey(scopeKey: string): string {
  return `${SCOPED_STORAGE_PREFIX}${scopeKey || 'guest'}`;
}

function normalizePersonalBests(
  raw?: Partial<Record<DisciplineId, Partial<PersonalBest>>>
): Record<DisciplineId, PersonalBest> {
  const result = createDefaultBests();
  for (const id of ALL_DISCIPLINE_IDS) {
    result[id] = {
      ...DEFAULT_BEST,
      ...(raw?.[id] ?? {}),
    };
  }
  return result;
}

function backfillHistoryFromDailyRecords(
  dailyRecords: Record<string, DailyCompletionRecord>
): SessionLogEntry[] {
  const entries: SessionLogEntry[] = [];
  const records = Object.values(dailyRecords).sort((a, b) => a.completedAt - b.completedAt);
  for (const rec of records) {
    rec.stages.forEach((stage, idx) => {
      entries.push({
        id: `backfill_${rec.dateKey}_${stage.discipline}_${idx}`,
        dateKey: rec.dateKey,
        timestamp: rec.completedAt + idx * 1000,
        mode: 'daily',
        difficulty: 'standard',
        discipline: stage.discipline,
        score: stage.score,
        avgReactionMs: stage.avgReactionMs,
        accuracy: stage.accuracy,
        bestStreak: stage.bestStreak,
      });
    });
  }
  return entries.slice(-MAX_HISTORY_ENTRIES);
}

export function loadProgress(scopeKey = 'guest'): PlayerProgress {
  try {
    const key = getStorageKey(scopeKey);
    let raw = localStorage.getItem(key);
    // Migrate legacy single-user storage only into the guest scope when v2 guest is empty
    if (!raw && scopeKey === 'guest') {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (!raw) return createDefaultProgress();

    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const dailyRecords = parsed.dailyRecords ?? {};
    const sessionHistory = Array.isArray(parsed.sessionHistory)
      ? parsed.sessionHistory
      : backfillHistoryFromDailyRecords(dailyRecords);

    return {
      currentStreak: parsed.currentStreak ?? 0,
      bestStreak: parsed.bestStreak ?? 0,
      lastCompletedDate: parsed.lastCompletedDate || null,
      dailyRecords,
      personalBests: normalizePersonalBests(parsed.personalBests),
      sessionHistory,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return createDefaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress, scopeKey = 'guest'): void {
  try {
    localStorage.setItem(getStorageKey(scopeKey), JSON.stringify(progress));
  } catch {
    // Ignore storage quota / privacy mode failures gracefully
  }
}

export function getEffectiveStreak(progress: PlayerProgress, todayKey: string): number {
  if (!progress.lastCompletedDate) return 0;
  if (progress.lastCompletedDate === todayKey) return progress.currentStreak;
  const yesterdayKey = getPreviousDateKey(todayKey);
  if (progress.lastCompletedDate === yesterdayKey) return progress.currentStreak;
  return 0;
}

export function buildDailyCompletionUpdate(
  progress: PlayerProgress,
  record: DailyCompletionRecord,
  scopeKey = 'guest'
): {
  updated: PlayerProgress;
  bestDailyRecord: DailyCompletionRecord;
  newEntries: SessionLogEntry[];
} {
  const alreadyCompletedToday = Boolean(progress.dailyRecords[record.dateKey]);
  const yesterdayKey = getPreviousDateKey(record.dateKey);

  let nextStreak = progress.currentStreak;
  if (!alreadyCompletedToday) {
    if (progress.lastCompletedDate === yesterdayKey) {
      nextStreak = progress.currentStreak + 1;
    } else if (progress.lastCompletedDate === record.dateKey) {
      nextStreak = progress.currentStreak;
    } else {
      nextStreak = 1;
    }
  }

  const nextBestStreak = Math.max(progress.bestStreak, nextStreak);
  const nextBests = { ...progress.personalBests };

  for (const stage of record.stages) {
    nextBests[stage.discipline] = mergeDisciplineBest(
      nextBests[stage.discipline] ?? { ...DEFAULT_BEST },
      stage.score,
      stage.avgReactionMs,
      stage.accuracy
    );
  }

  const newEntries: SessionLogEntry[] = record.stages.map((stage, idx) => ({
    id: `daily_${record.dateKey}_${record.completedAt}_${stage.discipline}_${idx}`,
    dateKey: record.dateKey,
    timestamp: record.completedAt + idx * 1000,
    mode: 'daily',
    difficulty: 'standard',
    discipline: stage.discipline,
    score: stage.score,
    avgReactionMs: stage.avgReactionMs,
    accuracy: stage.accuracy,
    bestStreak: stage.bestStreak,
  }));

  const existing = progress.dailyRecords[record.dateKey];
  const bestDailyRecord =
    existing && existing.totalScore > record.totalScore ? existing : record;

  const updated: PlayerProgress = {
    ...progress,
    currentStreak: nextStreak,
    bestStreak: nextBestStreak,
    lastCompletedDate: record.dateKey,
    dailyRecords: {
      ...progress.dailyRecords,
      [record.dateKey]: bestDailyRecord,
    },
    personalBests: nextBests,
    sessionHistory: [...progress.sessionHistory, ...newEntries].slice(-MAX_HISTORY_ENTRIES),
  };

  saveProgress(updated, scopeKey);
  return { updated, bestDailyRecord, newEntries };
}

export function buildPracticeCompletionUpdate(
  progress: PlayerProgress,
  result: StageResult,
  dateKey: string,
  difficulty: Difficulty,
  scopeKey = 'guest'
): {
  updated: PlayerProgress;
  entry: SessionLogEntry;
} {
  const now = Date.now();
  const entry: SessionLogEntry = {
    id: `practice_${dateKey}_${now}_${result.discipline}`,
    dateKey,
    timestamp: now,
    mode: 'practice',
    difficulty,
    discipline: result.discipline,
    score: result.score,
    avgReactionMs: result.avgReactionMs,
    accuracy: result.accuracy,
    bestStreak: result.bestStreak,
  };

  const updated: PlayerProgress = {
    ...progress,
    personalBests: {
      ...progress.personalBests,
      [result.discipline]: mergeDisciplineBest(
        progress.personalBests[result.discipline] ?? { ...DEFAULT_BEST },
        result.score,
        result.avgReactionMs,
        result.accuracy
      ),
    },
    sessionHistory: [...progress.sessionHistory, entry].slice(-MAX_HISTORY_ENTRIES),
  };
  saveProgress(updated, scopeKey);
  return { updated, entry };
}

function mergeDisciplineBest(
  prev: PersonalBest,
  score: number,
  avgMs: number,
  accuracy: number
): PersonalBest {
  const validMs = avgMs > 0 ? avgMs : prev.fastestAvgMs;
  const fastest =
    prev.fastestAvgMs === 0
      ? validMs
      : validMs > 0
      ? Math.min(prev.fastestAvgMs, validMs)
      : prev.fastestAvgMs;

  return {
    bestScore: Math.max(prev.bestScore, score),
    fastestAvgMs: fastest,
    bestAccuracy: Math.max(prev.bestAccuracy, accuracy),
    gamesPlayed: prev.gamesPlayed + 1,
  };
}
