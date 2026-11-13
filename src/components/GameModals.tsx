import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Home, Play, RotateCcw } from 'lucide-react';
import {
  DISCIPLINES,
  DailyCompletionRecord,
  GameMode,
  StageResult,
  getCognitiveRank,
} from '../types/game';
import { formatReadableDate } from '../utils/seededRandom';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onQuit,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0B111E]/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#131C2E] border border-white/15 p-6 shadow-2xl animate-modal-enter space-y-5">
        <div>
          <h2 id="pause-title" className="font-display text-2xl font-bold text-white">
            Game Paused
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Timers are frozen until you resume.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Resume (Esc)</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Restart Current Run</span>
          </button>

          <button
            type="button"
            onClick={onQuit}
            className="w-full h-11 rounded-xl bg-transparent hover:bg-slate-800/70 text-slate-300 border border-white/10 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Return to Title</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface RoundSummaryModalProps {
  stageIndex: number;
  totalStages: number;
  result: StageResult;
  nextStageTitle: string;
  onContinue: () => void;
}

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
  stageIndex,
  totalStages,
  result,
  nextStageTitle,
  onContinue,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onContinue]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0B111E]/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-summary-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#131C2E] border border-white/15 p-6 shadow-2xl animate-modal-enter space-y-5">
        <div>
          <p className="text-xs font-medium text-teal-400">
            Stage {stageIndex + 1} of {totalStages} Complete
          </p>
          <h2 id="stage-summary-title" className="font-display text-2xl font-bold text-white mt-1">
            {result.label}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {DISCIPLINES[result.discipline].cognitiveFocus}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/75 border border-white/10">
            <div className="text-[11px] text-slate-400">Score</div>
            <div className="text-lg font-mono font-bold tabular-nums text-white mt-0.5">
              {result.score.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/75 border border-white/10">
            <div className="text-[11px] text-slate-400">Avg Speed</div>
            <div className="text-lg font-mono font-bold tabular-nums text-teal-300 mt-0.5">
              {result.avgReactionMs > 0 ? `${result.avgReactionMs} ms` : '—'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/75 border border-white/10">
            <div className="text-[11px] text-slate-400">Accuracy</div>
            <div className="text-lg font-mono font-bold tabular-nums text-amber-300 mt-0.5">
              {result.accuracy}%
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>Next: {nextStageTitle}</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  mode: GameMode;
  dailyNumber: number;
  todayKey: string;
  streak: number;
  stages: StageResult[];
  record?: DailyCompletionRecord;
  onPlayAgain: () => void;
  onReturnTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  mode,
  dailyNumber,
  todayKey,
  streak,
  stages,
  record,
  onPlayAgain,
  onReturnTitle,
}) => {
  const [copied, setCopied] = useState(false);

  const totalScore = stages.reduce((sum, s) => sum + s.score, 0);
  const validSpeeds = stages.filter((s) => s.avgReactionMs > 0);
  const overallAvgMs =
    validSpeeds.length > 0
      ? Math.round(
          validSpeeds.reduce((sum, s) => sum + s.avgReactionMs, 0) / validSpeeds.length
        )
      : 0;
  const overallAccuracy =
    stages.length > 0
      ? Math.round(stages.reduce((sum, s) => sum + s.accuracy, 0) / stages.length)
      : 100;

  const rank = getCognitiveRank(overallAccuracy, overallAvgMs, totalScore, stages.length);

  const handleCopySummary = async () => {
    const lines = [
      `Mnemon Daily #${dailyNumber} (${formatReadableDate(todayKey)}) · Rank ${rank.grade} (${rank.title})`,
      `Score: ${totalScore.toLocaleString()} · Avg Speed: ${overallAvgMs} ms · Accuracy: ${overallAccuracy}%`,
      ...stages.map(
        (s) => `· ${s.label}: ${s.score} pts (${s.avgReactionMs} ms, ${s.accuracy}%)`
      ),
      `Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const gradeColor =
    rank.grade === 'S'
      ? 'text-amber-300 border-amber-400/60 bg-amber-500/15'
      : rank.grade === 'A'
      ? 'text-teal-300 border-teal-400/60 bg-teal-500/15'
      : rank.grade === 'B'
      ? 'text-sky-300 border-sky-400/60 bg-sky-500/15'
      : 'text-slate-300 border-white/20 bg-slate-800/80';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0B111E]/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#131C2E] border border-white/15 p-6 sm:p-7 shadow-2xl animate-modal-enter space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-teal-400">
              {mode === 'daily'
                ? `Daily #${dailyNumber} Complete · ${formatReadableDate(todayKey)}`
                : 'Practice Session Complete'}
            </p>
            <h2 id="victory-title" className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {mode === 'daily' ? 'Daily Circuit Cleared' : stages[0]?.label ?? 'Complete'}
            </h2>
          </div>

          <div
            className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center shrink-0 ${gradeColor}`}
          >
            <span className="text-[10px] font-medium uppercase leading-none opacity-80">
              Rank
            </span>
            <span className="font-display text-2xl font-bold leading-tight">
              {rank.grade}
            </span>
          </div>
        </div>

        {/* Rank Summary Banner */}
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/75 border border-white/10 flex items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-semibold text-white">{rank.title}</span>
            <span className="text-slate-500 mx-1.5" aria-hidden="true">·</span>
            <span className="text-slate-300">{rank.summary}</span>
          </div>
          {mode === 'daily' && (
            <span className="font-mono tabular-nums text-amber-300 shrink-0 font-semibold">
              {streak}d streak
            </span>
          )}
        </div>

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="text-xs text-slate-400">Total Score</div>
            <div className="text-xl font-mono font-bold tabular-nums text-white mt-1">
              {totalScore.toLocaleString()}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="text-xs text-slate-400">Cognitive Speed</div>
            <div className="text-xl font-mono font-bold tabular-nums text-teal-300 mt-1">
              {overallAvgMs > 0 ? `${overallAvgMs} ms` : '—'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="text-xs text-slate-400">Accuracy</div>
            <div className="text-xl font-mono font-bold tabular-nums text-emerald-400 mt-1">
              {overallAccuracy}%
            </div>
          </div>
        </div>

        {/* Stage Breakdown */}
        <div className="space-y-2">
          {stages.map((stage) => (
            <div
              key={stage.discipline}
              className="flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-xl bg-slate-900/55 border border-white/5 text-xs sm:text-sm"
            >
              <div>
                <div className="font-semibold text-slate-100">{stage.label}</div>
                <div className="text-xs text-slate-400">
                  {DISCIPLINES[stage.discipline].shortTitle}
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums text-xs sm:text-sm">
                <span className="text-teal-300">{stage.avgReactionMs} ms</span>
                <span className="text-slate-300">{stage.accuracy}%</span>
                <span className="text-white font-semibold w-16 text-right">
                  {stage.score}
                </span>
              </div>
            </div>
          ))}
        </div>

        {record && record.totalScore > totalScore && (
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            Today&apos;s Best Daily Score: {record.totalScore.toLocaleString()} pts
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {mode === 'daily' && (
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex-1 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  <span>Share Result</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Play Again</span>
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="flex-1 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Title Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
