import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Eye, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

type ColorId = 'teal' | 'amber' | 'rose' | 'ivory';
type StroopDirective = 'ink' | 'word';

interface StroopPrompt {
  id: number;
  word: ColorId;
  ink: ColorId;
  directive: StroopDirective;
  answer: ColorId;
}

interface StroopReflexStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

const COLORS: {
  id: ColorId;
  label: string;
  textClass: string;
  btnClass: string;
  keyHint: string;
}[] = [
  {
    id: 'teal',
    label: 'Teal',
    textClass: 'text-teal-400',
    btnClass: 'border-teal-400/70 bg-teal-950/60 text-teal-200 hover:bg-teal-900/70',
    keyHint: '1',
  },
  {
    id: 'amber',
    label: 'Amber',
    textClass: 'text-amber-400',
    btnClass: 'border-amber-400/70 bg-amber-950/60 text-amber-200 hover:bg-amber-900/70',
    keyHint: '2',
  },
  {
    id: 'rose',
    label: 'Rose',
    textClass: 'text-rose-400',
    btnClass: 'border-rose-400/70 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70',
    keyHint: '3',
  },
  {
    id: 'ivory',
    label: 'Ivory',
    textClass: 'text-slate-100',
    btnClass: 'border-white/70 bg-slate-100 text-slate-950 hover:bg-white',
    keyHint: '4',
  },
];

const ColorShapeIcon: React.FC<{ id: ColorId; size?: number }> = ({ id, size = 16 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      {id === 'teal' && (
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
      )}
      {id === 'amber' && (
        <polygon points="12,4 20,19 4,19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {id === 'rose' && (
        <polygon points="12,3 21,12 12,21 3,12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {id === 'ivory' && (
        <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
      )}
    </svg>
  );
};

function getFuseMs(difficulty: Difficulty, directive: StroopDirective, idx: number, shiftIdx: number): number {
  const base = difficulty === 'relaxed' ? 2700 : difficulty === 'master' ? 1450 : 1950;
  return idx >= shiftIdx ? base + (directive === 'word' ? 150 : 100) : base;
}

function generatePrompts(seed: string, difficulty: Difficulty): {
  prompts: StroopPrompt[];
  shiftIdx: number;
} {
  const rng = createSeededRng(`${seed}:stroop:${difficulty}`);
  const total = difficulty === 'relaxed' ? 15 : difficulty === 'master' ? 22 : 18;
  const shiftIdx = Math.floor(total / 2);

  const ids: ColorId[] = ['teal', 'amber', 'rose', 'ivory'];
  const prompts: StroopPrompt[] = [];

  for (let i = 0; i < total; i++) {
    const word = ids[Math.floor(rng() * ids.length)];
    // 78% incongruent interference
    let ink: ColorId;
    if (rng() < 0.78) {
      const others = ids.filter((c) => c !== word);
      ink = others[Math.floor(rng() * others.length)];
    } else {
      ink = word;
    }

    const directive: StroopDirective =
      i < shiftIdx ? 'ink' : rng() < 0.5 ? 'ink' : 'word';
    const answer = directive === 'ink' ? ink : word;

    prompts.push({
      id: i,
      word,
      ink,
      directive,
      answer,
    });
  }

  return { prompts, shiftIdx };
}

export const StroopReflexStage: React.FC<StroopReflexStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const { prompts, shiftIdx } = useMemo(
    () => generatePrompts(seed, difficulty),
    [seed, difficulty]
  );
  const total = prompts.length;

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'ACTIVE' | 'RULE_SHIFT'>('ACTIVE');
  const [fuseProgress, setFuseProgress] = useState(1);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [eliminated, setEliminated] = useState<Set<ColorId>>(new Set());

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

  const current = prompts[idx];
  const fuseMs = getFuseMs(difficulty, current.directive, idx, shiftIdx);

  useEffect(() => {
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
      discipline: 'stroop',
      label: 'Stroop Reflex',
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
    setEliminated(new Set());
    if (idx + 1 >= total) {
      finishStage();
    } else {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setFuseProgress(1);
      if (nextIdx === shiftIdx) {
        sound.playRuleShift();
        setPhase('RULE_SHIFT');
      } else {
        promptStartRef.current = performance.now();
      }
    }
  }, [idx, total, shiftIdx, finishStage]);

  const handleTimeout = useCallback(() => {
    if (lockRef.current || phase !== 'ACTIVE') return;
    lockRef.current = true;
    answeredRef.current += 1;
    streakRef.current = 0;
    setStreak(0);
    sound.playMiss();
    setFeedback({ correct: false, text: `Time expired · Answer was ${current.answer}` });
    setTimeout(advanceNext, 260);
  }, [phase, current.answer, advanceNext]);

  useEffect(() => {
    if (phase !== 'ACTIVE') return;
    setFuseProgress(1);

    let remaining = fuseMs;
    let lastTick = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPaused && !lockRef.current) {
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
  }, [phase, idx, fuseMs, isPaused, handleTimeout]);

  const handlePick = useCallback(
    (choice: ColorId) => {
      if (isPaused || phase !== 'ACTIVE' || lockRef.current || eliminated.has(choice)) return;
      lockRef.current = true;

      const now = performance.now();
      const reactionMs = Math.max(90, Math.round(now - promptStartRef.current));
      answeredRef.current += 1;

      if (choice === current.answer) {
        correctRef.current += 1;
        reactionTimesRef.current.push(reactionMs);
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

        const speedBonus = reactionMs < 480 ? 60 : reactionMs < 820 ? 35 : 15;
        const shiftBonus = idx >= shiftIdx ? 25 : 0;
        const pts = 80 + shiftBonus + speedBonus + Math.min(nextStreak * 10, 80);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        sound.playSuccess(nextStreak);
        setFeedback({ correct: true, text: `+${pts} pts · ${reactionMs} ms` });
      } else {
        streakRef.current = 0;
        setStreak(0);
        sound.playMiss();
        setFeedback({
          correct: false,
          text: `Missed · Needed ${current.answer.toUpperCase()}`,
        });
      }

      setTimeout(advanceNext, 160);
    },
    [isPaused, phase, eliminated, current.answer, idx, shiftIdx, advanceNext]
  );

  const handleUseHint = useCallback(() => {
    if (isPaused || phase !== 'ACTIVE' || hintsLeft <= 0 || eliminated.size > 0) return;
    const wrongChoices = COLORS.map((c) => c.id).filter((id) => id !== current.answer);
    setEliminated(new Set(wrongChoices.slice(0, 2)));
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
  }, [isPaused, phase, hintsLeft, eliminated.size, current.answer]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPaused) return;
      if (phase === 'RULE_SHIFT' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        resumeAfterShift();
        return;
      }
      if (phase !== 'ACTIVE') return;
      if (e.key === '1') {
        e.preventDefault();
        handlePick('teal');
      } else if (e.key === '2') {
        e.preventDefault();
        handlePick('amber');
      } else if (e.key === '3') {
        e.preventDefault();
        handlePick('rose');
      } else if (e.key === '4') {
        e.preventDefault();
        handlePick('ivory');
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleUseHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPaused, phase, resumeAfterShift, handlePick, handleUseHint]);

  const inkMeta = COLORS.find((c) => c.id === current.ink)!;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 select-none">
      {/* Progress & Directive */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          <span
            className={
              current.directive === 'word'
                ? 'text-amber-300 font-semibold'
                : 'text-teal-300 font-semibold'
            }
          >
            {phase === 'RULE_SHIFT'
              ? 'Directive Escalation'
              : current.directive === 'ink'
              ? 'Directive: Tap the INK COLOR'
              : 'Directive: Tap the WORD MEANING'}
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {idx + 1} / {total}
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-400 transition-transform duration-150 origin-left"
            style={{ transform: `scaleX(${(idx + 1) / total})` }}
          />
        </div>
      </div>

      {/* Central Stimulus Card */}
      <div className="relative w-full max-w-md flex flex-col items-center justify-center min-h-[220px]">
        {phase === 'RULE_SHIFT' ? (
          <div className="w-full rounded-2xl bg-[#131C2E] border-2 border-amber-400/80 p-6 text-center shadow-2xl animate-card-enter space-y-3">
            <div className="text-xs font-mono text-amber-300">PHASE 2 · DUAL DIRECTIVE</div>
            <h3 className="font-display text-2xl font-bold text-white">
              Watch the Directive
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Prompts now alternate between <strong className="text-teal-300">INK COLOR</strong> and{' '}
              <strong className="text-amber-300">WORD MEANING</strong>. Read the directive banner before tapping.
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
          <div
            key={current.id}
            className="w-full rounded-2xl bg-[#131C2E] border-2 border-white/15 p-7 shadow-2xl flex flex-col items-center justify-between gap-5 animate-card-enter"
          >
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
              <span
                className={
                  current.directive === 'ink'
                    ? 'text-teal-300 font-bold'
                    : 'text-amber-300 font-bold'
                }
              >
                {current.directive === 'ink' ? 'Match Ink Color' : 'Match Word Meaning'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-center gap-3">
              <span
                className={`font-display text-5xl sm:text-6xl font-bold tracking-tight uppercase ${inkMeta.textClass}`}
              >
                {current.word}
              </span>
            </div>

            {/* Live Card Fuse */}
            <div className="w-full space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full origin-left ${
                    fuseProgress < 0.3 ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{ transform: `scaleX(${fuseProgress})` }}
                />
              </div>
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

      {/* 4 Tactile Answer Keys */}
      <div className="w-full max-w-md mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {COLORS.map((c) => {
          const isEliminated = eliminated.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={phase !== 'ACTIVE' || isEliminated}
              onClick={() => handlePick(c.id)}
              className={`h-14 rounded-xl border-2 border-b-4 font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer ${c.btnClass}`}
            >
              <ColorShapeIcon id={c.id} />
              <span>{c.label}</span>
              <span className="text-[11px] font-mono opacity-65 hidden sm:inline">
                [{c.keyHint}]
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-md mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Keys 1–4 or Tap</span>
        </span>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={phase !== 'ACTIVE' || hintsLeft <= 0 || eliminated.size > 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Narrow 2 ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
