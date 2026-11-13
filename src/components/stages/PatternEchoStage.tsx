import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Eye, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng, shuffleWithRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';

export interface LiveStageHud {
  score: number;
  streak: number;
  lastReactionMs: number | null;
  round: number;
  totalRounds: number;
}

interface PatternEchoStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

interface RoundConfig {
  gridSize: number;
  targetCount: number;
  decoyCount: number;
  studyMs: number;
  recallMs: number;
}

type Phase = 'MEMORIZE' | 'RECALL' | 'ROUND_END';

function getRoundConfigs(difficulty: Difficulty): RoundConfig[] {
  if (difficulty === 'relaxed') {
    return [
      { gridSize: 4, targetCount: 4, decoyCount: 0, studyMs: 2400, recallMs: 14000 },
      { gridSize: 4, targetCount: 5, decoyCount: 1, studyMs: 2400, recallMs: 14000 },
      { gridSize: 5, targetCount: 5, decoyCount: 2, studyMs: 2500, recallMs: 15000 },
      { gridSize: 5, targetCount: 6, decoyCount: 2, studyMs: 2600, recallMs: 15000 },
    ];
  }
  if (difficulty === 'master') {
    return [
      { gridSize: 4, targetCount: 5, decoyCount: 2, studyMs: 1550, recallMs: 8500 },
      { gridSize: 5, targetCount: 6, decoyCount: 3, studyMs: 1650, recallMs: 9000 },
      { gridSize: 5, targetCount: 7, decoyCount: 3, studyMs: 1750, recallMs: 9500 },
      { gridSize: 6, targetCount: 9, decoyCount: 4, studyMs: 1900, recallMs: 11000 },
    ];
  }
  return [
    { gridSize: 4, targetCount: 4, decoyCount: 0, studyMs: 1900, recallMs: 10500 },
    { gridSize: 4, targetCount: 5, decoyCount: 2, studyMs: 2000, recallMs: 11000 },
    { gridSize: 5, targetCount: 6, decoyCount: 3, studyMs: 2150, recallMs: 11500 },
    { gridSize: 6, targetCount: 8, decoyCount: 3, studyMs: 2300, recallMs: 12500 },
  ];
}

export const PatternEchoStage: React.FC<PatternEchoStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const configs = useMemo(() => getRoundConfigs(difficulty), [difficulty]);
  const totalRounds = configs.length;

  const roundData = useMemo(() => {
    const rng = createSeededRng(`${seed}:pattern_v2:${difficulty}`);
    return configs.map((cfg) => {
      const indices = Array.from({ length: cfg.gridSize * cfg.gridSize }, (_, i) => i);
      const shuffled = shuffleWithRng(indices, rng);
      const targetsOrdered = shuffled.slice(0, cfg.targetCount);
      const decoys = shuffled.slice(cfg.targetCount, cfg.targetCount + cfg.decoyCount);
      return {
        targetsOrdered,
        targets: new Set(targetsOrdered),
        decoys: new Set(decoys),
      };
    });
  }, [seed, difficulty, configs]);

  const [roundIdx, setRoundIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('MEMORIZE');
  const [studyProgress, setStudyProgress] = useState(1);
  const [recallProgress, setRecallProgress] = useState(1);
  const [recallSecondsLeft, setRecallSecondsLeft] = useState(0);
  const [waveRevealedCount, setWaveRevealedCount] = useState(0);

  const [foundTiles, setFoundTiles] = useState<Set<number>>(new Set());
  const [wrongTiles, setWrongTiles] = useState<Set<number>>(new Set());
  const [hintTile, setHintTile] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [roundMistakes, setRoundMistakes] = useState(0);
  const [statusNote, setStatusNote] = useState<string>('Watch the gold tiles illuminate');

  const correctTapsRef = useRef(0);
  const totalTapsRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const lastEventTimeRef = useRef<number>(performance.now());
  const pauseStartedRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const completedRoundsRef = useRef(0);
  const finishedRef = useRef(false);
  const recallRemainingMsRef = useRef(0);

  const currentCfg = configs[roundIdx];
  const currentData = roundData[roundIdx];

  useEffect(() => {
    if (isPaused) {
      pauseStartedRef.current = performance.now();
    } else if (pauseStartedRef.current !== null) {
      const pausedDelta = performance.now() - pauseStartedRef.current;
      lastEventTimeRef.current += pausedDelta;
      pauseStartedRef.current = null;
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
    const totalTaps = totalTapsRef.current;
    const accuracy =
      totalTaps > 0 ? Math.round((correctTapsRef.current / totalTaps) * 100) : 100;
    const times = reactionTimesRef.current;
    const avgMs =
      times.length > 0
        ? Math.round(times.reduce((sum, v) => sum + v, 0) / times.length)
        : 0;

    sound.playStageClear();
    onComplete({
      discipline: 'pattern',
      label: 'Pattern Echo',
      score: scoreRef.current,
      accuracy,
      avgReactionMs: avgMs,
      bestStreak: bestStreakRef.current,
      hintsUsed: hintsUsedRef.current,
      roundsCompleted: completedRoundsRef.current,
      totalRounds,
    });
  }, [onComplete, totalRounds]);

  const advanceToNextRound = useCallback(
    (delayMs: number) => {
      setPhase('ROUND_END');
      setTimeout(() => {
        if (roundIdx + 1 >= totalRounds) {
          finishStage();
        } else {
          setRoundIdx((r) => r + 1);
          setFoundTiles(new Set());
          setWrongTiles(new Set());
          setHintTile(null);
          setRoundMistakes(0);
          setFocusedIndex(0);
          setWaveRevealedCount(0);
          setPhase('MEMORIZE');
        }
      }, delayMs);
    },
    [roundIdx, totalRounds, finishStage]
  );

  // Sequential wave illumination + Memorize timer
  useEffect(() => {
    if (phase !== 'MEMORIZE') return;
    setStudyProgress(1);
    setWaveRevealedCount(0);
    setStatusNote(
      currentCfg.decoyCount > 0
        ? `Memorize ${currentCfg.targetCount} Gold tiles · Ignore ${currentCfg.decoyCount} Rose decoys`
        : `Memorize ${currentCfg.targetCount} Gold tiles`
    );

    let elapsed = 0;
    let lastTick = performance.now();
    let rafId = 0;
    let lastWaveStep = 0;
    const waveWindow = Math.min(currentCfg.studyMs * 0.45, currentCfg.targetCount * 110);

    const tick = (now: number) => {
      if (!isPaused) {
        const dt = Math.min(now - lastTick, 50);
        elapsed += dt;
        const remaining = Math.max(0, currentCfg.studyMs - elapsed);
        setStudyProgress(remaining / currentCfg.studyMs);

        const targetShown = Math.min(
          currentCfg.targetCount,
          Math.max(1, Math.ceil((elapsed / Math.max(1, waveWindow)) * currentCfg.targetCount))
        );
        if (targetShown > lastWaveStep) {
          lastWaveStep = targetShown;
          setWaveRevealedCount(targetShown);
          sound.playFlashCue(targetShown - 1);
        }

        if (remaining <= 0) {
          setPhase('RECALL');
          setRecallProgress(1);
          recallRemainingMsRef.current = currentCfg.recallMs;
          setRecallSecondsLeft(Math.ceil(currentCfg.recallMs / 1000));
          setStatusNote('Tap only the Gold tile positions');
          lastEventTimeRef.current = performance.now();
          sound.playTick();
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, currentCfg, isPaused]);

  // Live Recall Countdown Fuse
  useEffect(() => {
    if (phase !== 'RECALL') return;

    let remaining = currentCfg.recallMs;
    recallRemainingMsRef.current = remaining;
    let lastTick = performance.now();
    let lastSec = Math.ceil(remaining / 1000);
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPaused) {
        const dt = Math.min(now - lastTick, 50);
        remaining = Math.max(0, remaining - dt);
        recallRemainingMsRef.current = remaining;
        setRecallProgress(remaining / currentCfg.recallMs);

        const sec = Math.ceil(remaining / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          setRecallSecondsLeft(sec);
          if (sec <= 3 && sec > 0) {
            sound.playUrgentTick();
          }
        }

        if (remaining <= 0) {
          streakRef.current = 0;
          setStreak(0);
          sound.playMiss();
          setStatusNote('Time expired — reviewing missed pattern');
          advanceToNextRound(1100);
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, currentCfg.recallMs, isPaused, advanceToNextRound]);

  const handleTileSelect = useCallback(
    (idx: number) => {
      if (isPaused || phase !== 'RECALL') return;
      if (foundTiles.has(idx) || wrongTiles.has(idx)) return;

      const now = performance.now();
      const reactionMs = Math.max(80, Math.round(now - lastEventTimeRef.current));
      lastEventTimeRef.current = now;
      totalTapsRef.current += 1;

      if (currentData.targets.has(idx)) {
        correctTapsRef.current += 1;
        reactionTimesRef.current.push(reactionMs);

        const nextFound = new Set(foundTiles);
        nextFound.add(idx);
        setFoundTiles(nextFound);
        if (hintTile === idx) setHintTile(null);

        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        if (nextStreak > bestStreakRef.current) {
          bestStreakRef.current = nextStreak;
        }

        const speedBonus = reactionMs < 420 ? 50 : reactionMs < 750 ? 30 : 12;
        const pointsEarned = 90 + speedBonus + Math.min(nextStreak * 12, 72);
        scoreRef.current += pointsEarned;
        setScore(scoreRef.current);

        sound.playTileStep(nextFound.size - 1);
        setStatusNote(`Matched ${nextFound.size}/${currentData.targets.size} · ${reactionMs} ms`);

        if (nextFound.size === currentData.targets.size) {
          completedRoundsRef.current += 1;
          const timeBonus = Math.round((recallRemainingMsRef.current / 1000) * 18);
          const cleanRoundBonus = roundMistakes === 0 ? 140 : 40;
          scoreRef.current += cleanRoundBonus + timeBonus;
          setScore(scoreRef.current);
          setStatusNote(
            roundMistakes === 0
              ? `Flawless echo · +${cleanRoundBonus + timeBonus} speed & accuracy bonus`
              : `Cleared · +${timeBonus} time bonus`
          );
          advanceToNextRound(700);
        }
      } else {
        const hitDecoy = currentData.decoys.has(idx);
        const nextWrong = new Set(wrongTiles);
        nextWrong.add(idx);
        setWrongTiles(nextWrong);
        streakRef.current = 0;
        setStreak(0);
        const nextMistakes = roundMistakes + (hitDecoy ? 2 : 1);
        setRoundMistakes(nextMistakes);
        sound.playMiss();

        if (nextMistakes >= 3) {
          setStatusNote(
            hitDecoy
              ? 'Decoy hazard triggered — reviewing pattern'
              : '3 misses — reviewing full pattern'
          );
          advanceToNextRound(1100);
        } else {
          setStatusNote(
            hitDecoy
              ? `Rose decoy hazard! ${3 - nextMistakes} chance left`
              : `Off target · ${3 - nextMistakes} tries left`
          );
        }
      }
    },
    [
      isPaused,
      phase,
      foundTiles,
      wrongTiles,
      currentData,
      hintTile,
      roundMistakes,
      advanceToNextRound,
    ]
  );

  const handleUseHint = useCallback(() => {
    if (isPaused || phase !== 'RECALL' || hintsLeft <= 0) return;
    const unfound = currentData.targetsOrdered.filter((idx) => !foundTiles.has(idx));
    if (unfound.length === 0) return;

    setHintTile(unfound[0]);
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
    setStatusNote('Beacon active on one unfound gold tile');
  }, [isPaused, phase, hintsLeft, currentData, foundTiles]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPaused || phase !== 'RECALL') return;
      const g = currentCfg.gridSize;
      const total = g * g;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % total);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + total) % total);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + g) % total);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - g + total) % total);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleTileSelect(focusedIndex);
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleUseHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPaused, phase, currentCfg.gridSize, focusedIndex, handleTileSelect, handleUseHint]);

  const tileSizeClass =
    currentCfg.gridSize === 4
      ? 'w-16 h-16 sm:w-20 sm:h-20'
      : currentCfg.gridSize === 5
      ? 'w-14 h-14 sm:w-16 sm:h-16'
      : 'w-12 h-12 sm:w-14 sm:h-14';

  const waveShownSet = useMemo(() => {
    return new Set(currentData.targetsOrdered.slice(0, waveRevealedCount));
  }, [currentData, waveRevealedCount]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 select-none">
      {/* Phase, Goal & Fuse Header */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          <span>
            {phase === 'MEMORIZE'
              ? `Memorize ${currentCfg.targetCount} Gold Tiles`
              : phase === 'RECALL'
              ? `Recall ${foundTiles.size} / ${currentData.targets.size}`
              : 'Round Complete'}
          </span>

          <div className="flex items-center gap-3 font-mono tabular-nums">
            {phase === 'RECALL' && (
              <span
                className={`inline-flex items-center gap-1 ${
                  recallSecondsLeft <= 3 ? 'text-rose-400 font-bold' : 'text-teal-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {recallSecondsLeft}s
              </span>
            )}
            <span className="text-slate-400">
              Round {roundIdx + 1}/{totalRounds} · {currentCfg.gridSize}×{currentCfg.gridSize}
            </span>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[transform] duration-75 origin-left ${
              phase === 'MEMORIZE'
                ? 'bg-amber-400'
                : phase === 'RECALL'
                ? recallSecondsLeft <= 3
                  ? 'bg-rose-400'
                  : 'bg-teal-400'
                : 'bg-emerald-400'
            }`}
            style={{
              transform: `scaleX(${
                phase === 'MEMORIZE'
                  ? studyProgress
                  : phase === 'RECALL'
                  ? recallProgress
                  : 1
              })`,
            }}
          />
        </div>
      </div>

      {/* Tactile Keycap Board */}
      <div
        className="p-4 sm:p-5 rounded-2xl bg-[#131C2E] border border-white/10 shadow-2xl"
        role="grid"
        aria-label="Pattern Echo memory grid"
      >
        <div
          className="grid gap-2.5 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${currentCfg.gridSize}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: currentCfg.gridSize * currentCfg.gridSize }, (_, idx) => {
            const isTarget = currentData.targets.has(idx);
            const isDecoy = currentData.decoys.has(idx);
            const isFound = foundTiles.has(idx);
            const isWrong = wrongTiles.has(idx);
            const isRevealedEnd = phase === 'ROUND_END' && isTarget && !isFound;
            const isStudyTargetLit = phase === 'MEMORIZE' && isTarget && waveShownSet.has(idx);
            const isStudyDecoyLit = phase === 'MEMORIZE' && isDecoy && waveRevealedCount >= 1;
            const isHinted = phase === 'RECALL' && hintTile === idx && !isFound;
            const isFocused = phase === 'RECALL' && focusedIndex === idx;

            return (
              <button
                key={idx}
                type="button"
                disabled={phase !== 'RECALL' || isFound || isWrong}
                onClick={() => {
                  setFocusedIndex(idx);
                  handleTileSelect(idx);
                }}
                aria-label={`Tile ${idx + 1}`}
                className={`relative flex items-center justify-center rounded-xl transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${tileSizeClass} ${
                  isFound
                    ? 'bg-[#F8FAFC] text-slate-900 border-2 border-teal-400 border-b-4 shadow-lg animate-tile-pop'
                    : isStudyTargetLit || isRevealedEnd
                    ? isRevealedEnd
                      ? 'bg-amber-100/90 text-amber-900 border-2 border-amber-400 border-b-4 animate-tile-pop'
                      : 'bg-[#F8FAFC] text-slate-900 border-2 border-amber-400 border-b-4 shadow-md animate-tile-pop'
                    : isStudyDecoyLit
                    ? 'bg-rose-950/90 text-rose-300 border-2 border-rose-500/80 border-b-4 animate-tile-pop'
                    : isWrong
                    ? 'bg-rose-950/90 text-rose-300 border-2 border-rose-500 animate-tile-shake'
                    : isHinted
                    ? 'bg-slate-800/95 text-amber-300 border-2 border-amber-400 border-b-4 shadow-md cursor-pointer hover:bg-slate-700'
                    : 'bg-slate-800/90 text-slate-400 border border-white/10 border-b-[3px] border-b-slate-950 hover:bg-slate-700/90 hover:border-white/25 active:scale-95 cursor-pointer'
                } ${isFocused ? 'ring-2 ring-teal-400/70 ring-offset-2 ring-offset-[#131C2E]' : ''}`}
              >
                {isFound && <Check className="w-6 h-6 text-teal-600 stroke-[2.75]" aria-hidden="true" />}
                {!isFound && (isStudyTargetLit || isRevealedEnd) && (
                  <span
                    className="w-4 h-4 rotate-45 rounded-[3px] bg-amber-500 block"
                    aria-hidden="true"
                  />
                )}
                {(isStudyDecoyLit || isWrong) && (
                  <X className="w-6 h-6 text-rose-400 stroke-[2.5]" aria-hidden="true" />
                )}
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

      {/* Footer Status & Hint */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-300 truncate">{statusNote}</p>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={phase !== 'RECALL' || hintsLeft <= 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Hint ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
