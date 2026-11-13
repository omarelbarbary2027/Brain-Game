import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, Clock, Eye, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng, randInt } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

type SideChoice = 'left' | 'equal' | 'right';
type PulseRule = 'higher' | 'lower';

interface PulsePrompt {
  id: number;
  leftExpr: string;
  rightExpr: string;
  leftVal: number;
  rightVal: number;
  rule: PulseRule;
  answer: SideChoice;
}

interface MentalPulseStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

function makeExpression(
  targetOffset: number | null,
  rng: () => number,
  harder: boolean
): { expr: string; val: number } {
  if (targetOffset !== null) {
    // Generate an expression equal to targetOffset
    const split = randInt(3, Math.max(4, Math.floor(targetOffset / 2)), rng);
    if (rng() < 0.5 && targetOffset > 8) {
      return { expr: `${targetOffset - split} + ${split}`, val: targetOffset };
    }
    const extra = randInt(4, 14, rng);
    return { expr: `${targetOffset + extra} − ${extra}`, val: targetOffset };
  }

  const mode = harder ? randInt(0, 2, rng) : randInt(0, 1, rng);
  if (mode === 0) {
    const a = randInt(7, harder ? 28 : 19, rng);
    const b = randInt(4, harder ? 19 : 14, rng);
    return { expr: `${a} + ${b}`, val: a + b };
  }
  if (mode === 1) {
    const a = randInt(18, harder ? 48 : 34, rng);
    const b = randInt(4, Math.min(16, a - 4), rng);
    return { expr: `${a} − ${b}`, val: a - b };
  }
  const a = randInt(3, 8, rng);
  const b = randInt(3, 7, rng);
  return { expr: `${a} × ${b}`, val: a * b };
}

function generatePrompts(seed: string, difficulty: Difficulty): {
  prompts: PulsePrompt[];
  flipIdx: number;
} {
  const rng = createSeededRng(`${seed}:pulse:${difficulty}`);
  const total = difficulty === 'relaxed' ? 14 : difficulty === 'master' ? 20 : 16;
  const flipIdx = Math.floor(total / 2);
  const harder = difficulty !== 'relaxed';

  const prompts: PulsePrompt[] = [];
  for (let i = 0; i < total; i++) {
    const rule: PulseRule = i >= flipIdx ? 'lower' : 'higher';
    const left = makeExpression(null, rng, harder || i >= flipIdx);

    // ~15% exact ties, otherwise tight close-call gaps (1 to 5 apart) for real challenge!
    const makeTie = rng() < 0.16;
    let right: { expr: string; val: number };
    if (makeTie) {
      right = makeExpression(left.val, rng, harder);
    } else {
      const gap = randInt(1, 5, rng) * (rng() < 0.5 ? 1 : -1);
      const desired = Math.max(4, left.val + gap);
      right = makeExpression(desired === left.val ? desired + 1 : desired, rng, harder);
    }

    let answer: SideChoice = 'equal';
    if (left.val !== right.val) {
      if (rule === 'higher') {
        answer = left.val > right.val ? 'left' : 'right';
      } else {
        answer = left.val < right.val ? 'left' : 'right';
      }
    }

    prompts.push({
      id: i,
      leftExpr: left.expr,
      rightExpr: right.expr,
      leftVal: left.val,
      rightVal: right.val,
      rule,
      answer,
    });
  }

  return { prompts, flipIdx };
}

export const MentalPulseStage: React.FC<MentalPulseStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const { prompts, flipIdx } = useMemo(
    () => generatePrompts(seed, difficulty),
    [seed, difficulty]
  );
  const total = prompts.length;
  const fuseMs = difficulty === 'relaxed' ? 3800 : difficulty === 'master' ? 2050 : 2750;

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'ACTIVE' | 'RULE_SHIFT'>('ACTIVE');
  const [fuseProgress, setFuseProgress] = useState(1);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [leftValueRevealed, setLeftValueRevealed] = useState(false);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(2);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const correctRef = useRef(0);
  const answeredRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const promptStartRef = useRef<number>(performance.now());
  const pauseStartRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const isPausedRef = useRef(isPaused);

  const current = prompts[idx];

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current !== null) {
      promptStartRef.current += performance.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
  }, [isPaused]);

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
      discipline: 'pulse',
      label: 'Mental Pulse',
      score: scoreRef.current,
      accuracy,
      avgReactionMs: avgMs,
      bestStreak: bestStreakRef.current,
      hintsUsed: hintsUsedRef.current,
      roundsCompleted: answeredRef.current,
      totalRounds: total,
    });
  }, [onComplete, total]);

  const resumeAfterShift = useCallback(() => {
    if (phase !== 'RULE_SHIFT' || isPaused) return;
    setPhase('ACTIVE');
    setFuseProgress(1);
    promptStartRef.current = performance.now();
  }, [phase, isPaused]);

  useEffect(() => {
    if (phase !== 'RULE_SHIFT' || isPaused) return;
    const t = setTimeout(resumeAfterShift, 1800);
    return () => clearTimeout(t);
  }, [phase, isPaused, resumeAfterShift]);

  const advanceNext = useCallback(() => {
    lockRef.current = false;
    setLeftValueRevealed(false);
    if (idx + 1 >= total) {
      finishStage();
    } else {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setFuseProgress(1);
      if (nextIdx === flipIdx) {
        sound.playRuleShift();
        setPhase('RULE_SHIFT');
      } else {
        promptStartRef.current = performance.now();
      }
    }
  }, [idx, total, flipIdx, finishStage]);

  const handleTimeout = useCallback(() => {
    if (lockRef.current || phase !== 'ACTIVE') return;
    lockRef.current = true;
    answeredRef.current += 1;
    streakRef.current = 0;
    setStreak(0);
    sound.playMiss();
    setFeedback({
      correct: false,
      text: `Time expired · ${current.leftVal} vs ${current.rightVal}`,
    });
    setTimeout(advanceNext, 260);
  }, [phase, current.leftVal, current.rightVal, advanceNext]);

  useEffect(() => {
    if (phase !== 'ACTIVE') return;
    setFuseProgress(1);

    let remaining = fuseMs;
    let lastTick = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current && !lockRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remaining = Math.max(0, remaining - dt);
        setFuseProgress(remaining / fuseMs);
        if (remaining <= 0) {
          handleTimeout();
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, idx, fuseMs, handleTimeout]);

  const handlePick = useCallback(
    (choice: SideChoice) => {
      if (isPaused || phase !== 'ACTIVE' || lockRef.current) return;
      lockRef.current = true;

      const now = performance.now();
      const reactionMs = Math.max(100, Math.round(now - promptStartRef.current));
      answeredRef.current += 1;

      if (choice === current.answer) {
        correctRef.current += 1;
        reactionTimesRef.current.push(reactionMs);
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

        const speedBonus = reactionMs < 750 ? 60 : reactionMs < 1300 ? 35 : 15;
        const flipBonus = current.rule === 'lower' ? 25 : 0;
        const pts = 85 + flipBonus + speedBonus + Math.min(nextStreak * 10, 70);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        sound.playSuccess(nextStreak);
        setFeedback({
          correct: true,
          text: `+${pts} pts · ${current.leftVal} vs ${current.rightVal} · ${reactionMs} ms`,
        });
      } else {
        streakRef.current = 0;
        setStreak(0);
        sound.playMiss();
        setFeedback({
          correct: false,
          text: `${current.leftVal} vs ${current.rightVal}`,
        });
      }

      setTimeout(advanceNext, 180);
    },
    [isPaused, phase, current, advanceNext]
  );

  const handleUseHint = useCallback(() => {
    if (isPaused || phase !== 'ACTIVE' || hintsLeft <= 0 || leftValueRevealed) return;
    setLeftValueRevealed(true);
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
  }, [isPaused, phase, hintsLeft, leftValueRevealed]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPaused) return;
      if (phase === 'RULE_SHIFT' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        resumeAfterShift();
        return;
      }
      if (phase !== 'ACTIVE') return;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handlePick('left');
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        handlePick('equal');
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handlePick('right');
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleUseHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPaused, phase, resumeAfterShift, handlePick, handleUseHint]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 select-none">
      {/* Rule & Progress */}
      <div className="w-full max-w-lg mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          <span
            className={
              current.rule === 'lower'
                ? 'text-amber-300 font-semibold'
                : 'text-teal-300 font-semibold'
            }
          >
            {phase === 'RULE_SHIFT'
              ? 'Rule Flip Incoming'
              : current.rule === 'higher'
              ? 'Pick the HIGHER Value (or Equal)'
              : 'Flipped: Pick the LOWER Value (or Equal)'}
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {idx + 1} / {total}
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-transform duration-150 origin-left ${
              current.rule === 'lower' ? 'bg-amber-400' : 'bg-teal-400'
            }`}
            style={{ transform: `scaleX(${(idx + 1) / total})` }}
          />
        </div>
      </div>

      {/* Expression Comparison Arena */}
      <div className="w-full max-w-lg min-h-[215px] flex items-center justify-center">
        {phase === 'RULE_SHIFT' ? (
          <div className="w-full rounded-2xl bg-[#131C2E] border-2 border-amber-400/80 p-6 text-center shadow-2xl animate-card-enter space-y-3">
            <div className="text-xs font-mono text-amber-300">PHASE 2 · RULE FLIP</div>
            <h3 className="font-display text-2xl font-bold text-white">
              Now Pick LOWER
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Suppress your higher-number reflex. Select the expression with the{' '}
              <strong className="text-amber-300">LOWER</strong> result, or{' '}
              <strong className="text-white">Equal</strong> if they tie.
            </p>
            <button
              type="button"
              onClick={resumeAfterShift}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Continue (Space)
            </button>
          </div>
        ) : (
          <div key={current.id} className="w-full space-y-3 animate-card-enter">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handlePick('left')}
                className="h-32 sm:h-40 rounded-2xl bg-[#F8FAFC] hover:bg-white text-slate-950 border-2 border-white border-b-4 border-b-slate-300 shadow-xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-transform active:scale-[0.98] cursor-pointer"
              >
                <span className="text-xs font-medium text-slate-500">Left</span>
                <span className="font-mono text-xl sm:text-3xl font-bold tabular-nums">
                  {current.leftExpr}
                </span>
                {leftValueRevealed && (
                  <span className="text-xs font-mono font-bold text-teal-600">
                    = {current.leftVal}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handlePick('right')}
                className="h-32 sm:h-40 rounded-2xl bg-[#131C2E] hover:bg-slate-800 text-white border-2 border-white/15 border-b-4 border-b-slate-950 shadow-xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-transform active:scale-[0.98] cursor-pointer"
              >
                <span className="text-xs font-medium text-slate-400">Right</span>
                <span className="font-mono text-xl sm:text-3xl font-bold tabular-nums">
                  {current.rightExpr}
                </span>
              </button>
            </div>

            {/* Live Card Fuse */}
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full origin-left ${
                  fuseProgress < 0.3 ? 'bg-rose-500' : 'bg-amber-400'
                }`}
                style={{ transform: `scaleX(${fuseProgress})` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Feedback Line */}
      <div className="h-7 mt-3 flex items-center justify-center">
        {feedback && phase === 'ACTIVE' && (
          <div
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${
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

      {/* 3 Response Keys */}
      <div className="w-full max-w-lg mt-2 grid grid-cols-3 gap-2 sm:gap-2.5">
        <button
          type="button"
          disabled={phase !== 'ACTIVE'}
          onClick={() => handlePick('left')}
          className="h-12 sm:h-13 rounded-xl bg-slate-100 hover:bg-white text-slate-950 border-b-4 border-b-slate-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-transform active:scale-95 disabled:opacity-40 cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 text-teal-600" aria-hidden="true" />
          <span>Left</span>
        </button>

        <button
          type="button"
          disabled={phase !== 'ACTIVE'}
          onClick={() => handlePick('equal')}
          className="h-12 sm:h-13 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/15 border-b-4 border-b-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-transform active:scale-95 disabled:opacity-40 cursor-pointer whitespace-nowrap"
        >
          <ArrowDown className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span>Equal</span>
        </button>

        <button
          type="button"
          disabled={phase !== 'ACTIVE'}
          onClick={() => handlePick('right')}
          className="h-12 sm:h-13 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/15 border-b-4 border-b-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-transform active:scale-95 disabled:opacity-40 cursor-pointer whitespace-nowrap"
        >
          <span>Right</span>
          <ArrowRight className="w-4 h-4 text-teal-400" aria-hidden="true" />
        </button>
      </div>

      <div className="w-full max-w-lg mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{current.rule === 'higher' ? 'Higher Value' : 'Lower Value'}</span>
        </span>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={phase !== 'ACTIVE' || hintsLeft <= 0 || leftValueRevealed}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Solve Left ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
