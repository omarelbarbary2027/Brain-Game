import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Eye, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import { createSeededRng, shuffleWithRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

type MatrixShape = 'circle' | 'triangle' | 'diamond';
type MatrixStyle = 'teal' | 'amber' | 'ivory';
type MatrixCount = 1 | 2 | 3;

interface MatrixCellSpec {
  shape: MatrixShape;
  style: MatrixStyle;
  count: MatrixCount;
}

interface MatrixPuzzle {
  id: number;
  grid: MatrixCellSpec[];
  answer: MatrixCellSpec;
  options: MatrixCellSpec[];
  answerOptionIndex: number;
}

interface MatrixLogicStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

const SHAPES: MatrixShape[] = ['circle', 'triangle', 'diamond'];
const STYLES: MatrixStyle[] = ['teal', 'amber', 'ivory'];
const COUNTS: MatrixCount[] = [1, 2, 3];

type RuleKind = 'rowConstant' | 'colConstant' | 'latinCycle' | 'diagonalCycle' | 'allSame';

function applyRule<T>(perm: readonly T[], rule: RuleKind, r: number, c: number): T {
  switch (rule) {
    case 'allSame':
      return perm[0];
    case 'rowConstant':
      return perm[r];
    case 'colConstant':
      return perm[c];
    case 'latinCycle':
      return perm[(r + c) % 3];
    case 'diagonalCycle':
      return perm[(r - c + 3) % 3];
  }
}

function cellKey(cell: MatrixCellSpec): string {
  return `${cell.shape}-${cell.style}-${cell.count}`;
}

function generateMatrixPuzzles(seed: string, difficulty: Difficulty): MatrixPuzzle[] {
  const rng = createSeededRng(`${seed}:matrix:${difficulty}`);
  const total = difficulty === 'relaxed' ? 8 : difficulty === 'master' ? 12 : 10;
  const puzzles: MatrixPuzzle[] = [];

  for (let i = 0; i < total; i++) {
    const shapePerm = shuffleWithRng(SHAPES, rng);
    const stylePerm = shuffleWithRng(STYLES, rng);
    const countPerm = shuffleWithRng(COUNTS, rng);

    let shapeRule: RuleKind;
    let styleRule: RuleKind;
    let countRule: RuleKind;

    if (difficulty === 'relaxed') {
      const simpleRules: RuleKind[] = ['rowConstant', 'colConstant', 'latinCycle'];
      const chosen = shuffleWithRng(simpleRules, rng);
      shapeRule = chosen[0];
      styleRule = chosen[1];
      countRule = i < 3 ? 'allSame' : chosen[2];
    } else if (difficulty === 'master') {
      const hardRules: RuleKind[] = ['latinCycle', 'diagonalCycle', 'rowConstant', 'colConstant'];
      const chosen = shuffleWithRng(hardRules, rng);
      shapeRule = i % 2 === 0 ? 'latinCycle' : 'diagonalCycle';
      styleRule = chosen[0];
      countRule = i >= 4 ? (i % 2 === 0 ? 'diagonalCycle' : 'latinCycle') : chosen[1];
    } else {
      const stdRules: RuleKind[] = ['rowConstant', 'colConstant', 'latinCycle', 'diagonalCycle'];
      const chosen = shuffleWithRng(stdRules, rng);
      shapeRule = chosen[0];
      styleRule = chosen[1];
      countRule = i < 2 ? 'rowConstant' : chosen[2];
    }

    const grid: MatrixCellSpec[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid.push({
          shape: applyRule(shapePerm, shapeRule, r, c),
          style: applyRule(stylePerm, styleRule, r, c),
          count: applyRule(countPerm, countRule, r, c),
        });
      }
    }

    const answer = grid[8];
    const used = new Set<string>([cellKey(answer)]);
    const distractors: MatrixCellSpec[] = [];

    let guard = 0;
    while (distractors.length < 3 && guard < 60) {
      guard += 1;
      const flipShape = rng() < 0.55;
      const flipStyle = rng() < 0.55;
      const flipCount = rng() < 0.55 || (!flipShape && !flipStyle);

      const cand: MatrixCellSpec = {
        shape: flipShape ? SHAPES[Math.floor(rng() * SHAPES.length)] : answer.shape,
        style: flipStyle ? STYLES[Math.floor(rng() * STYLES.length)] : answer.style,
        count: flipCount ? COUNTS[Math.floor(rng() * COUNTS.length)] : answer.count,
      };
      const k = cellKey(cand);
      if (!used.has(k)) {
        used.add(k);
        distractors.push(cand);
      }
    }

    for (const s of SHAPES) {
      for (const st of STYLES) {
        for (const cnt of COUNTS) {
          if (distractors.length >= 3) break;
          const cand: MatrixCellSpec = { shape: s, style: st, count: cnt };
          const k = cellKey(cand);
          if (!used.has(k)) {
            used.add(k);
            distractors.push(cand);
          }
        }
      }
    }

    const options = shuffleWithRng([answer, ...distractors], rng);
    const answerOptionIndex = options.findIndex((o) => cellKey(o) === cellKey(answer));

    puzzles.push({
      id: i,
      grid,
      answer,
      options,
      answerOptionIndex,
    });
  }

  return puzzles;
}

const MatrixGlyph: React.FC<{ spec: MatrixCellSpec; compact?: boolean }> = ({
  spec,
  compact = false,
}) => {
  const stroke =
    spec.style === 'teal' ? '#2DD4BF' : spec.style === 'amber' ? '#FBBF24' : '#F8FAFC';
  const fill =
    spec.style === 'ivory'
      ? '#F8FAFC'
      : spec.style === 'teal'
      ? 'rgba(45, 212, 191, 0.24)'
      : 'transparent';

  const positions: Record<MatrixCount, [number, number][]> = {
    1: [[50, 50]],
    2: [
      [30, 50],
      [70, 50],
    ],
    3: [
      [50, 27],
      [28, 70],
      [72, 70],
    ],
  };

  const r = spec.count === 1 ? 22 : spec.count === 2 ? 14 : 12;
  const size = compact ? 46 : 58;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      {positions[spec.count].map(([cx, cy], idx) => (
        <g key={idx}>
          {spec.shape === 'circle' && (
            <>
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="5.5" />
              {spec.style === 'teal' && (
                <line
                  x1={cx - r + 4}
                  y1={cy}
                  x2={cx + r - 4}
                  y2={cy}
                  stroke={stroke}
                  strokeWidth="4"
                />
              )}
              {spec.style === 'amber' && (
                <circle cx={cx} cy={cy} r={Math.max(3, r * 0.35)} fill={stroke} />
              )}
            </>
          )}

          {spec.shape === 'triangle' && (
            <>
              <polygon
                points={`${cx},${cy - r} ${cx + r},${cy + r * 0.85} ${cx - r},${cy + r * 0.85}`}
                fill={fill}
                stroke={stroke}
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
              {spec.style === 'teal' && (
                <line
                  x1={cx - r * 0.55}
                  y1={cy + r * 0.35}
                  x2={cx + r * 0.55}
                  y2={cy + r * 0.35}
                  stroke={stroke}
                  strokeWidth="3.5"
                />
              )}
              {spec.style === 'amber' && (
                <circle cx={cx} cy={cy + r * 0.25} r={Math.max(2.5, r * 0.25)} fill={stroke} />
              )}
            </>
          )}

          {spec.shape === 'diamond' && (
            <>
              <polygon
                points={`${cx},${cy - r * 1.05} ${cx + r * 1.05},${cy} ${cx},${cy + r * 1.05} ${
                  cx - r * 1.05
                },${cy}`}
                fill={fill}
                stroke={stroke}
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
              {spec.style === 'teal' && (
                <line
                  x1={cx - r * 0.65}
                  y1={cy}
                  x2={cx + r * 0.65}
                  y2={cy}
                  stroke={stroke}
                  strokeWidth="3.5"
                />
              )}
              {spec.style === 'amber' && (
                <circle cx={cx} cy={cy} r={Math.max(2.5, r * 0.28)} fill={stroke} />
              )}
            </>
          )}
        </g>
      ))}
    </svg>
  );
};

export const MatrixLogicStage: React.FC<MatrixLogicStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const puzzles = useMemo(() => generateMatrixPuzzles(seed, difficulty), [seed, difficulty]);
  const total = puzzles.length;
  const fuseMs = difficulty === 'relaxed' ? 22000 : difficulty === 'master' ? 12000 : 16000;

  const [idx, setIdx] = useState(0);
  const [fuseProgress, setFuseProgress] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(fuseMs / 1000));
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
  const arRef = useRef(ar);
  arRef.current = ar;

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
      discipline: 'matrix',
      label: 'Matrix Logic',
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
      text: arRef.current
        ? `انتهى الوقت · الخيار الصحيح #${current.answerOptionIndex + 1}`
        : `Time expired · Correct tile was #${current.answerOptionIndex + 1}`,
    });
    timerRef.current = window.setTimeout(advanceNext, 750);
  }, [current.answerOptionIndex, advanceNext]);

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

        const speedBonus = reactionMs < 2600 ? 75 : reactionMs < 5000 ? 45 : 20;
        const pts = 110 + speedBonus + Math.min(nextStreak * 15, 75);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        sound.playSuccess(nextStreak);
        setFeedback({
          correct: true,
          text: ar ? `+${pts} نقطة · ${reactionMs} ms` : `+${pts} pts · ${reactionMs} ms`,
        });
        timerRef.current = window.setTimeout(advanceNext, 340);
      } else {
        streakRef.current = 0;
        setStreak(0);
        sound.playMiss();
        setFeedback({
          correct: false,
          text: ar
            ? `خطأ · الخيار #${current.answerOptionIndex + 1} هو المكمل الصحيح`
            : `Missed · Option #${current.answerOptionIndex + 1} completed the rule`,
        });
        timerRef.current = window.setTimeout(advanceNext, 780);
      }
    },
    [eliminated, current.answerOptionIndex, advanceNext, ar]
  );

  const handleUseHint = useCallback(() => {
    if (isPausedRef.current || lockRef.current || hintsLeft <= 0 || eliminated.size > 0) return;
    const wrongIndices = [0, 1, 2, 3].filter((i) => i !== current.answerOptionIndex);
    setEliminated(new Set(wrongIndices.slice(0, 2)));
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
  }, [hintsLeft, eliminated.size, current.answerOptionIndex]);

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
    <div className="flex flex-col items-center justify-center w-full my-auto py-2 px-3 sm:px-4 select-none">
      {/* Progress & Timer */}
      <div className="w-full max-w-md mb-3 sm:mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
          <span className="text-teal-300 font-semibold">
            {ar ? 'أكمل النمط البصري 3×3' : 'Complete the 3×3 Visual Rule'}
          </span>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span
              dir="ltr"
              className={`inline-flex items-center gap-1 ${
                secondsLeft <= 3 ? 'text-rose-400 font-bold' : 'text-teal-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {secondsLeft}s
            </span>
            <span className="text-slate-400">
              {ar ? `اللغز ${idx + 1}/${total}` : `Puzzle ${idx + 1}/${total}`}
            </span>
          </div>
        </div>

        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full ltr:origin-left rtl:origin-right ${
              secondsLeft <= 3 ? 'bg-rose-500' : 'bg-amber-400'
            }`}
            style={{ transform: `scaleX(${fuseProgress})` }}
          />
        </div>
      </div>

      {/* 3x3 Raven Matrix Board (kept LTR so bottom-right missing slot aligns visually) */}
      <div dir="ltr" className="p-2.5 sm:p-4 rounded-2xl bg-[#131C2E] border border-white/15 shadow-2xl">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
          {current.grid.map((cell, cellIdx) => {
            const isMissing = cellIdx === 8;
            const isSolvedReveal = isMissing && selectedIdx !== null;
            return (
              <div
                key={`${current.id}-${cellIdx}`}
                className={`w-[74px] h-[74px] sm:w-22 sm:h-22 rounded-xl flex items-center justify-center border ${
                  isSolvedReveal
                    ? 'bg-slate-800 border-2 border-teal-400 animate-tile-pop'
                    : isMissing
                    ? 'bg-slate-900/90 border-2 border-dashed border-amber-400/80 text-amber-300'
                    : 'bg-slate-900/85 border-white/10'
                }`}
              >
                {isMissing && !isSolvedReveal ? (
                  <span className="font-display text-2xl sm:text-3xl font-bold">?</span>
                ) : (
                  <MatrixGlyph spec={cell} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback Line */}
      <div className="h-6 mt-2.5 flex items-center justify-center">
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
            <span dir="ltr" className="font-mono tabular-nums">
              {feedback.text}
            </span>
          </div>
        )}
      </div>

      {/* 4 Candidate Choices (kept LTR so 1-4 stay ordered) */}
      <div dir="ltr" className="w-full max-w-md mt-1.5 grid grid-cols-4 gap-2">
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
              aria-label={
                ar
                  ? `الخيار ${optIdx + 1}`
                  : `Option ${optIdx + 1}: ${opt.count} ${opt.style} ${opt.shape}`
              }
              className={`relative h-[74px] sm:h-20 rounded-xl border-2 border-b-4 flex flex-col items-center justify-center transition-transform active:scale-95 disabled:cursor-not-allowed cursor-pointer ${
                isElim
                  ? 'opacity-20 bg-slate-900 border-white/5'
                  : isCorrectChoice
                  ? 'bg-emerald-950/70 border-emerald-400'
                  : isWrongSelected
                  ? 'bg-rose-950/80 border-rose-500 animate-tile-shake'
                  : 'bg-slate-800/90 hover:bg-slate-700 border-white/15 border-b-slate-950'
              }`}
            >
              <MatrixGlyph spec={opt} compact />
              <span className="absolute top-1 left-1.5 text-[10px] font-mono text-slate-400">
                {optIdx + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls & Hint */}
      <div className="w-full max-w-md mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {ar ? 'مفاتيح 1–4 أو اضغط الخيار' : 'Keys 1–4 or Tap Candidate'}
        </span>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={hintsLeft <= 0 || eliminated.size > 0 || selectedIdx !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>{ar ? `استبعاد خيارين (${hintsLeft})` : `Narrow 2 (${hintsLeft})`}</span>
        </button>
      </div>
    </div>
  );
};
