import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, Eye, X } from 'lucide-react';
import { Difficulty, StageResult } from '../../types/game';
import { createSeededRng } from '../../utils/seededRandom';
import { sound } from '../../utils/sound';
import { LiveStageHud } from './PatternEchoStage';

type ShapeType = 'circle' | 'triangle' | 'square' | 'diamond';
type FinishType = 'teal' | 'brass' | 'ivory';
type MatchRule = 'shape1' | 'finish1' | 'shape2';

interface TempoCard {
  id: number;
  shape: ShapeType;
  finish: FinishType;
  rule: MatchRule;
  isMatch: boolean;
}

interface TempoMatchStageProps {
  seed: string;
  difficulty: Difficulty;
  isPaused: boolean;
  onHudUpdate: (hud: LiveStageHud) => void;
  onComplete: (result: StageResult) => void;
}

const SHAPES: ShapeType[] = ['circle', 'triangle', 'square', 'diamond'];
const FINISHES: FinishType[] = ['teal', 'brass', 'ivory'];

const FINISH_STYLES: Record<
  FinishType,
  { label: string; bg: string; border: string; stroke: string; fill: string }
> = {
  teal: {
    label: 'Teal',
    bg: 'bg-teal-950/75',
    border: 'border-teal-400/80',
    stroke: '#2DD4BF',
    fill: 'rgba(45, 212, 191, 0.22)',
  },
  brass: {
    label: 'Brass',
    bg: 'bg-amber-950/65',
    border: 'border-amber-400/80',
    stroke: '#FBBF24',
    fill: 'rgba(251, 191, 36, 0.22)',
  },
  ivory: {
    label: 'Ivory',
    bg: 'bg-slate-100',
    border: 'border-white',
    stroke: '#0F172A',
    fill: 'rgba(15, 23, 42, 0.14)',
  },
};

function getCardFuseMs(difficulty: Difficulty, rule: MatchRule): number {
  const base = difficulty === 'relaxed' ? 3200 : difficulty === 'master' ? 1650 : 2250;
  return rule === 'shape2' ? base + 350 : base;
}

function generateDeck(seed: string, difficulty: Difficulty): {
  deck: TempoCard[];
  phase2Start: number;
  phase3Start: number;
} {
  const rng = createSeededRng(`${seed}:tempo_v2:${difficulty}`);
  const totalPlayable = difficulty === 'relaxed' ? 15 : difficulty === 'master' ? 21 : 20;
  const phase2Start = Math.round(totalPlayable * 0.35) + 1;
  const phase3Start = Math.round(totalPlayable * 0.7) + 1;

  const deck: TempoCard[] = [];
  const firstShape = SHAPES[Math.floor(rng() * SHAPES.length)];
  const firstFinish = FINISHES[Math.floor(rng() * FINISHES.length)];

  deck.push({
    id: 0,
    shape: firstShape,
    finish: firstFinish,
    rule: 'shape1',
    isMatch: false,
  });

  for (let i = 1; i <= totalPlayable; i++) {
    const rule: MatchRule =
      i >= phase3Start ? 'shape2' : i >= phase2Start ? 'finish1' : 'shape1';
    const wantMatch = rng() < 0.5;
    const prev1 = deck[i - 1];
    const refCard = rule === 'shape2' && i >= 2 ? deck[i - 2] : prev1;

    let shape: ShapeType;
    let finish: FinishType;

    if (rule === 'finish1') {
      if (wantMatch) {
        finish = refCard.finish;
      } else {
        const others = FINISHES.filter((f) => f !== refCard.finish);
        finish = others[Math.floor(rng() * others.length)];
      }
      shape = SHAPES[Math.floor(rng() * SHAPES.length)];
    } else {
      if (wantMatch) {
        shape = refCard.shape;
      } else {
        const others = SHAPES.filter((s) => s !== refCard.shape);
        shape = others[Math.floor(rng() * others.length)];
      }
      finish = FINISHES[Math.floor(rng() * FINISHES.length)];
    }

    deck.push({
      id: i,
      shape,
      finish,
      rule,
      isMatch: wantMatch,
    });
  }

  return { deck, phase2Start, phase3Start };
}

const CardGlyph: React.FC<{ shape: ShapeType; finish: FinishType; compact?: boolean }> = ({
  shape,
  finish,
  compact = false,
}) => {
  const style = FINISH_STYLES[finish];
  const size = compact ? 34 : 84;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      {shape === 'circle' && (
        <>
          <circle cx="50" cy="50" r="36" fill={style.fill} stroke={style.stroke} strokeWidth="6" />
          {finish === 'brass' && (
            <circle cx="50" cy="50" r="14" stroke={style.stroke} strokeWidth="4" fill="none" />
          )}
          {finish === 'teal' && (
            <line x1="28" y1="50" x2="72" y2="50" stroke={style.stroke} strokeWidth="4" />
          )}
        </>
      )}
      {shape === 'square' && (
        <>
          <rect
            x="16"
            y="16"
            width="68"
            height="68"
            rx="10"
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth="6"
          />
          {finish === 'brass' && (
            <rect
              x="34"
              y="34"
              width="32"
              height="32"
              rx="4"
              stroke={style.stroke}
              strokeWidth="4"
              fill="none"
            />
          )}
          {finish === 'teal' && (
            <line x1="26" y1="50" x2="74" y2="50" stroke={style.stroke} strokeWidth="4" />
          )}
        </>
      )}
      {shape === 'triangle' && (
        <>
          <polygon
            points="50,14 88,82 12,82"
            strokeLinejoin="round"
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth="6"
          />
          {finish === 'brass' && (
            <circle cx="50" cy="58" r="10" stroke={style.stroke} strokeWidth="4" fill="none" />
          )}
          {finish === 'teal' && (
            <line x1="34" y1="64" x2="66" y2="64" stroke={style.stroke} strokeWidth="4" />
          )}
        </>
      )}
      {shape === 'diamond' && (
        <>
          <polygon
            points="50,10 90,50 50,90 10,50"
            strokeLinejoin="round"
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth="6"
          />
          {finish === 'brass' && (
            <polygon
              points="50,32 68,50 50,68 32,50"
              stroke={style.stroke}
              strokeWidth="4"
              fill="none"
            />
          )}
          {finish === 'teal' && (
            <line x1="30" y1="50" x2="70" y2="50" stroke={style.stroke} strokeWidth="4" />
          )}
        </>
      )}
    </svg>
  );
};

export const TempoMatchStage: React.FC<TempoMatchStageProps> = ({
  seed,
  difficulty,
  isPaused,
  onHudUpdate,
  onComplete,
}) => {
  const { deck, phase2Start, phase3Start } = useMemo(
    () => generateDeck(seed, difficulty),
    [seed, difficulty]
  );
  const playableTotal = deck.length - 1;

  const [cardIdx, setCardIdx] = useState(0);
  const [phase, setPhase] = useState<'ANCHOR' | 'RULE_SHIFT' | 'ACTIVE'>('ANCHOR');
  const [fuseProgress, setFuseProgress] = useState(1);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [peekVisible, setPeekVisible] = useState(false);

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
  const cardStartTimeRef = useRef<number>(performance.now());
  const pauseStartRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);

  const currentCard = deck[cardIdx];
  const targetLookback = currentCard.rule === 'shape2' ? 2 : 1;
  const referenceCard = cardIdx >= targetLookback ? deck[cardIdx - targetLookback] : null;
  const fuseMs = getCardFuseMs(difficulty, currentCard.rule);

  useEffect(() => {
    if (isPaused) {
      pauseStartRef.current = performance.now();
    } else if (pauseStartRef.current !== null) {
      cardStartTimeRef.current += performance.now() - pauseStartRef.current;
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
      round: Math.max(1, cardIdx),
      totalRounds: playableTotal,
    });
  }, [score, streak, cardIdx, playableTotal, onHudUpdate]);

  const startFromAnchor = useCallback(() => {
    if (phase !== 'ANCHOR' || isPaused) return;
    sound.playTick();
    setCardIdx(1);
    setFuseProgress(1);
    setPhase('ACTIVE');
    cardStartTimeRef.current = performance.now();
  }, [phase, isPaused]);

  useEffect(() => {
    if (phase !== 'ANCHOR' || isPaused) return;
    const t = setTimeout(startFromAnchor, 1700);
    return () => clearTimeout(t);
  }, [phase, isPaused, startFromAnchor]);

  const resumeAfterShift = useCallback(() => {
    if (phase !== 'RULE_SHIFT' || isPaused) return;
    setFuseProgress(1);
    setPhase('ACTIVE');
    cardStartTimeRef.current = performance.now();
  }, [phase, isPaused]);

  useEffect(() => {
    if (phase !== 'RULE_SHIFT' || isPaused) return;
    const waitMs = currentCard.rule === 'shape2' ? 2400 : 1500;
    const t = setTimeout(resumeAfterShift, waitMs);
    return () => clearTimeout(t);
  }, [phase, isPaused, currentCard.rule, resumeAfterShift]);

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
      discipline: 'tempo',
      label: 'Tempo Match',
      score: scoreRef.current,
      accuracy,
      avgReactionMs: avgMs,
      bestStreak: bestStreakRef.current,
      hintsUsed: hintsUsedRef.current,
      roundsCompleted: answeredRef.current,
      totalRounds: playableTotal,
    });
  }, [onComplete, playableTotal]);

  const advanceCard = useCallback(() => {
    lockRef.current = false;
    if (cardIdx >= playableTotal) {
      finishStage();
    } else {
      const nextIdx = cardIdx + 1;
      setCardIdx(nextIdx);
      setFuseProgress(1);
      if (nextIdx === phase2Start || nextIdx === phase3Start) {
        sound.playRuleShift();
        setPhase('RULE_SHIFT');
      } else {
        cardStartTimeRef.current = performance.now();
      }
    }
  }, [cardIdx, playableTotal, phase2Start, phase3Start, finishStage]);

  const handleTimeout = useCallback(() => {
    if (lockRef.current || phase !== 'ACTIVE') return;
    lockRef.current = true;
    setPeekVisible(false);
    answeredRef.current += 1;
    streakRef.current = 0;
    setStreak(0);
    sound.playMiss();
    setFeedback({ correct: false, text: 'Time expired' });
    setTimeout(advanceCard, 220);
  }, [phase, advanceCard]);

  // Live Per-Card Fuse Timer
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
  }, [phase, cardIdx, fuseMs, isPaused, handleTimeout]);

  const handleAnswer = useCallback(
    (playerSaysMatch: boolean) => {
      if (isPaused || phase !== 'ACTIVE' || lockRef.current) return;
      lockRef.current = true;
      setPeekVisible(false);

      const now = performance.now();
      const reactionMs = Math.max(90, Math.round(now - cardStartTimeRef.current));
      answeredRef.current += 1;

      const isCorrect = playerSaysMatch === currentCard.isMatch;

      if (isCorrect) {
        correctRef.current += 1;
        reactionTimesRef.current.push(reactionMs);
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        if (nextStreak > bestStreakRef.current) {
          bestStreakRef.current = nextStreak;
        }

        const twoBackBonus = currentCard.rule === 'shape2' ? 40 : 0;
        const speedBonus = reactionMs < 400 ? 60 : reactionMs < 650 ? 35 : 15;
        const pts = 75 + twoBackBonus + speedBonus + Math.min(nextStreak * 10, 80);
        scoreRef.current += pts;
        setScore(scoreRef.current);
        sound.playSuccess(nextStreak);
        setFeedback({
          correct: true,
          text: `+${pts} pts · ${reactionMs} ms`,
        });
      } else {
        streakRef.current = 0;
        setStreak(0);
        sound.playMiss();
        setFeedback({
          correct: false,
          text: currentCard.isMatch ? 'Missed match' : 'Not a match',
        });
      }

      setTimeout(advanceCard, 150);
    },
    [isPaused, phase, currentCard, advanceCard]
  );

  const handlePeekHint = useCallback(() => {
    if (isPaused || phase !== 'ACTIVE' || hintsLeft <= 0 || !referenceCard || peekVisible) return;
    setHintsLeft((h) => h - 1);
    hintsUsedRef.current += 1;
    setPeekVisible(true);
    sound.playHint();
  }, [isPaused, phase, hintsLeft, referenceCard, peekVisible]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPaused) return;
      if (phase === 'ANCHOR' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        startFromAnchor();
        return;
      }
      if (phase === 'RULE_SHIFT' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        resumeAfterShift();
        return;
      }
      if (phase !== 'ACTIVE') return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || k === 'd' || k === 'f') {
        e.preventDefault();
        handleAnswer(false);
      } else if (e.key === 'ArrowRight' || k === 'm' || k === 'j') {
        e.preventDefault();
        handleAnswer(true);
      } else if (k === 'h') {
        e.preventDefault();
        handlePeekHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPaused, phase, startFromAnchor, resumeAfterShift, handleAnswer, handlePeekHint]);

  const finishStyle = FINISH_STYLES[currentCard.finish];
  const ruleLabel =
    currentCard.rule === 'shape1'
      ? '1-Back: Same SHAPE as previous card?'
      : currentCard.rule === 'finish1'
      ? '1-Back: Same FINISH (color & pattern) as previous?'
      : '2-Back Blitz: Same SHAPE as 2 cards ago?';

  const prev2Card = cardIdx >= 2 ? deck[cardIdx - 2] : null;
  const prev1Card = cardIdx >= 1 ? deck[cardIdx - 1] : null;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 select-none">
      {/* Progress & Rule Banner */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
          <span
            className={
              currentCard.rule === 'shape2'
                ? 'text-rose-300 font-semibold'
                : currentCard.rule === 'finish1'
                ? 'text-amber-300 font-semibold'
                : 'text-teal-300 font-semibold'
            }
          >
            {phase === 'ANCHOR'
              ? 'Memorize Starting Card'
              : phase === 'RULE_SHIFT'
              ? 'Rule Shift Incoming'
              : ruleLabel}
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {Math.max(1, cardIdx)}/{playableTotal}
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-transform duration-150 origin-left ${
              currentCard.rule === 'shape2'
                ? 'bg-rose-400'
                : currentCard.rule === 'finish1'
                ? 'bg-amber-400'
                : 'bg-teal-400'
            }`}
            style={{
              transform: `scaleX(${Math.max(0.05, cardIdx / playableTotal)})`,
            }}
          />
        </div>
      </div>

      {/* Center Focal Card Arena */}
      <div className="relative flex items-center justify-center gap-5 w-full max-w-lg min-h-[268px]">
        {peekVisible && referenceCard && (
          <div className="hidden sm:flex flex-col items-center gap-1.5 animate-card-enter">
            <span className="text-[11px] font-medium text-slate-400">
              {currentCard.rule === 'shape2' ? '2 Cards Ago' : 'Previous'}
            </span>
            <div
              className={`w-24 h-32 rounded-xl border flex flex-col items-center justify-center gap-1.5 ${FINISH_STYLES[referenceCard.finish].bg} ${FINISH_STYLES[referenceCard.finish].border}`}
            >
              <CardGlyph shape={referenceCard.shape} finish={referenceCard.finish} compact />
              <span
                className={`text-[11px] font-medium capitalize ${
                  referenceCard.finish === 'ivory' ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                {referenceCard.shape}
              </span>
            </div>
          </div>
        )}

        {phase === 'RULE_SHIFT' ? (
          <div className="w-72 rounded-2xl bg-[#131C2E] border-2 border-amber-400/80 shadow-2xl flex flex-col items-center justify-center p-6 text-center animate-card-enter space-y-3">
            <span className="text-xs font-mono text-amber-300">
              {currentCard.rule === 'shape2' ? 'PHASE 3 · 2-BACK BLITZ' : 'PHASE 2 · RULE SHIFT'}
            </span>
            <h3 className="font-display text-2xl font-bold text-white">
              {currentCard.rule === 'shape2' ? 'Match 2 Cards Ago' : 'Match Finish'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentCard.rule === 'shape2'
                ? 'Compare each card’s SHAPE against the card shown 2 steps earlier.'
                : 'Ignore shape now. Compare only color and inner pattern to the previous card.'}
            </p>

            {currentCard.rule === 'shape2' && prev2Card && prev1Card && (
              <div className="flex items-center gap-3 pt-1">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-rose-300">2 Ago (Next Target)</span>
                  <div
                    className={`w-16 h-20 rounded-lg border flex items-center justify-center ${FINISH_STYLES[prev2Card.finish].bg} ${FINISH_STYLES[prev2Card.finish].border}`}
                  >
                    <CardGlyph shape={prev2Card.shape} finish={prev2Card.finish} compact />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-75">
                  <span className="text-[10px] font-mono text-slate-400">1 Ago</span>
                  <div
                    className={`w-16 h-20 rounded-lg border flex items-center justify-center ${FINISH_STYLES[prev1Card.finish].bg} ${FINISH_STYLES[prev1Card.finish].border}`}
                  >
                    <CardGlyph shape={prev1Card.shape} finish={prev1Card.finish} compact />
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={resumeAfterShift}
              className="mt-1 px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Continue (Space)
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Stacked Deck Depth */}
            <div
              className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-slate-800/70 border border-white/10"
              aria-hidden="true"
            />
            <div
              key={currentCard.id}
              className={`relative w-64 h-72 rounded-2xl border-2 shadow-2xl flex flex-col items-center justify-between p-5 animate-card-enter ${finishStyle.bg} ${finishStyle.border}`}
            >
              <div className="w-full flex items-center justify-between">
                <span
                  className={`text-xs font-medium capitalize ${
                    currentCard.finish === 'ivory' ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  {finishStyle.label}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    currentCard.finish === 'ivory' ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {phase === 'ANCHOR' ? 'START' : `#${cardIdx}`}
                </span>
              </div>

              <CardGlyph shape={currentCard.shape} finish={currentCard.finish} />

              <div className="w-full space-y-2">
                <div className="text-center">
                  <span
                    className={`text-sm font-semibold capitalize ${
                      currentCard.finish === 'ivory' ? 'text-slate-900' : 'text-slate-100'
                    }`}
                  >
                    {currentCard.shape}
                  </span>
                </div>

                {/* Live Per-Card Fuse Bar */}
                {phase === 'ACTIVE' && (
                  <div className="h-1.5 w-full rounded-full bg-black/25 overflow-hidden">
                    <div
                      className={`h-full rounded-full origin-left ${
                        fuseProgress < 0.3 ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                      style={{ transform: `scaleX(${fuseProgress})` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Line */}
      <div className="h-7 mt-3 flex items-center justify-center">
        {feedback && phase === 'ACTIVE' ? (
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
        ) : phase === 'ANCHOR' ? (
          <p className="text-sm text-slate-300">Memorize this card — tap Ready or wait</p>
        ) : null}
      </div>

      {/* Response Controls */}
      <div className="w-full max-w-md mt-3 flex flex-col items-center gap-3">
        {phase === 'ANCHOR' ? (
          <button
            type="button"
            onClick={startFromAnchor}
            className="w-full max-w-xs h-12 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            Ready (Space)
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              disabled={phase !== 'ACTIVE'}
              onClick={() => handleAnswer(false)}
              className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 border border-white/15 border-b-4 border-b-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-transform disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4 text-rose-400" aria-hidden="true" />
              <span>Different</span>
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">[D]</span>
            </button>
            <button
              type="button"
              disabled={phase !== 'ACTIVE'}
              onClick={() => handleAnswer(true)}
              className="h-14 rounded-xl bg-slate-100 hover:bg-white active:scale-[0.98] text-slate-950 border-b-4 border-b-slate-300 font-semibold text-sm flex items-center justify-center gap-2 transition-transform disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <span>Match</span>
              <span className="text-xs font-mono text-slate-500 hidden sm:inline">[M]</span>
              <ArrowRight className="w-4 h-4 text-teal-600" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="w-full flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400 inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>
              {currentCard.rule === 'shape2'
                ? '2-Back Shape'
                : currentCard.rule === 'finish1'
                ? '1-Back Finish'
                : '1-Back Shape'}
            </span>
          </span>
          <button
            type="button"
            onClick={handlePeekHint}
            disabled={phase !== 'ACTIVE' || hintsLeft <= 0 || peekVisible}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Peek Target ({hintsLeft})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
