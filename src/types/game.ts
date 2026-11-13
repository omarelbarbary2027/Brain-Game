import { createSeededRng } from '../utils/seededRandom';

export type GameState =
  | 'TITLE_MENU'
  | 'STAGE_BRIEFING'
  | 'PLAYING'
  | 'PAUSED'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

export type DisciplineId =
  | 'pattern'
  | 'tempo'
  | 'sequence'
  | 'stroop'
  | 'pairs'
  | 'pulse';

export type GameMode = 'daily' | DisciplineId;

export type Difficulty = 'relaxed' | 'standard' | 'master';

export interface StageResult {
  discipline: DisciplineId;
  label: string;
  score: number;
  accuracy: number; // 0 - 100
  avgReactionMs: number;
  bestStreak: number;
  hintsUsed: number;
  roundsCompleted: number;
  totalRounds: number;
}

export interface DailyCompletionRecord {
  dateKey: string;
  dailyNumber: number;
  totalScore: number;
  avgReactionMs: number;
  overallAccuracy: number;
  stages: StageResult[];
  completedAt: number;
}

export interface PersonalBest {
  bestScore: number;
  fastestAvgMs: number;
  bestAccuracy: number;
  gamesPlayed: number;
}

export interface PlayerProgress {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
  dailyRecords: Record<string, DailyCompletionRecord>;
  personalBests: Record<DisciplineId, PersonalBest>;
  muted: boolean;
}

export interface DisciplineMeta {
  id: DisciplineId;
  title: string;
  shortTitle: string;
  category: 'Memory' | 'Speed' | 'Executive';
  cognitiveFocus: string;
  summary: string;
  whatIsNeeded: string[];
  controlsHint: string;
}

export const ALL_DISCIPLINE_IDS: DisciplineId[] = [
  'pattern',
  'tempo',
  'sequence',
  'stroop',
  'pairs',
  'pulse',
];

export const DISCIPLINES: Record<DisciplineId, DisciplineMeta> = {
  pattern: {
    id: 'pattern',
    title: 'Pattern Echo',
    shortTitle: 'Spatial Memory',
    category: 'Memory',
    cognitiveFocus: 'Visual-Spatial Working Memory & Inhibition',
    summary:
      'Memorize gold target tiles, ignore rose decoy hazards, and recall the pattern before the fuse runs out.',
    whatIsNeeded: [
      'Memorize only the Gold Diamond tiles during the brief flash wave.',
      'Ignore Rose Cross decoy hazards — tapping a decoy or blank cell breaks your streak.',
      'Beat the recall timer on all 4 rounds for speed multipliers; up to 2 misses allowed per round.',
    ],
    controlsHint: 'Click/Tap tiles · Arrow Keys + Space · H for Hint',
  },
  tempo: {
    id: 'tempo',
    title: 'Tempo Match',
    shortTitle: 'N-Back Speed',
    category: 'Speed',
    cognitiveFocus: 'Cognitive Processing Speed & N-Back Switching',
    summary:
      'Beat the live card fuse across 3 escalating rules: 1-Back Shape, 1-Back Finish, and a 2-Back Blitz.',
    whatIsNeeded: [
      'Decide Match or Different before each card fuse expires — timeouts break your streak.',
      'Phase 1 compares Shape (1-Back); Phase 2 shifts to Finish (Color & Pattern).',
      'Final Phase escalates to 2-Back Shape: match the card from 2 steps ago.',
    ],
    controlsHint: 'D / ← Different · M / → Match · H Peek Target',
  },
  sequence: {
    id: 'sequence',
    title: 'Sequence Trail',
    shortTitle: 'Sequential Recall',
    category: 'Executive',
    cognitiveFocus: 'Ordered Recall & Executive Flexibility',
    summary:
      'Scan numbered nodes around obsidian blockers, tap the start node early for a bonus, and watch for Reverse Trail.',
    whatIsNeeded: [
      'Memorize numbered nodes (1 to N) while routing around dark obsidian blocker tiles.',
      'Tap the starting node anytime during study to conceal the rest immediately for a Quick-Start bonus.',
      'Rounds 1–3 run ascending (1 → N); the final round flips to Reverse Order (N → 1).',
    ],
    controlsHint: 'Click/Tap tiles in order · H Highlight Next Node',
  },
  stroop: {
    id: 'stroop',
    title: 'Stroop Reflex',
    shortTitle: 'Attention Control',
    category: 'Speed',
    cognitiveFocus: 'Selective Attention & Interference Suppression',
    summary:
      'Tap the ink color or word meaning under conflicting cues before the card timer runs out.',
    whatIsNeeded: [
      'In Phase 1, tap the INK COLOR of the displayed word and ignore what the text spells.',
      'In Phase 2, the directive alternates dynamically between INK COLOR and WORD MEANING.',
      'Answer fast before the per-card fuse expires; 1–4 keys or direct clicks trigger answers.',
    ],
    controlsHint: 'Keys 1–4 or Click/Tap Answer · H Eliminate 2 Options',
  },
  pairs: {
    id: 'pairs',
    title: 'Dual Pairs',
    shortTitle: 'Visual Recall',
    category: 'Memory',
    cognitiveFocus: 'Visual Snapshot Memory & Rapid Matching',
    summary:
      'Snapshot an open grid of symbol pairs, then clear every matching pair from memory before time expires.',
    whatIsNeeded: [
      'Study the brief face-up reveal to lock symbol positions into visual memory.',
      'Once cards flip face-down, uncover matching pairs consecutively to build combo multipliers.',
      'Clear all 3 escalating grids before their fuses expire; Hints flash an unfound pair.',
    ],
    controlsHint: 'Click/Tap cards to flip · H Highlight a Pair',
  },
  pulse: {
    id: 'pulse',
    title: 'Mental Pulse',
    shortTitle: 'Numeric Speed',
    category: 'Executive',
    cognitiveFocus: 'Rapid Quantitative Comparison & Rule Flipping',
    summary:
      'Compare two arithmetic expressions before the fuse burns down — then adapt when the rule flips to Lower.',
    whatIsNeeded: [
      'In Phase 1, pick the side with the HIGHER value (or Equal if both sides match).',
      'In Phase 2, the rule flips: pick the LOWER value and suppress your higher-number reflex.',
      'Faster decisions earn speed bonuses; arrow keys or clicks respond instantaneously.',
    ],
    controlsHint: '← Left · ↓ Equal · → Right · H Reveal Left Value',
  },
};

// Deterministically rotates 3 diverse challenges each day (1 Memory, 1 Speed, 1 Executive)
export function getDailyStageOrder(dateKey: string): DisciplineId[] {
  const rng = createSeededRng(`daily-lineup:${dateKey}`);
  const memoryPool: DisciplineId[] = ['pattern', 'pairs'];
  const speedPool: DisciplineId[] = ['tempo', 'stroop'];
  const execPool: DisciplineId[] = ['sequence', 'pulse'];

  const pick1 = memoryPool[Math.floor(rng() * memoryPool.length)];
  const pick2 = speedPool[Math.floor(rng() * speedPool.length)];
  const pick3 = execPool[Math.floor(rng() * execPool.length)];

  const trio = [pick1, pick2, pick3];
  for (let i = trio.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [trio[i], trio[j]] = [trio[j], trio[i]];
  }
  return trio;
}

export interface CognitiveRank {
  grade: 'S' | 'A' | 'B' | 'C';
  title: string;
  summary: string;
}

export function getCognitiveRank(
  accuracy: number,
  avgReactionMs: number,
  totalScore: number,
  stageCount: number
): CognitiveRank {
  const perStageScore = stageCount > 0 ? totalScore / stageCount : totalScore;
  const speedGood = avgReactionMs > 0 && avgReactionMs <= 620;
  const speedGreat = avgReactionMs > 0 && avgReactionMs <= 460;

  if (accuracy >= 90 && speedGreat && perStageScore >= 1150) {
    return {
      grade: 'S',
      title: 'Neural Virtuoso',
      summary: 'Elite recall precision paired with razor-sharp processing speed.',
    };
  }
  if (accuracy >= 80 && (speedGood || perStageScore >= 900)) {
    return {
      grade: 'A',
      title: 'Rapid Strategist',
      summary: 'Strong working-memory control under shifting constraints and time pressure.',
    };
  }
  if (accuracy >= 65 && perStageScore >= 550) {
    return {
      grade: 'B',
      title: 'Sharp Recall',
      summary: 'Solid cognitive accuracy. Push reaction speed and minimize hints for A-Rank.',
    };
  }
  return {
    grade: 'C',
    title: 'Warmed Up',
    summary: 'Circuit complete. Replay in Practice Mode to lock in faster recall patterns.',
  };
}
