import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Clock, Delete, Eye, RotateCcw, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng, randInt } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

interface DigitSpanStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

interface SpanRound {
  digits: number[];
  expected: number[];
  reverse: boolean;
  flashMs: number;
  inputMs: number;
}

function generateSpanRounds(seed: string, difficulty: Difficulty): SpanRound[] {
  const rng = createSeededRng(`${seed}:digitspan:${difficulty}`);
  const lengths =
    difficulty === 'relaxed'
      ? [4, 4, 5, 4, 5]
      : difficulty === 'master'
      ? [5, 6, 7, 6, 7]
      : [4, 5, 6, 5, 6];

  const flashMs = difficulty === 'relaxed' ? 760 : difficulty === 'master' ? 470 : 610;
  const baseInputMs = difficulty === 'relaxed' ? 16000 : difficulty === 'master' ? 10500 : 13000;

  return lengths.map((len, idx) => {
    const digits: number[] = [];
    for (let i = 0; i < len; i++) {
      let d = randInt(0, 9, rng);
      if (i > 0 && d === digits[i - 1]) {
        d = (d + randInt(1, 9, rng)) % 10;
      }
      digits.push(d);
    }
    const reverse = idx >= 3;
    const expected = reverse ? [...digits].reverse() : [...digits];
    return {
      digits,
      expected,
      reverse,
      flashMs,
      inputMs: baseInputMs + (reverse ? 1500 : 0),
    };
  });
}

type Phase = 'FLASH' | 'RULE_SHIFT' | 'INPUT' | 'ROUND_END';

export const DigitSpanStage: React.FC<DigitSpanStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const rounds = useMemo(() => generateSpanRounds(seed, difficulty), [seed, difficulty]);
  const totalRounds = rounds.length;

  const [roundIdx, setRoundIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('FLASH');
  const [flashSlot, setFlashSlot] = useState(0);
  const [flashBlank, setFlashBlank] = useState(false);

  const [entered, setEntered] = useState<number[]>([]);
  const [inputProgress, setInputProgress] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [roundOutcome, setRoundOutcome] = useState<{ correct: boolean; text: string } | null>(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(2);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const correctRoundsRef = useRef(0);
  const attemptedRoundsRef = useRef(0);
  const hintsUsedRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const inputStartRef = useRef<number>(performance.now());
  const pauseStartRef = useRef<number | null>(null);
  const isPausedRef = useRef(isPaused);
  const remainingInputMsRef = useRef(0);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const currentRound = rounds[roundIdx];

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current !== null) {
      inputStartRef.current += performance.now() - pauseStartRef.current;
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
      round: roundIdx + 1,
      totalRounds,
    });
  }, [score, streak, roundIdx, totalRounds, onHudUpdate]);

  const finishStage = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const accuracy =
      attemptedRoundsRef.current > 0
        ? Math.round((correctRoundsRef.current / attemptedRoundsRef.current) * 100)
        : 100;
    const times = reactionTimesRef.current;
    const avgMs =
      times.length > 0
        ? Math.round(times.reduce((sum, v) => sum + v, 0) / times.length)
        : 0;

    sound.playStageClear();
    onComplete({
      discipline: 'digitspan',
      label: 'Digit Span',
      score: scoreRef.current,
      accuracy,
      avgReactionMs: avgMs,
      bestStreak: bestStreakRef.current,
      hintsUsed: hintsUsedRef.current,
      roundsCompleted: correctRoundsRef.current,
      totalRounds,
    });
  }, [onComplete, totalRounds]);

  const goNextRound = useCallback(
    (delayMs: number) => {
      setPhase('ROUND_END');
      timerRef.current = window.setTimeout(() => {
        lockRef.current = false;
        if (roundIdx + 1 >= totalRounds) {
          finishStage();
        } else {
          const nextIdx = roundIdx + 1;
          setRoundIdx(nextIdx);
          setEntered([]);
          setRoundOutcome(null);
          setFlashSlot(0);
          setFlashBlank(false);
          if (nextIdx === 3) {
            sound.playRuleShift();
            setPhase('RULE_SHIFT');
          } else {
            setPhase('FLASH');
          }
        }
      }, delayMs);
    },
    [roundIdx, totalRounds, finishStage]
  );

  // Rule shift intro before Round 4 (Reverse Span)
  const beginFromShift = useCallback(() => {
    if (phase !== 'RULE_SHIFT') return;
    sound.playTick();
    setFlashSlot(0);
    setFlashBlank(false);
    setPhase('FLASH');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'RULE_SHIFT') return;
    let remaining = 2200;
    let lastTick = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remaining = Math.max(0, remaining - dt);
        if (remaining <= 0) {
          beginFromShift();
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, beginFromShift]);

  // Sequential digit flash timer (pause-safe)
  useEffect(() => {
    if (phase !== 'FLASH') return;
    const gapMs = 115;
    const stepTotal = currentRound.flashMs + gapMs;
    const totalFlashDuration = currentRound.digits.length * stepTotal;

    let elapsed = 0;
    let lastTick = performance.now();
    let lastSoundIdx = -1;
    let rafId = 0;

    setFlashSlot(0);
    setFlashBlank(false);
    sound.playFlashCue(0);
    lastSoundIdx = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current) {
        const dt = Math.min(now - lastTick, 50);
        elapsed += dt;

        if (elapsed >= totalFlashDuration) {
          remainingInputMsRef.current = currentRound.inputMs;
          setInputProgress(1);
          setSecondsLeft(Math.ceil(currentRound.inputMs / 1000));
          inputStartRef.current = performance.now();
          setPhase('INPUT');
          sound.playTick();
          return;
        }

        const slot = Math.min(currentRound.digits.length - 1, Math.floor(elapsed / stepTotal));
        const withinSlot = elapsed % stepTotal;
        setFlashSlot(slot);
        setFlashBlank(withinSlot >= currentRound.flashMs);

        if (slot !== lastSoundIdx) {
          lastSoundIdx = slot;
          sound.playFlashCue(slot);
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, currentRound]);

  const handleTimeout = useCallback(() => {
    if (lockRef.current || phase !== 'INPUT') return;
    lockRef.current = true;
    attemptedRoundsRef.current += 1;
    streakRef.current = 0;
    setStreak(0);
    sound.playMiss();
    setRoundOutcome({
      correct: false,
      text: `Time expired · Expected ${currentRound.expected.join('')}`,
    });
    goNextRound(1200);
  }, [phase, currentRound.expected, goNextRound]);

  // Input phase fuse timer (pause-safe)
  useEffect(() => {
    if (phase !== 'INPUT') return;
    let lastTick = performance.now();
    let lastSec = Math.ceil(remainingInputMsRef.current / 1000);
    let rafId = 0;

    const tick = (now: number) => {
      if (!isPausedRef.current && !lockRef.current) {
        const dt = Math.min(now - lastTick, 50);
        remainingInputMsRef.current = Math.max(0, remainingInputMsRef.current - dt);
        setInputProgress(remainingInputMsRef.current / currentRound.inputMs);

        const sec = Math.ceil(remainingInputMsRef.current / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          setSecondsLeft(sec);
          if (sec <= 3 && sec > 0) sound.playUrgentTick();
        }

        if (remainingInputMsRef.current <= 0) {
          handleTimeout();
          return;
        }
      }
      lastTick = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, roundIdx, currentRound.inputMs, handleTimeout]);

  const evaluateEntry = useCallback(
    (candidate: number[]) => {
      if (lockRef.current) return;
      lockRef.current = true;

      const now = performance.now();
      const reactionMs = Math.max(300, Math.round(now - inputStartRef.current));
      attemptedRoundsRef.current += 1;

      const isExact = candidate.every((d, i) => d === currentRound.expected[i]);

      if (isExact) {
        correctRoundsRef.current += 1;
        reactionTimesRef.current.push(reactionMs);
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);

        const lengthBonus = currentRound.digits.length * 40;
        const reverseBonus = currentRound.reverse ? 110 : 0;
        const timeBonus = Math.round((remainingInputMsRef.current / 1000) * 14);
        const pts = 140 + lengthBonus + reverseBonus + timeBonus + Math.min(nextStreak * 20, 80);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        sound.playSuccess(nextStreak);
        setRoundOutcome({
          correct: true,
          text: `Exact span · +${pts} pts · ${reactionMs} ms`,
        });
        goNextRound(850);
      } else {
        streakRef.current = 0;
        setStreak(0);
        sound.playMiss();
        setRoundOutcome({
          correct: false,
          text: `Expected ${currentRound.expected.join('')}`,
        });
        goNextRound(1250);
      }
    },
    [currentRound, goNextRound]
  );

  const handleDigitPress = useCallback(
    (digit: number) => {
      if (isPausedRef.current || phase !== 'INPUT' || lockRef.current) return;
      if (entered.length >= currentRound.expected.length) return;
      sound.playTileStep(entered.length);
      const next = [...entered, digit];
      setEntered(next);
      if (next.length === currentRound.expected.length) {
        evaluateEntry(next);
      }
    },
    [phase, entered, currentRound.expected.length, evaluateEntry]
  );

  const handleBackspace = useCallback(() => {
    if (isPausedRef.current || phase !== 'INPUT' || lockRef.current || entered.length === 0) return;
    sound.playTick();
    setEntered((prev) => prev.slice(0, -1));
  }, [phase, entered.length]);

  const handleClear = useCallback(() => {
    if (isPausedRef.current || phase !== 'INPUT' || lockRef.current || entered.length === 0) return;
    sound.playTick();
    setEntered([]);
  }, [phase, entered.length]);

  const handleUseHint = useCallback(() => {
    if (isPausedRef.current || phase !== 'INPUT' || lockRef.current || hintsLeft <= 0) return;
    const nextSlot = entered.length;
    if (nextSlot >= currentRound.expected.length) return;
    const nextDigit = currentRound.expected[nextSlot];
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    sound.playHint();
    const next = [...entered, nextDigit];
    setEntered(next);
    if (next.length === currentRound.expected.length) {
      evaluateEntry(next);
    }
  }, [phase, hintsLeft, entered, currentRound.expected, evaluateEntry]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPausedRef.current) return;
      if (phase === 'RULE_SHIFT' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        beginFromShift();
        return;
      }
      if (phase !== 'INPUT') return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(Number(e.key));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleUseHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, beginFromShift, handleDigitPress, handleBackspace, handleClear, handleUseHint]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 select-none">
      {/* Round Header & Reverse Mode Banner */}
      <div className="w-full max-w-md mb-3 sm:mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
          <span
            className={
              currentRound.reverse ? 'text-amber-300 font-semibold' : 'text-teal-300 font-semibold'
            }
          >
            {phase === 'RULE_SHIFT'
              ? 'Reverse Span Incoming'
              : currentRound.reverse
              ? `REVERSE Order · ${currentRound.digits.length} Digits`
              : `Forward Order · ${currentRound.digits.length} Digits`}
          </span>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            {phase === 'INPUT' && (
              <span
                className={`inline-flex items-center gap-1 ${
                  secondsLeft <= 3 ? 'text-rose-400 font-bold' : 'text-teal-300'
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

        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full origin-left ${
              phase === 'FLASH'
                ? 'bg-amber-400'
                : secondsLeft <= 3
                ? 'bg-rose-500'
                : currentRound.reverse
                ? 'bg-amber-400'
                : 'bg-teal-400'
            }`}
            style={{
              transform: `scaleX(${
                phase === 'FLASH'
                  ? (flashSlot + 1) / currentRound.digits.length
                  : phase === 'INPUT'
                  ? inputProgress
                  : 1
              })`,
            }}
          />
        </div>
      </div>

      {/* Center Display */}
      <div className="w-full max-w-md min-h-[156px] flex flex-col items-center justify-center">
        {phase === 'RULE_SHIFT' ? (
          <div className="w-full rounded-2xl bg-[#131C2E] border-2 border-amber-400/80 p-5 sm:p-6 text-center shadow-2xl animate-card-enter space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-300">
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ROUNDS 4–5 · REVERSE SPAN</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-white">Enter Digits in Reverse</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Watch the sequence flash, then type the digits <strong className="text-amber-300">backwards</strong>{' '}
              (e.g. 4–9–2 becomes 2–9–4).
            </p>
            <button
              type="button"
              onClick={beginFromShift}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Ready (Space)
            </button>
          </div>
        ) : phase === 'FLASH' ? (
          <div className="w-full rounded-2xl bg-[#131C2E] border-2 border-white/15 p-5 sm:p-6 flex flex-col items-center justify-center gap-4 shadow-2xl">
            <div className="text-xs font-mono text-slate-400">
              Digit {flashSlot + 1} of {currentRound.digits.length}
            </div>
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#F8FAFC] border-2 border-amber-400 border-b-4 shadow-xl flex items-center justify-center">
              <span className="font-mono text-5xl sm:text-6xl font-bold text-slate-950 tabular-nums">
                {flashBlank ? '' : currentRound.digits[flashSlot]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {currentRound.digits.map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === flashSlot
                      ? 'bg-amber-400'
                      : i < flashSlot
                      ? 'bg-teal-400/70'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {/* Answer Digit Slots */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              {currentRound.expected.map((_, slotIdx) => {
                const val = entered[slotIdx];
                const isFilled = val !== undefined;
                return (
                  <div
                    key={slotIdx}
                    className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl border-2 flex items-center justify-center font-mono text-xl sm:text-2xl font-bold tabular-nums transition-colors ${
                      roundOutcome
                        ? roundOutcome.correct
                          ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300'
                          : 'bg-rose-950/80 border-rose-500 text-rose-300'
                        : isFilled
                        ? 'bg-[#F8FAFC] border-teal-400 text-slate-950 animate-tile-pop'
                        : 'bg-slate-900/90 border-white/15 text-slate-600'
                    }`}
                  >
                    {isFilled ? val : '·'}
                  </div>
                );
              })}
            </div>

            {/* Outcome or Prompt Line */}
            <div className="h-6 flex items-center justify-center">
              {roundOutcome ? (
                <div
                  className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium ${
                    roundOutcome.correct ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {roundOutcome.correct ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <X className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span className="font-mono tabular-nums">{roundOutcome.text}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  {currentRound.reverse
                    ? 'Enter digits in REVERSE order'
                    : 'Enter digits in exact order'}
                </span>
              )}
            </div>

            {/* Tactile 3x4 Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={phase !== 'INPUT'}
                  onClick={() => handleDigitPress(num)}
                  className="h-12 sm:h-13 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-white border border-white/15 border-b-4 border-b-slate-950 font-mono text-lg font-bold transition-transform disabled:opacity-40 cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={phase !== 'INPUT' || entered.length === 0}
                onClick={handleBackspace}
                aria-label="Backspace"
                className="h-12 sm:h-13 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-300 border border-white/10 border-b-4 border-b-slate-950 flex items-center justify-center transition-transform disabled:opacity-35 cursor-pointer"
              >
                <Delete className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={phase !== 'INPUT'}
                onClick={() => handleDigitPress(0)}
                className="h-12 sm:h-13 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-white border border-white/15 border-b-4 border-b-slate-950 font-mono text-lg font-bold transition-transform disabled:opacity-40 cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                disabled={phase !== 'INPUT' || entered.length === 0}
                onClick={handleClear}
                aria-label="Clear digits"
                className="h-12 sm:h-13 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-300 border border-white/10 border-b-4 border-b-slate-950 flex items-center justify-center transition-transform disabled:opacity-35 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="w-full max-w-md mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">Keypad or 0–9 Keys</span>
        <button
          type="button"
          onClick={handleUseHint}
          disabled={phase !== 'INPUT' || hintsLeft <= 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Reveal Next ({hintsLeft})</span>
        </button>
      </div>
    </div>
  );
};
