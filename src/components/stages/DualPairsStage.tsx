import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Clock,
  Compass,
  Crown,
  Eye,
  Flame,
  Hourglass,
  Leaf,
  Moon,
  Sun,
} from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng, shuffleWithRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

interface DualPairsStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

interface PairRoundConfig {
  cols: number;
  rows: number;
  studyMs: number;
  matchMs: number;
}

const SYMBOL_POOL = [
  { id: 'sun', label: 'Sun', Icon: Sun },
  { id: 'moon', label: 'Moon', Icon: Moon },
  { id: 'compass', label: 'Compass', Icon: Compass },
  { id: 'crown', label: 'Crown', Icon: Crown },
  { id: 'anchor', label: 'Anchor', Icon: Anchor },
  { id: 'leaf', label: 'Leaf', Icon: Leaf },
  { id: 'hourglass', label: 'Hourglass', Icon: Hourglass },
  { id: 'flame', label: 'Flame', Icon: Flame },
] as const;

function getRoundConfigs(difficulty: Difficulty): PairRoundConfig[] {
  if (difficulty === 'relaxed') {
    return [
      { cols: 4, rows: 3, studyMs: 3200, matchMs: 32000 },
      { cols: 4, rows: 4, studyMs: 3600, matchMs: 38000 },
      { cols: 4, rows: 4, studyMs: 3200, matchMs: 35000 },
    ];
  }
  if (difficulty === 'master') {
    return [
      { cols: 4, rows: 3, studyMs: 2000, matchMs: 20000 },
      { cols: 4, rows: 4, studyMs: 2300, matchMs: 24000 },
      { cols: 4, rows: 4, studyMs: 1900, matchMs: 21000 },
    ];
  }
  return [
    { cols: 4, rows: 3, studyMs: 2600, matchMs: 25000 },
    { cols: 4, rows: 4, studyMs: 3000, matchMs: 30000 },
    { cols: 4, rows: 4, studyMs: 2500, matchMs: 27000 },
  ];
}

type Phase = 'STUDY' | 'MATCH' | 'ROUND_END';

export const DualPairsStage: React.FC<DualPairsStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const configs = useMemo(() => getRoundConfigs(difficulty), [difficulty]);
  const totalRounds = configs.length;

  const decks = useMemo(() => {
    const rng = createSeededRng(`${seed}:pairs:${difficulty}`);
    return configs.map((cfg) => {
      const pairCount = (cfg.cols * cfg.rows) / 2;
      const chosenSymbols = shuffleWithRng(SYMBOL_POOL, rng).slice(0, pairCount);
      const paired = [...chosenSymbols, ...chosenSymbols];
      return shuffleWithRng(paired, rng);
    });
  }, [seed, difficulty, configs]);

  const [roundIdx, setRoundIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('STUDY');
  const [studyProgress, setStudyProgress] = useState(1);
  const [matchProgress, setMatchProgress] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [mismatchPair, setMismatchPair] = useState<number[]>([]);
  const [hintPair, setHintPair] = useState<Set<number>>(new Set());

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [statusNote, setStatusNote] = useState('Snapshot the symbol positions');

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const attemptsRef = useRef(0);
  const correctPairsRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const completedRoundsRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const lastPairTimeRef = useRef<number>(performance.now());
  const pauseStartRef = useRef<number | null>(null);
  const remainingMatchMsRef = useRef(0);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const isPausedRef = useRef(isPaused);

  const cfg = configs[roundIdx];
  const deck = decks[roundIdx];
  const pairCount = deck.length / 2;

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current !== null) {
      lastPairTimeRef.current += performance.now() - pauseStartRef.current;
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

    const accuracy =
      attemptsRef.current > 0
        ? Math.round((correctPairsRef.current / attemptsRef.current) * 100)
        : 100;
    const times = reactionTimesRef.current;
    const avgMs =
      times.length > 0
        ? Math.round(times.reduce((sum, v) => sum + v, 0) / times.length)
        : 0;

    sound.playStageClear();
    onComplete({
      discipline: 'pairs',
      label: 'Dual Pairs',
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
          setFlipped([]);
          setMatched(new Set());
          setMismatchPair([]);
          setHintPair(new Set());
          lockRef.current = false;
          setPhase('STUDY');
        }
      }, delayMs);
    },
    [roundIdx, totalRounds, finishStage]
  );

  // Study timer (pause-safe)
  useEffect(() => {
    if (phase !== 'STUDY') return;
    setStudyProgress(1);
    setStatusNote('Snapshot all symbol pairs before they conceal');

    let remaining = cfg.studyMs;
    let lastTick = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remaining = Math.max(0, remaining - dt);
        setStudyProgress(remaining / cfg.studyMs);
        if (remaining <= 0) {
          setPhase('MATCH');
          setMatchProgress(1);
          remainingMatchMsRef.current = cfg.matchMs;
          setSecondsLeft(Math.ceil(cfg.matchMs / 1000));
          lastPairTimeRef.current = performance.now();
          setStatusNote(`Find ${pairCount} matching pairs`);
          sound.playTick();
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, cfg, pairCount]);

  // Match countdown timer (pause-safe)
  useEffect(() => {
    if (phase !== 'MATCH') return;
    remainingMatchMsRef.current = cfg.matchMs;
    let lastTick = performance.now();
    let lastSec = Math.ceil(remainingMatchMsRef.current / 1000);
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remainingMatchMsRef.current = Math.max(0, remainingMatchMsRef.current - dt);
        setMatchProgress(remainingMatchMsRef.current / cfg.matchMs);

        const sec = Math.ceil(remainingMatchMsRef.current / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          setSecondsLeft(sec);
          if (sec <= 3 && sec > 0) sound.playUrgentTick();
        }

        if (remainingMatchMsRef.current <= 0) {
          streakRef.current = 0;
          setStreak(0);
          sound.playMiss();
          setStatusNote('Time expired — advancing round');
          advanceRound(950);
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, cfg.matchMs, advanceRound]);

  const handleCardClick = useCallback(
    (idx: number) => {
      if (isPaused || phase !== 'MATCH' || lockRef.current) return;
      if (matched.has(idx) || flipped.includes(idx)) return;

      sound.playTick();
      const nextFlipped = [...flipped, idx];
      setFlipped(nextFlipped);

      if (nextFlipped.length < 2) return;

      lockRef.current = true;
      attemptsRef.current += 1;
      const [a, b] = nextFlipped;
      const now = performance.now();
      const pairMs = Math.max(150, Math.round(now - lastPairTimeRef.current));
      lastPairTimeRef.current = now;

      if (deck[a].id === deck[b].id) {
        correctPairsRef.current += 1;
        reactionTimesRef.current.push(pairMs);

        const nextMatched = new Set(matched);
        nextMatched.add(a);
        nextMatched.add(b);
        setMatched(nextMatched);
        setFlipped([]);
        setHintPair(new Set());
        lockRef.current = false;

        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

        const speedBonus = pairMs < 1100 ? 45 : pairMs < 1800 ? 25 : 10;
        const pts = 100 + speedBonus + Math.min(nextStreak * 15, 75);
        scoreRef.current += pts;
        setScore(scoreRef.current);

        sound.playTileStep(nextMatched.size / 2 - 1);
        setStatusNote(
          `Matched ${deck[a].label} · ${nextMatched.size / 2}/${pairCount} pairs`
        );

        if (nextMatched.size === deck.length) {
          completedRoundsRef.current += 1;
          const timeBonus = Math.round((remainingMatchMsRef.current / 1000) * 14);
          scoreRef.current += timeBonus;
          setScore(scoreRef.current);
          setStatusNote(`Board cleared · +${timeBonus} time bonus`);
          advanceRound(700);
        }
      } else {
        streakRef.current = 0;
        setStreak(0);
        setMismatchPair([a, b]);
        sound.playMiss();
        setStatusNote('Mismatch — keep scanning');

        setTimeout(() => {
          setFlipped([]);
          setMismatchPair([]);
          lockRef.current = false;
        }, 420);
      }
    },
    [isPaused, phase, matched, flipped, deck, pairCount, advanceRound]
  );

  const handleUseHint = useCallback(() => {
    if (isPaused || phase !== 'MATCH' || hintsLeft <= 0 || hintPair.size > 0) return;
    const unfoundIndices: number[] = [];
    for (let i = 0; i < deck.length; i++) {
      if (!matched.has(i)) unfoundIndices.push(i);
    }
    if (unfoundIndices.length < 2) return;
    const first = unfoundIndices[0];
    const partner = unfoundIndices.find((i) => i !== first && deck[i].id === deck[first].id);
    if (partner === undefined) return;

    setHintPair(new Set([first, partner]));
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
    setStatusNote(`Matching pair highlighted`);
  }, [isPaused, phase, hintsLeft, hintPair.size, deck, matched]);

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

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 select-none">
      {/* Header Progress */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          <span>
            {phase === 'STUDY'
              ? 'Snapshot Card Positions'
              : phase === 'MATCH'
              ? `Pairs Cleared: ${matched.size / 2} / ${pairCount}`
              : 'Round Complete'}
          </span>

          <div className="flex items-center gap-3 font-mono tabular-nums">
            {phase === 'MATCH' && (
              <span
                className={`inline-flex items-center gap-1 ${
                  secondsLeft <= 4 ? 'text-rose-400 font-bold' : 'text-teal-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {secondsLeft}s
              </span>
            )}
            <span className="text-slate-400">
              Round {roundIdx + 1}/{totalRounds}
            </span>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[transform] duration-75 origin-left ${
              phase === 'STUDY'
                ? 'bg-amber-400'
                : phase === 'MATCH'
                ? secondsLeft <= 4
                  ? 'bg-rose-400'
                  : 'bg-teal-400'
                : 'bg-emerald-400'
            }`}
            style={{
              transform: `scaleX(${
                phase === 'STUDY'
                  ? studyProgress
                  : phase === 'MATCH'
                  ? matchProgress
                  : 1
              })`,
            }}
          />
        </div>
      </div>

      {/* Card Grid */}
      <div className="p-3 sm:p-5 rounded-2xl bg-[#131C2E] border border-white/10 shadow-2xl">
        <div
          className="grid gap-2 sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
        >
          {deck.map((card, idx) => {
            const isMatched = matched.has(idx);
            const isFlipped = flipped.includes(idx);
            const isMismatch = mismatchPair.includes(idx);
            const isHinted = hintPair.has(idx) && !isMatched;
            const isFaceUp =
              phase === 'STUDY' || phase === 'ROUND_END' || isMatched || isFlipped;
            const Icon = card.Icon;

            return (
              <button
                key={`${roundIdx}-${idx}`}
                type="button"
                disabled={phase !== 'MATCH' || isMatched || isFlipped}
                onClick={() => handleCardClick(idx)}
                aria-label={isFaceUp ? card.label : `Face-down card ${idx + 1}`}
                className={`relative w-[68px] h-[78px] sm:w-20 sm:h-24 rounded-xl flex flex-col items-center justify-center gap-1 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  isMatched
                    ? 'bg-[#F8FAFC] text-slate-900 border-2 border-teal-400 border-b-4 shadow-lg animate-tile-pop'
                    : isMismatch
                    ? 'bg-rose-950/90 text-rose-300 border-2 border-rose-500 animate-tile-shake'
                    : isFaceUp
                    ? 'bg-[#F8FAFC] text-slate-900 border-2 border-amber-400 border-b-4 shadow-md animate-tile-pop'
                    : isHinted
                    ? 'bg-slate-800 text-amber-300 border-2 border-amber-400 border-b-4 cursor-pointer hover:bg-slate-700'
                    : 'bg-slate-800/90 text-slate-400 border border-white/10 border-b-[3px] border-b-slate-950 hover:bg-slate-700 hover:border-white/25 active:scale-95 cursor-pointer'
                }`}
              >
                {isFaceUp ? (
                  <>
                    <Icon
                      className={`w-7 h-7 ${isMatched ? 'text-teal-600' : 'text-slate-900'}`}
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-semibold tracking-tight">
                      {card.label}
                    </span>
                  </>
                ) : isHinted ? (
                  <span className="relative flex items-center justify-center">
                    <span className="absolute w-7 h-7 rounded-full border-2 border-amber-400 animate-beacon-ring" />
                    <span className="w-3 h-3 rounded-full bg-amber-400 block" />
                  </span>
                ) : (
                  <span className="w-4 h-4 rotate-45 rounded-[3px] border border-slate-600 block" />
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
          disabled={phase !== 'MATCH' || hintsLeft <= 0 || hintPair.size > 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Hint ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
