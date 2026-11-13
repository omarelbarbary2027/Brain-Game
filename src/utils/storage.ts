import {
  DailyCompletionRecord,
  Difficulty,
  DisciplineId,
  PersonalBest,
  PlayerProgress,
  SessionLogEntry,
  StageResult,
} from '../types/game';
import { getPreviousDateKey } from './seededRandom';

const STORAGE_KEY = 'mnemon_progress_v1';
const MAX_HISTORY_ENTRIES = 500;

const DEFAULT_BEST: PersonalBest = {
  bestScore: 0,
  fastestAvgMs: 0,
  bestAccuracy: 0,
  gamesPlayed: 0,
};

function createDefaultProgress(): PlayerProgress {
  return {
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    dailyRecords: {},
    personalBests: {
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
    },
    sessionHistory: [],
    muted: false,
  };
}

function backfillHistoryFromDailyRecords(
  dailyRecords: Record<string, DailyCompletionRecord>
): SessionLogEntry[] {
  const entries: SessionLogEntry[] = [];
  const records = Object.values(dailyRecords).sort((a, b) => a.completedAt - b.completedAt);
  for (const rec of records) {
    rec.stages.forEach((stage, idx) => {
      entries.push({
        id: `backfill-${rec.dateKey}-${stage.discipline}-${idx}`,
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

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const dailyRecords = parsed.dailyRecords ?? {};
    const sessionHistory = Array.isArray(parsed.sessionHistory)
      ? parsed.sessionHistory
      : backfillHistoryFromDailyRecords(dailyRecords);

    return {
      currentStreak: parsed.currentStreak ?? 0,
      bestStreak: parsed.bestStreak ?? 0,
      lastCompletedDate: parsed.lastCompletedDate ?? null,
      dailyRecords,
      personalBests: {
        pattern: { ...DEFAULT_BEST, ...parsed.personalBests?.pattern },
        tempo: { ...DEFAULT_BEST, ...parsed.personalBests?.tempo },
        sequence: { ...DEFAULT_BEST, ...parsed.personalBests?.sequence },
        stroop: { ...DEFAULT_BEST, ...parsed.personalBests?.stroop },
        pairs: { ...DEFAULT_BEST, ...parsed.personalBests?.pairs },
        pulse: { ...DEFAULT_BEST, ...parsed.personalBests?.pulse },
        matrix: { ...DEFAULT_BEST, ...parsed.personalBests?.matrix },
        digitspan: { ...DEFAULT_BEST, ...parsed.personalBests?.digitspan },
        cipher: { ...DEFAULT_BEST, ...parsed.personalBests?.cipher },
        ruleswitch: { ...DEFAULT_BEST, ...parsed.personalBests?.ruleswitch },
      },
      sessionHistory,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return createDefaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
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

export function recordDailyCompletion(
  progress: PlayerProgress,
  record: DailyCompletionRecord
): PlayerProgress {
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
    id: `daily-${record.dateKey}-${record.completedAt}-${stage.discipline}-${idx}`,
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

  saveProgress(updated);
  return updated;
}

export function recordPracticeCompletion(
  progress: PlayerProgress,
  result: StageResult,
  dateKey: string,
  difficulty: Difficulty
): PlayerProgress {
  const now = Date.now();
  const entry: SessionLogEntry = {
    id: `practice-${dateKey}-${now}-${result.discipline}`,
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
  saveProgress(updated);
  return updated;
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
