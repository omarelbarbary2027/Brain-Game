import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Eye, RefreshCw, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng, shuffleWithRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

type SortShape = 'circle' | 'triangle' | 'square' | 'diamond';
type SortFinish = 'teal' | 'amber' | 'rose' | 'ivory';
type SortRule = 'shape' | 'count' | 'finish';

interface SortCardSpec {
  count: 1 | 2 | 3 | 4;
  shape: SortShape;
  finish: SortFinish;
}

interface RuleSwitchStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

// 4 Fixed Reference Cards: index i has count=(i+1), shape=SHAPES[i], finish=FINISHES[i]
const REF_CARDS: SortCardSpec[] = [
  { count: 1, shape: 'circle', finish: 'teal' },
  { count: 2, shape: 'triangle', finish: 'amber' },
  { count: 3, shape: 'square', finish: 'rose' },
  { count: 4, shape: 'diamond', finish: 'ivory' },
];

const FINISH_META: Record<
  SortFinish,
  { label: string; stroke: string; fill: string; border: string; bg: string }
> = {
  teal: {
    label: 'Teal',
    stroke: '#2DD4BF',
    fill: 'rgba(45, 212, 191, 0.22)',
    border: 'border-teal-400/70',
    bg: 'bg-teal-950/60',
  },
  amber: {
    label: 'Amber',
    stroke: '#FBBF24',
    fill: 'rgba(251, 191, 36, 0.22)',
    border: 'border-amber-400/70',
    bg: 'bg-amber-950/55',
  },
  rose: {
    label: 'Rose',
    stroke: '#FB7185',
    fill: 'rgba(251, 113, 133, 0.22)',
    border: 'border-rose-400/70',
    bg: 'bg-rose-950/55',
  },
  ivory: {
    label: 'Ivory',
    stroke: '#F8FAFC',
    fill: 'rgba(248, 250, 252, 0.85)',
    border: 'border-white/75',
    bg: 'bg-slate-900',
  },
};

const CardSymbolGrid: React.FC<{ spec: SortCardSpec; compact?: boolean }> = ({
  spec,
  compact = false,
}) => {
  const f = FINISH_META[spec.finish];
  const size = compact ? 15 : 22;

  const renderShape = (key: number) => (
    <svg key={key} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {spec.shape === 'circle' && (
        <circle cx="12" cy="12" r="8.5" fill={f.fill} stroke={f.stroke} strokeWidth="2.4" />
      )}
      {spec.shape === 'triangle' && (
        <polygon
          points="12,3 21,20 3,20"
          fill={f.fill}
          stroke={f.stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      )}
      {spec.shape === 'square' && (
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="2.5"
          fill={f.fill}
          stroke={f.stroke}
          strokeWidth="2.4"
        />
      )}
      {spec.shape === 'diamond' && (
        <polygon
          points="12,2.5 21.5,12 12,21.5 2.5,12"
          fill={f.fill}
          stroke={f.stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );

  return (
    <div
      className={`grid ${
        spec.count === 1
          ? 'grid-cols-1'
          : spec.count === 2
          ? 'grid-cols-2 gap-1.5'
          : 'grid-cols-2 gap-1'
      } place-items-center`}
    >
      {Array.from({ length: spec.count }, (_, i) => renderShape(i))}
    </div>
  );
};

function generateDeck(seed: string, difficulty: Difficulty): {
  cards: SortCardSpec[];
  initialRule: SortRule;
  ruleOrder: SortRule[];
  shiftEvery: number;
} {
  const rng = createSeededRng(`${seed}:ruleswitch:${difficulty}`);
  const total = difficulty === 'relaxed' ? 15 : difficulty === 'master' ? 22 : 18;
  const shiftEvery = difficulty === 'master' ? 4 : 5;
  const rules: SortRule[] = ['shape', 'count', 'finish'];
  const ruleOrder = shuffleWithRng(rules, rng);

  // Every stimulus card assigns distinct reference indices to count, shape, and finish
  // so every dimension maps unambiguously to a different Reference Card!
  const cards: SortCardSpec[] = [];
  for (let i = 0; i < total; i++) {
    const perm = shuffleWithRng([0, 1, 2, 3], rng);
    cards.push({
      count: REF_CARDS[perm[0]].count,
      shape: REF_CARDS[perm[1]].shape,
      finish: REF_CARDS[perm[2]].finish,
    });
  }

  return {
    cards,
    initialRule: ruleOrder[0],
    ruleOrder,
    shiftEvery,
  };
}

function getExpectedRefIndex(card: SortCardSpec, rule: SortRule): number {
  if (rule === 'count') {
    return REF_CARDS.findIndex((r) => r.count === card.count);
  }
  if (rule === 'shape') {
    return REF_CARDS.findIndex((r) => r.shape === card.shape);
  }
  return REF_CARDS.findIndex((r) => r.finish === card.finish);
}

export const RuleSwitchStage: React.FC<RuleSwitchStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const { cards, initialRule, ruleOrder, shiftEvery } = useMemo(
    () => generateDeck(seed, difficulty),
    [seed, difficulty]
  );
  const total = cards.length;
  const fuseMs = difficulty === 'relaxed' ? 4600 : difficulty === 'master' ? 2350 : 3300;

  const [idx, setIdx] = useState(0);
  const [activeRule, setActiveRule] = useState<SortRule>(initialRule);
  const [ruleHintShown, setRuleHintShown] = useState(false);
  const [fuseProgress, setFuseProgress] = useState(1);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [ruleJustShiftedNote, setRuleJustShiftedNote] = useState(false);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(2);

  const ruleCursorRef = useRef(0);
  const ruleMatchesRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const correctRef = useRef(0);
  const answeredRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const cardStartRef = useRef<number>(performance.now());
  const pauseStartRef = useRef<number | null>(null);
  const isPausedRef = useRef(isPaused);
  const remainingMsRef = useRef(fuseMs);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const current = cards[idx];
  const expectedRefIdx = getExpectedRefIndex(current, activeRule);

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current !== null) {
      cardStartRef.current += performance.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
  }, [isPaused]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const lastMs =
      reactionTimesRef.current.length > 0
        ? reactionTimesRef.current[reactionTimesRef.current.length - 1]
        : null;
    onHudUpdate({
      score,
      streak,
      lastReactionMs: lastMs,
      round: idx + 1,
      totalRounds: total,
    });
  }, [score, streak, idx, total, onHudUpdate]);

  const finishStage = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const accuracy =
      answeredRef.current > 0
        ? Math.round((correctRef.current / answeredRef.current) * 100)
        : 100;
    const times = reactionTimesRef.current;
    const avgMs =
      times.length > 0
        ? Math.round(times.reduce((sum, v) => sum + v, 0) / times.length)
        : 0;

    sound.playStageClear();
    onComplete({
      discipline: 'ruleswitch',
      label: 'Rule Switch',
      score: scoreRef.current,
      accuracy,
      avgReactionMs: avgMs,
      bestStreak: bestStreakRef.current,
      hintsUsed: hintsUsedRef.current,
      roundsCompleted: answeredRef.current,
      totalRounds: total,
    });
  }, [onComplete, total]);

  const advanceCard = useCallback(() => {
    lockRef.current = false;
    setRuleHintShown(false);
    if (idx + 1 >= total) {
      finishStage();
    } else {
      setIdx((v) => v + 1);
      remainingMsRef.current = fuseMs;
      setFuseProgress(1);
      cardStartRef.current = performance.now();
    }
  }, [idx, total, fuseMs, finishStage]);

  const handleTimeout = useCallback(() => {
    if (lockRef.current) return;
    lockRef.current = true;
    answeredRef.current += 1;
    streakRef.current = 0;
    setStreak(0);
    sound.playMiss();
    setFeedback({ correct: false, text: 'Time expired — watch the matching attribute' });
    timerRef.current = window.setTimeout(advanceCard, 340);
  }, [advanceCard]);

  useEffect(() => {
    remainingMsRef.current = fuseMs;
    setFuseProgress(1);
    cardStartRef.current = performance.now();

    let lastTick = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current && !lockRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remainingMsRef.current = Math.max(0, remainingMsRef.current - dt);
        setFuseProgress(remainingMsRef.current / fuseMs);
        if (remainingMsRef.current <= 0) {
          handleTimeout();
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [idx, fuseMs, handleTimeout]);

  const handlePickRef = useCallback(
    (refIdx: number) => {
      if (isPausedRef.current || lockRef.current) return;
      lockRef.current = true;

      const now = performance.now();
      const reactionMs = Math.max(110, Math.round(now - cardStartRef.current));
      answeredRef.current += 1;

      if (refIdx === expectedRefIdx) {
        correctRef.current += 1;
        reactionTimesRef.current.push(reactionMs);
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

        const speedBonus = reactionMs < 650 ? 60 : reactionMs < 1150 ? 35 : 15;
        const pts = 85 + speedBonus + Math.min(nextStreak * 12, 72);
        scoreRef.current += pts;
        setScore(scoreRef.current);

        ruleMatchesRef.current += 1;
        if (ruleMatchesRef.current >= shiftEvery && idx + 1 < total) {
          ruleMatchesRef.current = 0;
          ruleCursorRef.current = (ruleCursorRef.current + 1) % ruleOrder.length;
          setActiveRule(ruleOrder[ruleCursorRef.current]);
          setRuleJustShiftedNote(true);
          sound.playRuleShift();
          setFeedback({ correct: true, text: `+${pts} pts · Rule may shift next!` });
        } else {
          setRuleJustShiftedNote(false);
          sound.playSuccess(nextStreak);
          setFeedback({ correct: true, text: `+${pts} pts · Matched · ${reactionMs} ms` });
        }
      } else {
        streakRef.current = 0;
        setStreak(0);
        setRuleJustShiftedNote(false);
        sound.playMiss();
        setFeedback({
          correct: false,
          text: `Mismatch · Card #${expectedRefIdx + 1} matched the rule`,
        });
      }

      timerRef.current = window.setTimeout(advanceCard, 260);
    },
    [expectedRefIdx, shiftEvery, idx, total, ruleOrder, advanceCard]
  );

  const handleUseHint = useCallback(() => {
    if (isPausedRef.current || lockRef.current || hintsLeft <= 0 || ruleHintShown) return;
    setRuleHintShown(true);
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
  }, [hintsLeft, ruleHintShown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPausedRef.current) return;
      if (e.key === '1') {
        e.preventDefault();
        handlePickRef(0);
      } else if (e.key === '2') {
        e.preventDefault();
        handlePickRef(1);
      } else if (e.key === '3') {
        e.preventDefault();
        handlePickRef(2);
      } else if (e.key === '4') {
        e.preventDefault();
        handlePickRef(3);
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleUseHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePickRef, handleUseHint]);

  const currentFinishMeta = FINISH_META[current.finish];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-3 sm:px-4 select-none">
      {/* Header Progress */}
      <div className="w-full max-w-md mb-3 sm:mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {ruleHintShown
                ? `Active Rule: ${activeRule.toUpperCase()}`
                : ruleJustShiftedNote
                ? 'Hidden rule shifted — test & adapt!'
                : 'Sort by Shape, Count, or Finish'}
            </span>
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {idx + 1} / {total}
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-400 origin-left transition-transform duration-150"
            style={{ transform: `scaleX(${(idx + 1) / total})` }}
          />
        </div>
      </div>

      {/* 4 Reference Key Cards */}
      <div className="w-full max-w-md mb-3">
        <div className="text-[11px] text-slate-400 mb-1.5 text-center">
          Reference Cards (Tap 1–4 to Sort Active Card)
        </div>
        <div className="grid grid-cols-4 gap-2">
          {REF_CARDS.map((refCard, rIdx) => {
            const fm = FINISH_META[refCard.finish];
            return (
              <button
                key={rIdx}
                type="button"
                onClick={() => handlePickRef(rIdx)}
                aria-label={`Reference ${rIdx + 1}: ${refCard.count} ${fm.label} ${refCard.shape}`}
                className={`relative h-20 sm:h-24 rounded-xl border-2 border-b-4 flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer ${fm.bg} ${fm.border}`}
              >
                <span className="absolute top-1 left-1.5 text-[10px] font-mono text-slate-300">
                  {rIdx + 1}
                </span>
                <CardSymbolGrid spec={refCard} compact />
                <span className="text-[10px] font-medium text-slate-200 capitalize">
                  {refCard.count} · {fm.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Stimulus Card */}
      <div
        key={idx}
        className={`w-full max-w-xs rounded-2xl border-2 p-4 sm:p-5 shadow-2xl flex flex-col items-center justify-between gap-3 animate-card-enter ${currentFinishMeta.bg} ${currentFinishMeta.border}`}
      >
        <div className="w-full flex items-center justify-between text-xs text-slate-300">
          <span className="capitalize font-medium">
            {current.count} {currentFinishMeta.label} {current.shape}
            {current.count > 1 ? 's' : ''}
          </span>
          <span className="font-mono text-slate-400">#{idx + 1}</span>
        </div>

        <div className="py-2 flex items-center justify-center min-h-[72px]">
          <CardSymbolGrid spec={current} />
        </div>

        <div className="w-full h-1.5 rounded-full bg-black/30 overflow-hidden">
          <div
            className={`h-full rounded-full origin-left ${
              fuseProgress < 0.3 ? 'bg-rose-500' : 'bg-amber-400'
            }`}
            style={{ transform: `scaleX(${fuseProgress})` }}
          />
        </div>
      </div>

      {/* Feedback Line */}
      <div className="h-7 mt-2.5 flex items-center justify-center">
        {feedback && (
          <div
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium ${
              feedback.correct ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {feedback.correct ? (
              <Check className="w-4 h-4" aria-hidden="true" />
            ) : (
              <X className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="font-mono tabular-nums">{feedback.text}</span>
          </div>
        )}
      </div>

      {/* Footer Controls & Hint */}
      <div className="w-full max-w-md mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Keys 1–4 or Tap Card</span>
        </span>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={hintsLeft <= 0 || ruleHintShown}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Reveal Rule ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
