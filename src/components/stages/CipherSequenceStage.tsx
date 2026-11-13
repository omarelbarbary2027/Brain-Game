import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Eye, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng, randInt, shuffleWithRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

interface CipherPuzzle {
  id: number;
  terms: number[]; // length 5
  missingIndex: number; // 3 or 4
  answer: number;
  options: number[]; // 4 unique numbers
  answerOptionIndex: number;
  clue: string;
}

interface CipherSequenceStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

function buildCipherSeries(
  idx: number,
  difficulty: Difficulty,
  rng: () => number
): Omit<CipherPuzzle, 'id' | 'options' | 'answerOptionIndex'> {
  const allowMissingMid = difficulty !== 'relaxed' && idx >= 4;
  const missingIndex = allowMissingMid && rng() < 0.35 ? 3 : 4;

  // Pick a rule family scaled by puzzle index and difficulty
  const pool =
    difficulty === 'relaxed'
      ? [0, 1, 2]
      : difficulty === 'master'
      ? [1, 2, 3, 4, 5]
      : [0, 1, 2, 3, 4, 5];

  const kind = pool[Math.floor(rng() * pool.length)];

  if (kind === 0) {
    // Arithmetic steady step (or descending)
    const desc = difficulty !== 'relaxed' && rng() < 0.3;
    const step = randInt(3, difficulty === 'master' ? 16 : 11, rng) * (desc ? -1 : 1);
    const start = desc ? randInt(48, 86, rng) : randInt(2, 24, rng);
    const terms = Array.from({ length: 5 }, (_, n) => start + n * step);
    return {
      terms,
      missingIndex,
      answer: terms[missingIndex],
      clue: `Constant ${step >= 0 ? `+${step}` : step} step between terms`,
    };
  }

  if (kind === 1) {
    // Growing difference (+d, +2d, +3d...) or (+a, +a+k...)
    const start = randInt(2, 14, rng);
    const baseDiff = randInt(2, 6, rng);
    const delta = randInt(2, difficulty === 'master' ? 5 : 3, rng);
    const terms = [start];
    for (let n = 1; n < 5; n++) {
      terms.push(terms[n - 1] + baseDiff + (n - 1) * delta);
    }
    return {
      terms,
      missingIndex,
      answer: terms[missingIndex],
      clue: `Differences grow by +${delta} each step`,
    };
  }

  if (kind === 2) {
    // Fibonacci-style sum of previous two
    const a = randInt(2, 9, rng);
    const b = randInt(a + 1, a + 11, rng);
    const terms = [a, b];
    for (let n = 2; n < 5; n++) {
      terms.push(terms[n - 1] + terms[n - 2]);
    }
    return {
      terms,
      missingIndex,
      answer: terms[missingIndex],
      clue: 'Each term equals the sum of the two before it',
    };
  }

  if (kind === 3) {
    // Alternating operations: +a then *2 (or +a then -b)
    if (rng() < 0.5) {
      const start = randInt(2, 8, rng);
      const add = randInt(2, 7, rng);
      const terms = [start];
      for (let n = 1; n < 5; n++) {
        terms.push(n % 2 === 1 ? terms[n - 1] + add : terms[n - 1] * 2);
      }
      return {
        terms,
        missingIndex,
        answer: terms[missingIndex],
        clue: `Alternating rule: +${add}, then ×2`,
      };
    } else {
      const start = randInt(12, 28, rng);
      const up = randInt(6, 13, rng);
      const down = randInt(2, up - 2, rng);
      const terms = [start];
      for (let n = 1; n < 5; n++) {
        terms.push(n % 2 === 1 ? terms[n - 1] + up : terms[n - 1] - down);
      }
      return {
        terms,
        missingIndex,
        answer: terms[missingIndex],
        clue: `Alternating rule: +${up}, then −${down}`,
      };
    }
  }

  if (kind === 4) {
    // Interleaved dual sequences
    const a0 = randInt(4, 18, rng);
    const stepA = randInt(3, 8, rng);
    const b0 = randInt(20, 46, rng);
    const stepB = randInt(-6, -2, rng);
    const terms = [a0, b0, a0 + stepA, b0 + stepB, a0 + 2 * stepA];
    return {
      terms,
      missingIndex,
      answer: terms[missingIndex],
      clue: 'Two interleaved tracks (1st/3rd/5th and 2nd/4th)',
    };
  }

  // kind === 5: Squares + offset
  const baseN = randInt(1, 4, rng);
  const offset = randInt(1, 9, rng);
  const terms = Array.from({ length: 5 }, (_, i) => (baseN + i) * (baseN + i) + offset);
  return {
    terms,
    missingIndex,
    answer: terms[missingIndex],
    clue: `Square sequence (n² + ${offset})`,
  };
}

function generateCipherPuzzles(seed: string, difficulty: Difficulty): CipherPuzzle[] {
  const rng = createSeededRng(`${seed}:cipher:${difficulty}`);
  const total = difficulty === 'relaxed' ? 8 : difficulty === 'master' ? 12 : 10;
  const puzzles: CipherPuzzle[] = [];

  for (let i = 0; i < total; i++) {
    const base = buildCipherSeries(i, difficulty, rng);
    const used = new Set<number>([base.answer]);
    const offsets = shuffleWithRng([-4, -3, -2, -1, 1, 2, 3, 4, 6, -6, 8, -8], rng);
    const distractors: number[] = [];

    for (const off of offsets) {
      if (distractors.length >= 3) break;
      const cand = base.answer + off;
      if (cand > 0 && !used.has(cand)) {
        used.add(cand);
        distractors.push(cand);
      }
    }

    let stepFallback = 1;
    while (distractors.length < 3) {
      const cand = base.answer + stepFallback;
      if (!used.has(cand)) {
        used.add(cand);
        distractors.push(cand);
      }
      stepFallback += 1;
    }

    const options = shuffleWithRng([base.answer, ...distractors], rng);
    const answerOptionIndex = options.indexOf(base.answer);

    puzzles.push({
      id: i,
      ...base,
      options,
      answerOptionIndex,
    });
  }

  return puzzles;
}

export const CipherSequenceStage: React.FC<CipherSequenceStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const puzzles = useMemo(() => generateCipherPuzzles(seed, difficulty), [seed, difficulty]);
  const total = puzzles.length;
  const fuseMs = difficulty === 'relaxed' ? 15000 : difficulty === 'master' ? 8000 : 11000;

  const [idx, setIdx] = useState(0);
  const [fuseProgress, setFuseProgress] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(fuseMs / 1000));
  const [clueRevealed, setClueRevealed] = useState(false);
  const [eliminated, setEliminated] = useState<Set<number>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);

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
  const puzzleStartRef = useRef<number>(performance.now());
  const pauseStartRef = useRef<number | null>(null);
  const isPausedRef = useRef(isPaused);
  const remainingMsRef = useRef(fuseMs);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const current = puzzles[idx];

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current !== null) {
      puzzleStartRef.current += performance.now() - pauseStartRef.current;
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
      discipline: 'cipher',
      label: 'Cipher Sequence',
      score: scoreRef.current,
      accuracy,
      avgReactionMs: avgMs,
      bestStreak: bestStreakRef.current,
      hintsUsed: hintsUsedRef.current,
      roundsCompleted: answeredRef.current,
      totalRounds: total,
    });
  }, [onComplete, total]);

  const advanceNext = useCallback(() => {
    lockRef.current = false;
    setClueRevealed(false);
    setEliminated(new Set());
    setSelectedIdx(null);
    if (idx + 1 >= total) {
      finishStage();
    } else {
      setIdx((v) => v + 1);
      remainingMsRef.current = fuseMs;
      setFuseProgress(1);
      setSecondsLeft(Math.ceil(fuseMs / 1000));
      puzzleStartRef.current = performance.now();
    }
  }, [idx, total, fuseMs, finishStage]);

  const handleTimeout = useCallback(() => {
    if (lockRef.current) return;
    lockRef.current = true;
    answeredRef.current += 1;
    streakRef.current = 0;
    setStreak(0);
    setSelectedIdx(current.answerOptionIndex);
    sound.playMiss();
    setFeedback({
      correct: false,
      text: `Time expired · Missing value was ${current.answer}`,
    });
    timerRef.current = window.setTimeout(advanceNext, 750);
  }, [current.answer, current.answerOptionIndex, advanceNext]);

  useEffect(() => {
    remainingMsRef.current = fuseMs;
    setFuseProgress(1);
    setSecondsLeft(Math.ceil(fuseMs / 1000));
    puzzleStartRef.current = performance.now();

    let lastTick = performance.now();
    let lastSec = Math.ceil(fuseMs / 1000);
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current && !lockRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remainingMsRef.current = Math.max(0, remainingMsRef.current - dt);
        setFuseProgress(remainingMsRef.current / fuseMs);

        const sec = Math.ceil(remainingMsRef.current / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          setSecondsLeft(sec);
          if (sec <= 3 && sec > 0) sound.playUrgentTick();
        }

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

  const handleSelectOption = useCallback(
    (optIdx: number) => {
      if (isPausedRef.current || lockRef.current || eliminated.has(optIdx)) return;
      lockRef.current = true;
      setSelectedIdx(optIdx);

      const now = performance.now();
      const reactionMs = Math.max(200, Math.round(now - puzzleStartRef.current));
      answeredRef.current += 1;

      if (optIdx === current.answerOptionIndex) {
        correctRef.current += 1;
        reactionTimesRef.current.push(reactionMs);
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

        const speedBonus = reactionMs < 2400 ? 75 : reactionMs < 4800 ? 45 : 20;
        const pts = 110 + speedBonus + Math.min(nextStreak * 15, 75);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        sound.playSuccess(nextStreak);
        setFeedback({ correct: true, text: `+${pts} pts · ${reactionMs} ms` });
        timerRef.current = window.setTimeout(advanceNext, 340);
      } else {
        streakRef.current = 0;
        setStreak(0);
        sound.playMiss();
        setFeedback({
          correct: false,
          text: `Missed · Answer was ${current.answer}`,
        });
        timerRef.current = window.setTimeout(advanceNext, 780);
      }
    },
    [eliminated, current.answerOptionIndex, current.answer, advanceNext]
  );

  const handleUseHint = useCallback(() => {
    if (isPausedRef.current || lockRef.current || hintsLeft <= 0 || clueRevealed) return;
    const wrongIndices = [0, 1, 2, 3].filter((i) => i !== current.answerOptionIndex);
    setEliminated(new Set(wrongIndices.slice(0, 1)));
    setClueRevealed(true);
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
  }, [hintsLeft, clueRevealed, current.answerOptionIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPausedRef.current) return;
      if (e.key === '1') {
        e.preventDefault();
        handleSelectOption(0);
      } else if (e.key === '2') {
        e.preventDefault();
        handleSelectOption(1);
      } else if (e.key === '3') {
        e.preventDefault();
        handleSelectOption(2);
      } else if (e.key === '4') {
        e.preventDefault();
        handleSelectOption(3);
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleUseHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectOption, handleUseHint]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-3 sm:px-4 select-none">
      {/* Progress & Timer */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
          <span className="text-teal-300 font-semibold">Deduce the Missing Number</span>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span
              className={`inline-flex items-center gap-1 ${
                secondsLeft <= 3 ? 'text-rose-400 font-bold' : 'text-teal-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {secondsLeft}s
            </span>
            <span className="text-slate-400">
              Series {idx + 1}/{total}
            </span>
          </div>
        </div>

        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full origin-left ${
              secondsLeft <= 3 ? 'bg-rose-500' : 'bg-amber-400'
            }`}
            style={{ transform: `scaleX(${fuseProgress})` }}
          />
        </div>
      </div>

      {/* 5-Tile Number Sequence Board */}
      <div className="w-full max-w-md rounded-2xl bg-[#131C2E] border-2 border-white/15 p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
          {current.terms.map((val, pos) => {
            const isMissing = pos === current.missingIndex;
            const revealed = isMissing && selectedIdx !== null;
            return (
              <div
                key={`${current.id}-${pos}`}
                className={`h-14 sm:h-16 rounded-xl border-2 flex items-center justify-center font-mono text-lg sm:text-2xl font-bold tabular-nums ${
                  revealed
                    ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 animate-tile-pop'
                    : isMissing
                    ? 'bg-slate-900 border-dashed border-amber-400 text-amber-300'
                    : 'bg-[#F8FAFC] border-white text-slate-950 shadow-md'
                }`}
              >
                {isMissing && !revealed ? '?' : val}
              </div>
            );
          })}
        </div>

        {clueRevealed && (
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-400/35 text-xs text-amber-200 text-center">
            Clue: {current.clue}
          </div>
        )}
      </div>

      {/* Feedback Line */}
      <div className="h-7 mt-3 flex items-center justify-center">
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

      {/* 4 Answer Choices */}
      <div className="w-full max-w-md mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {current.options.map((opt, optIdx) => {
          const isElim = eliminated.has(optIdx);
          const isSelected = selectedIdx === optIdx;
          const isCorrectChoice = selectedIdx !== null && optIdx === current.answerOptionIndex;
          const isWrongSelected = isSelected && optIdx !== current.answerOptionIndex;

          return (
            <button
              key={optIdx}
              type="button"
              disabled={isElim || selectedIdx !== null}
              onClick={() => handleSelectOption(optIdx)}
              className={`relative h-14 rounded-xl border-2 border-b-4 font-mono text-lg font-bold tabular-nums flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:cursor-not-allowed cursor-pointer ${
                isElim
                  ? 'opacity-20 bg-slate-900 border-white/5 text-slate-600'
                  : isCorrectChoice
                  ? 'bg-emerald-950/75 border-emerald-400 text-emerald-300'
                  : isWrongSelected
                  ? 'bg-rose-950/85 border-rose-500 text-rose-300 animate-tile-shake'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-white border-white/15 border-b-slate-950'
              }`}
            >
              <span>{opt}</span>
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                [{optIdx + 1}]
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer Controls & Hint */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400">Keys 1–4 or Tap</span>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={hintsLeft <= 0 || clueRevealed || selectedIdx !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Pattern Clue ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
