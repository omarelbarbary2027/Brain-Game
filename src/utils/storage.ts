import { DailyCompletionRecord, DisciplineId, PersonalBest, PlayerProgress } from '../types/game';
import { getPreviousDateKey } from './seededRandom';

const STORAGE_KEY = 'mnemon_progress_v1';

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
    },
    muted: false,
  };
}

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    return {
      currentStreak: parsed.currentStreak ?? 0,
      bestStreak: parsed.bestStreak ?? 0,
      lastCompletedDate: parsed.lastCompletedDate ?? null,
      dailyRecords: parsed.dailyRecords ?? {},
      personalBests: {
        pattern: { ...DEFAULT_BEST, ...parsed.personalBests?.pattern },
        tempo: { ...DEFAULT_BEST, ...parsed.personalBests?.tempo },
        sequence: { ...DEFAULT_BEST, ...parsed.personalBests?.sequence },
        stroop: { ...DEFAULT_BEST, ...parsed.personalBests?.stroop },
        pairs: { ...DEFAULT_BEST, ...parsed.personalBests?.pairs },
        pulse: { ...DEFAULT_BEST, ...parsed.personalBests?.pulse },
      },
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
      nextBests[stage.discipline],
      stage.score,
      stage.avgReactionMs,
      stage.accuracy
    );
  }

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
  };

  saveProgress(updated);
  return updated;
}

export function recordPracticeCompletion(
  progress: PlayerProgress,
  discipline: DisciplineId,
  score: number,
  avgReactionMs: number,
  accuracy: number
): PlayerProgress {
  const updated: PlayerProgress = {
    ...progress,
    personalBests: {
      ...progress.personalBests,
      [discipline]: mergeDisciplineBest(
        progress.personalBests[discipline],
        score,
        avgReactionMs,
        accuracy
      ),
    },
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
