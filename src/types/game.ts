import { createSeededRng } from '../utils/seededRandom';

export type GameState =
  | 'TITLE_MENU'
  | 'DASHBOARD'
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
  | 'pulse'
  | 'matrix'
  | 'digitspan'
  | 'cipher'
  | 'ruleswitch';

export type ChallengeCategory = 'Memory' | 'Speed' | 'Executive' | 'Pattern & IQ';

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

export interface SessionLogEntry {
  id: string;
  dateKey: string;
  timestamp: number;
  mode: 'daily' | 'practice';
  difficulty: Difficulty;
  discipline: DisciplineId;
  score: number;
  avgReactionMs: number;
  accuracy: number;
  bestStreak: number;
}

export interface PlayerProgress {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
  dailyRecords: Record<string, DailyCompletionRecord>;
  personalBests: Record<DisciplineId, PersonalBest>;
  sessionHistory: SessionLogEntry[];
  muted: boolean;
}

export interface DisciplineMeta {
  id: DisciplineId;
  title: string;
  shortTitle: string;
  category: ChallengeCategory;
  cognitiveFocus: string;
  summary: string;
  whatIsNeeded: string[];
  controlsHint: string;
}

export const ALL_DISCIPLINE_IDS: DisciplineId[] = [
  'pattern',
  'pairs',
  'digitspan',
  'tempo',
  'stroop',
  'sequence',
  'pulse',
  'ruleswitch',
  'matrix',
  'cipher',
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
    controlsHint: 'Tap tiles · Arrow Keys + Space · H Hint',
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
      'Clear all 3 escalating grids before their fuses expire; Hints highlight an unfound pair.',
    ],
    controlsHint: 'Tap cards to flip · H Highlight a Pair',
  },
  digitspan: {
    id: 'digitspan',
    title: 'Digit Span',
    shortTitle: 'Numeric Span',
    category: 'Memory',
    cognitiveFocus: 'Auditory-Visual Digit Span & Mental Reversal',
    summary:
      'Memorize flashing digit sequences, then reproduce them — and reverse the order on the final rounds.',
    whatIsNeeded: [
      'Watch each digit flash one by one in the center focus tile.',
      'In Rounds 1–3, enter the exact sequence in Forward order using the keypad.',
      'In Rounds 4–5, flip your mental buffer and enter the digits in Reverse order.',
    ],
    controlsHint: 'Keypad or 0–9 Keys · Backspace Undo · H Reveal Next',
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
  stroop: {
    id: 'stroop',
    title: 'Stroop Reflex',
    shortTitle: 'Impulse Control',
    category: 'Speed',
    cognitiveFocus: 'Selective Attention & Interference Suppression',
    summary:
      'Tap the ink color or word meaning under conflicting cues before the card timer runs out.',
    whatIsNeeded: [
      'In Phase 1, tap the INK COLOR of the displayed word and ignore what the text spells.',
      'In Phase 2, the directive alternates dynamically between INK COLOR and WORD MEANING.',
      'Answer fast before the per-card fuse expires; 1–4 keys or direct clicks trigger answers.',
    ],
    controlsHint: 'Keys 1–4 or Tap Answer · H Narrow 2 Options',
  },
  sequence: {
    id: 'sequence',
    title: 'Sequence Trail',
    shortTitle: 'Path Recall',
    category: 'Executive',
    cognitiveFocus: 'Ordered Recall & Executive Flexibility',
    summary:
      'Scan numbered nodes around obsidian blockers, tap the start node early for a bonus, and watch for Reverse Trail.',
    whatIsNeeded: [
      'Memorize numbered nodes (1 to N) while routing around dark obsidian blocker tiles.',
      'Tap the starting node anytime during study to conceal the rest immediately for a Quick-Start bonus.',
      'Rounds 1–3 run ascending (1 → N); the final round flips to Reverse Order (N → 1).',
    ],
    controlsHint: 'Tap tiles in order · H Highlight Next Node',
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
    controlsHint: '← Left · ↓ Equal · → Right · H Solve Left',
  },
  ruleswitch: {
    id: 'ruleswitch',
    title: 'Rule Switch',
    shortTitle: 'Set Shifting',
    category: 'Executive',
    cognitiveFocus: 'Executive Set-Shifting & Rule Discovery (WCST)',
    summary:
      'Discover the hidden sorting rule (Shape, Count, or Finish) and adapt fast when the rule shifts mid-run.',
    whatIsNeeded: [
      'Match the active card to one of the 4 reference cards based on the hidden active rule.',
      'Use instant feedback (✓ Match or × Try Another Rule) to lock onto Shape, Count, or Finish.',
      'Every few correct sorts, the hidden rule shifts silently — detect the new rule quickly.',
    ],
    controlsHint: 'Keys 1–4 or Tap Reference Card · H Reveal Rule',
  },
  matrix: {
    id: 'matrix',
    title: 'Matrix Logic',
    shortTitle: 'Visual IQ',
    category: 'Pattern & IQ',
    cognitiveFocus: 'Fluid Intelligence & Raven Matrix Deduction',
    summary:
      'Deduce row-and-column visual rules across a 3×3 geometric matrix and select the missing ninth tile.',
    whatIsNeeded: [
      'Analyze how Shape, Inner Fill, and Dot Count transform across each row and column.',
      'Select the 1 of 4 candidate tiles that completes the bottom-right missing slot.',
      'Solve accurately before the reasoning timer runs out for IQ speed bonuses.',
    ],
    controlsHint: 'Keys 1–4 or Tap Candidate · H Narrow 2 Options',
  },
  cipher: {
    id: 'cipher',
    title: 'Cipher Sequence',
    shortTitle: 'Pattern IQ',
    category: 'Pattern & IQ',
    cognitiveFocus: 'Inductive Reasoning & Series Deduction',
    summary:
      'Uncover hidden arithmetic, alternating, and interleaved rules to deduce the missing number in each series.',
    whatIsNeeded: [
      'Examine the 5-number series for step patterns, alternating multipliers, or interleaved rules.',
      'Choose the exact value that replaces the ? tile from 4 close distractors.',
      'Fast pattern recognition builds combo multipliers before each fuse expires.',
    ],
    controlsHint: 'Keys 1–4 or Tap Option · H Pattern Clue',
  },
};

// Deterministically rotates 3 diverse challenges each day across Memory, Speed/Executive, and Pattern & IQ
export function getDailyStageOrder(dateKey: string): DisciplineId[] {
  const rng = createSeededRng(`daily-lineup-v2:${dateKey}`);
  const memoryPool: DisciplineId[] = ['pattern', 'pairs', 'digitspan'];
  const speedExecPool: DisciplineId[] = ['tempo', 'stroop', 'sequence', 'pulse', 'ruleswitch'];
  const iqPool: DisciplineId[] = ['matrix', 'cipher', 'ruleswitch', 'pulse'];

  const pick1 = memoryPool[Math.floor(rng() * memoryPool.length)];
  const pick2 = speedExecPool[Math.floor(rng() * speedExecPool.length)];
  const remainingIq = iqPool.filter((id) => id !== pick2);
  const pick3 = remainingIq[Math.floor(rng() * remainingIq.length)];

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
  const speedGood = avgReactionMs > 0 && avgReactionMs <= 750;
  const speedGreat = avgReactionMs > 0 && avgReactionMs <= 520;

  if (accuracy >= 90 && (speedGreat || perStageScore >= 1350)) {
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
