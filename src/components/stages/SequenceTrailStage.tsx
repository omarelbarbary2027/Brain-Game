import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Eye, Lock, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng, shuffleWithRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

interface SequenceTrailStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

interface TrailConfig {
  gridSize: number;
  nodeCount: number;
  blockerCount: number;
  studyMs: number;
  traceMs: number;
  reverse: boolean;
}

function getTrailConfigs(difficulty: Difficulty): TrailConfig[] {
  if (difficulty === 'relaxed') {
    return [
      { gridSize: 4, nodeCount: 4, blockerCount: 0, studyMs: 3000, traceMs: 18000, reverse: false },
      { gridSize: 4, nodeCount: 5, blockerCount: 2, studyMs: 3000, traceMs: 18000, reverse: false },
      { gridSize: 5, nodeCount: 6, blockerCount: 3, studyMs: 3100, traceMs: 20000, reverse: false },
      { gridSize: 5, nodeCount: 5, blockerCount: 2, studyMs: 3200, traceMs: 20000, reverse: true },
    ];
  }
  if (difficulty === 'master') {
    return [
      { gridSize: 4, nodeCount: 5, blockerCount: 2, studyMs: 1850, traceMs: 11000, reverse: false },
      { gridSize: 5, nodeCount: 7, blockerCount: 4, studyMs: 2050, traceMs: 13000, reverse: false },
      { gridSize: 6, nodeCount: 8, blockerCount: 5, studyMs: 2250, traceMs: 14500, reverse: false },
      { gridSize: 6, nodeCount: 8, blockerCount: 5, studyMs: 2400, traceMs: 15500, reverse: true },
    ];
  }
  return [
    { gridSize: 4, nodeCount: 4, blockerCount: 0, studyMs: 2400, traceMs: 14000, reverse: false },
    { gridSize: 5, nodeCount: 6, blockerCount: 3, studyMs: 2550, traceMs: 15000, reverse: false },
    { gridSize: 5, nodeCount: 7, blockerCount: 4, studyMs: 2700, traceMs: 16500, reverse: false },
    { gridSize: 5, nodeCount: 7, blockerCount: 3, studyMs: 2800, traceMs: 17500, reverse: true },
  ];
}

type Phase = 'STUDY' | 'TRACE' | 'ROUND_END';

export const SequenceTrailStage: React.FC<SequenceTrailStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const configs = useMemo(() => getTrailConfigs(difficulty), [difficulty]);
  const totalRounds = configs.length;

  const roundNodes = useMemo(() => {
    const rng = createSeededRng(`${seed}:sequence_v2:${difficulty}`);
    return configs.map((cfg) => {
      const indices = Array.from({ length: cfg.gridSize * cfg.gridSize }, (_, i) => i);
      const shuffled = shuffleWithRng(indices, rng);
      const chosen = shuffled.slice(0, cfg.nodeCount);
      const blockers = new Set(
        shuffled.slice(cfg.nodeCount, cfg.nodeCount + cfg.blockerCount)
      );
      const cellToNumber = new Map<number, number>();
      chosen.forEach((cellIdx, idx) => {
        cellToNumber.set(cellIdx, idx + 1);
      });

      // Sequence of cells in the exact order player must tap them
      const targetTapSequence = cfg.reverse ? [...chosen].reverse() : [...chosen];

      return {
        chosen,
        targetTapSequence,
        blockers,
        cellToNumber,
      };
    });
  }, [seed, difficulty, configs]);

  const [roundIdx, setRoundIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('STUDY');
  const [studyProgress, setStudyProgress] = useState(1);
  const [traceProgress, setTraceProgress] = useState(1);
  const [traceSecondsLeft, setTraceSecondsLeft] = useState(0);
  const [stepsFound, setStepsFound] = useState(0);
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const [hintCell, setHintCell] = useState<number | null>(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [roundMistakes, setRoundMistakes] = useState(0);
  const [statusNote, setStatusNote] = useState<string>('Study the sequence or tap 1 to start');

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const correctRef = useRef(0);
  const totalTapsRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const completedRoundsRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const lastStepTimeRef = useRef<number>(performance.now());
  const pauseStartRef = useRef<number | null>(null);
  const traceRemainingMsRef = useRef(0);
  const finishedRef = useRef(false);
  const isPausedRef = useRef(isPaused);

  const cfg = configs[roundIdx];
  const currentRoundData = roundNodes[roundIdx];
  const startNumber = cfg.reverse ? cfg.nodeCount : 1;
  const expectedNumber = cfg.reverse ? cfg.nodeCount - stepsFound : stepsFound + 1;

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current !== null) {
      lastStepTimeRef.current += performance.now() - pauseStartRef.current;
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
      round: roundIdx + 1,
      totalRounds,
    });
  }, [score, streak, roundIdx, totalRounds, onHudUpdate]);

  const finishStage = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const total = totalTapsRef.current;
    const accuracy = total > 0 ? Math.round((correctRef.current / total) * 100) : 100;
    const times = reactionTimesRef.current;
    const avgMs =
      times.length > 0
        ? Math.round(times.reduce((sum, v) => sum + v, 0) / times.length)
        : 0;

    sound.playStageClear();
    onComplete({
      discipline: 'sequence',
      label: 'Sequence Trail',
      score: scoreRef.current,
      accuracy,
      avgReactionMs: avgMs,
      bestStreak: bestStreakRef.current,
      hintsUsed: hintsUsedRef.current,
      roundsCompleted: completedRoundsRef.current,
      totalRounds,
    });
  }, [onComplete, totalRounds]);

  const advanceRound = useCallback(
    (delayMs: number) => {
      setPhase('ROUND_END');
      setTimeout(() => {
        if (roundIdx + 1 >= totalRounds) {
          finishStage();
        } else {
          setRoundIdx((r) => r + 1);
          setStepsFound(0);
          setWrongCell(null);
          setHintCell(null);
          setRoundMistakes(0);
          setPhase('STUDY');
        }
      }, delayMs);
    },
    [roundIdx, totalRounds, finishStage]
  );

  // Study phase timer (pause-safe)
  useEffect(() => {
    if (phase !== 'STUDY') return;
    setStudyProgress(1);
    if (cfg.reverse) {
      sound.playRuleShift();
      setStatusNote(`REVERSE ROUND: Tap ${cfg.nodeCount} down to 1`);
    } else {
      setStatusNote('Memorize path — tap 1 anytime for Quick-Start bonus');
    }
    lastStepTimeRef.current = performance.now();

    let remaining = cfg.studyMs;
    let lastTick = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remaining = Math.max(0, remaining - dt);
        setStudyProgress(remaining / cfg.studyMs);
        if (remaining <= 0) {
          setPhase('TRACE');
          setTraceProgress(1);
          traceRemainingMsRef.current = cfg.traceMs;
          setTraceSecondsLeft(Math.ceil(cfg.traceMs / 1000));
          setStatusNote(`Tap concealed node ${startNumber}`);
          lastStepTimeRef.current = performance.now();
          sound.playTick();
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, cfg, startNumber]);

  // Live Trace Countdown Fuse (pause-safe)
  useEffect(() => {
    if (phase !== 'TRACE') return;

    traceRemainingMsRef.current = cfg.traceMs;
    let lastTick = performance.now();
    let lastSec = Math.ceil(traceRemainingMsRef.current / 1000);
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current) {
        const dt = Math.min(now - lastTick, 50);
        traceRemainingMsRef.current = Math.max(0, traceRemainingMsRef.current - dt);
        setTraceProgress(traceRemainingMsRef.current / cfg.traceMs);

        const sec = Math.ceil(traceRemainingMsRef.current / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          setTraceSecondsLeft(sec);
          if (sec <= 3 && sec > 0) sound.playUrgentTick();
        }

        if (traceRemainingMsRef.current <= 0) {
          streakRef.current = 0;
          setStreak(0);
          sound.playMiss();
          setStatusNote('Trace timer expired — revealing remaining nodes');
          advanceRound(1100);
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, cfg.traceMs, advanceRound]);

  const handleCellClick = useCallback(
    (cellIdx: number) => {
      if (isPaused || phase === 'ROUND_END') return;
      if (currentRoundData.blockers.has(cellIdx)) return;

      const expectedCell = currentRoundData.targetTapSequence[stepsFound];

      if (phase === 'STUDY') {
        if (cellIdx === expectedCell) {
          const now = performance.now();
          const reactionMs = Math.max(90, Math.round(now - lastStepTimeRef.current));
          lastStepTimeRef.current = now;

          totalTapsRef.current += 1;
          correctRef.current += 1;
          reactionTimesRef.current.push(reactionMs);

          const nextStreak = streakRef.current + 1;
          streakRef.current = nextStreak;
          setStreak(nextStreak);
          bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

          scoreRef.current += 150;
          setScore(scoreRef.current);
          setStepsFound(1);
          setTraceProgress(1);
          traceRemainingMsRef.current = cfg.traceMs;
          setTraceSecondsLeft(Math.ceil(cfg.traceMs / 1000));
          setPhase('TRACE');
          sound.playTileStep(0);
          const nextNum = cfg.reverse ? cfg.nodeCount - 1 : 2;
          setStatusNote(`Quick start · +150 pts · Find ${nextNum}`);
        }
        return;
      }

      // Already discovered cell in tap sequence is inert
      const alreadyFoundIdx = currentRoundData.targetTapSequence.indexOf(cellIdx);
      if (alreadyFoundIdx !== -1 && alreadyFoundIdx < stepsFound) return;

      totalTapsRef.current += 1;
      const now = performance.now();
      const reactionMs = Math.max(80, Math.round(now - lastStepTimeRef.current));
      lastStepTimeRef.current = now;

      if (cellIdx === expectedCell) {
        correctRef.current += 1;
        reactionTimesRef.current.push(reactionMs);
        setWrongCell(null);
        if (hintCell === cellIdx) setHintCell(null);

        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

        const speedBonus = reactionMs < 500 ? 50 : reactionMs < 850 ? 30 : 12;
        const reverseBonus = cfg.reverse ? 30 : 0;
        const pts = 90 + reverseBonus + speedBonus + Math.min(nextStreak * 10, 70);
        scoreRef.current += pts;
        setScore(scoreRef.current);

        const nextStepsFound = stepsFound + 1;
        setStepsFound(nextStepsFound);
        sound.playTileStep(nextStepsFound - 1);

        if (nextStepsFound === cfg.nodeCount) {
          completedRoundsRef.current += 1;
          const timeBonus = Math.round((traceRemainingMsRef.current / 1000) * 14);
          const cleanBonus = roundMistakes === 0 ? 150 : 45;
          scoreRef.current += cleanBonus + timeBonus;
          setScore(scoreRef.current);
          setStatusNote(
            roundMistakes === 0
              ? `Flawless trail · +${cleanBonus + timeBonus} bonus`
              : `Trail cleared · +${timeBonus} time bonus`
          );
          advanceRound(750);
        } else {
          const nextNum = cfg.reverse ? cfg.nodeCount - nextStepsFound : nextStepsFound + 1;
          setStatusNote(`Found ${expectedNumber} · ${reactionMs} ms · Next: ${nextNum}`);
        }
      } else {
        streakRef.current = 0;
        setStreak(0);
        setWrongCell(cellIdx);
        const nextMistakes = roundMistakes + 1;
        setRoundMistakes(nextMistakes);
        sound.playMiss();

        setTimeout(() => setWrongCell((prev) => (prev === cellIdx ? null : prev)), 350);

        if (nextMistakes >= 3) {
          setStatusNote('3 misses — revealing full trail');
          advanceRound(1100);
        } else {
          setStatusNote(`Need node ${expectedNumber} · ${3 - nextMistakes} tries left`);
        }
      }
    },
    [
      isPaused,
      phase,
      currentRoundData,
      stepsFound,
      cfg,
      hintCell,
      roundMistakes,
      expectedNumber,
      advanceRound,
    ]
  );

  const handleUseHint = useCallback(() => {
    if (isPaused || phase !== 'TRACE' || hintsLeft <= 0) return;
    const targetCell = currentRoundData.targetTapSequence[stepsFound];
    if (targetCell === undefined) return;
    setHintCell(targetCell);
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
    setStatusNote(`Node ${expectedNumber} highlighted`);
  }, [isPaused, phase, hintsLeft, currentRoundData, stepsFound, expectedNumber]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPaused) return;
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleUseHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPaused, handleUseHint]);

  const tileSizeClass =
    cfg.gridSize === 4
      ? 'w-16 h-16 sm:w-20 sm:h-20'
      : cfg.gridSize === 5
      ? 'w-[52px] h-[52px] sm:w-16 sm:h-16'
      : 'w-11 h-11 sm:w-14 sm:h-14';

  const revealedCellsSet = useMemo(() => {
    return new Set(currentRoundData.targetTapSequence.slice(0, stepsFound));
  }, [currentRoundData, stepsFound]);

  const trailPoints = useMemo(() => {
    if (stepsFound < 2) return '';
    return currentRoundData.targetTapSequence
      .slice(0, stepsFound)
      .map((cellIdx) => {
        const col = cellIdx % cfg.gridSize;
        const row = Math.floor(cellIdx / cfg.gridSize);
        const x = ((col + 0.5) / cfg.gridSize) * 100;
        const y = ((row + 0.5) / cfg.gridSize) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [currentRoundData, stepsFound, cfg.gridSize]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 select-none">
      {/* Header Progress & Reverse Twist Indicator */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          <span className={cfg.reverse ? 'text-amber-300 font-semibold' : ''}>
            {phase === 'STUDY'
              ? cfg.reverse
                ? `Reverse Round · Study ${cfg.nodeCount} down to 1`
                : 'Study Sequence Order'
              : phase === 'TRACE'
              ? cfg.reverse
                ? `Reverse Trail · Tap ${expectedNumber} (Countdown)`
                : `Tap Node ${expectedNumber} of ${cfg.nodeCount}`
              : 'Trail Complete'}
          </span>

          <div className="flex items-center gap-3 font-mono tabular-nums">
            {phase === 'TRACE' && (
              <span
                className={`inline-flex items-center gap-1 ${
                  traceSecondsLeft <= 3 ? 'text-rose-400 font-bold' : 'text-teal-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {traceSecondsLeft}s
              </span>
            )}
            <span className="text-slate-400">
              Round {roundIdx + 1}/{totalRounds} · {cfg.nodeCount} Nodes
            </span>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[transform] duration-75 origin-left ${
              phase === 'STUDY'
                ? 'bg-amber-400'
                : phase === 'TRACE'
                ? traceSecondsLeft <= 3
                  ? 'bg-rose-400'
                  : 'bg-teal-400'
                : 'bg-emerald-400'
            }`}
            style={{
              transform: `scaleX(${
                phase === 'STUDY'
                  ? studyProgress
                  : phase === 'TRACE'
                  ? traceProgress
                  : 1
              })`,
            }}
          />
        </div>
      </div>

      {/* Tactile Trail Board */}
      <div className="relative p-3 sm:p-5 rounded-2xl bg-[#131C2E] border border-white/10 shadow-2xl">
        <div className="relative">
          {trailPoints && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 w-full h-full z-0"
              aria-hidden="true"
            >
              <polyline
                points={trailPoints}
                fill="none"
                stroke={cfg.reverse ? '#FBBF24' : '#2DD4BF'}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.55"
              />
            </svg>
          )}

          <div
            className="relative z-10 grid gap-1.5 sm:gap-3"
            style={{
              gridTemplateColumns: `repeat(${cfg.gridSize}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: cfg.gridSize * cfg.gridSize }, (_, idx) => {
              const isBlocker = currentRoundData.blockers.has(idx);
              const number = currentRoundData.cellToNumber.get(idx);
              const isNode = number !== undefined;
              const isRevealed = isNode && revealedCellsSet.has(idx);
              const isStudyVisible = phase === 'STUDY' && isNode;
              const isEndReveal = phase === 'ROUND_END' && isNode && !isRevealed;
              const isWrong = wrongCell === idx;
              const isHinted = phase === 'TRACE' && hintCell === idx;
              const isStartNode = number === startNumber;

              if (isBlocker) {
                return (
                  <div
                    key={idx}
                    aria-label="Obsidian blocker"
                    className={`flex items-center justify-center rounded-xl bg-slate-950/90 border border-slate-800 text-slate-600 ${tileSizeClass}`}
                  >
                    <Lock className="w-4 h-4" aria-hidden="true" />
                  </div>
                );
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={
                    phase === 'ROUND_END' ||
                    isRevealed ||
                    (phase === 'STUDY' && !isStartNode)
                  }
                  onClick={() => handleCellClick(idx)}
                  aria-label={
                    isStudyVisible || isRevealed
                      ? `Sequence node ${number}`
                      : `Grid cell ${idx + 1}`
                  }
                  className={`relative flex items-center justify-center rounded-xl font-mono text-xl sm:text-2xl font-bold tabular-nums transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${tileSizeClass} ${
                    isRevealed
                      ? `bg-[#F8FAFC] text-slate-900 border-2 ${
                          cfg.reverse ? 'border-amber-400' : 'border-teal-400'
                        } border-b-4 shadow-lg animate-tile-pop`
                      : isStudyVisible
                      ? isStartNode
                        ? 'bg-[#F8FAFC] text-slate-900 border-2 border-amber-400 border-b-4 shadow-lg cursor-pointer hover:scale-[1.03]'
                        : 'bg-[#F8FAFC] text-slate-900 border-2 border-amber-400/70 border-b-4 shadow-md animate-tile-pop'
                      : isEndReveal
                      ? 'bg-amber-100 text-amber-950 border-2 border-amber-400 animate-tile-pop'
                      : isWrong
                      ? 'bg-rose-950/90 text-rose-300 border-2 border-rose-500 animate-tile-shake'
                      : isHinted
                      ? 'bg-slate-800 text-amber-300 border-2 border-amber-400 border-b-4 shadow-md cursor-pointer hover:bg-slate-700'
                      : phase === 'TRACE'
                      ? isNode
                        ? 'bg-slate-800/95 text-slate-300 border border-white/15 border-b-[3px] border-b-slate-950 hover:bg-slate-700 hover:border-white/30 active:scale-95 cursor-pointer'
                        : 'bg-slate-900/55 text-slate-600 border border-white/5 hover:bg-slate-800/70 cursor-pointer'
                      : 'bg-slate-900/40 border border-white/5'
                  }`}
                >
                  {(isStudyVisible || isRevealed || isEndReveal) && number}
                  {isWrong && <X className="w-6 h-6 text-rose-400 stroke-[2.5]" aria-hidden="true" />}
                  {isHinted && (
                    <span className="relative flex items-center justify-center">
                      <span className="absolute w-7 h-7 rounded-full border-2 border-amber-400 animate-beacon-ring" />
                      <span className="w-3 h-3 rounded-full bg-amber-400 block" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Status & Hint */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-300 truncate">{statusNote}</p>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={phase !== 'TRACE' || hintsLeft <= 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Hint ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
