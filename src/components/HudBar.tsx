import React from 'react';
import { HelpCircle, Pause, Volume2, VolumeX } from 'lucide-react';
import { DISCIPLINES, DisciplineId, GameMode } from '../types/game';
import { LiveStageHud } from './stages/PatternEchoStage';

interface HudBarProps {
  mode: GameMode;
  dailyNumber: number;
  stageIndex: number;
  totalStages: number;
  discipline: DisciplineId;
  hud: LiveStageHud;
  muted: boolean;
  onToggleMute: () => void;
  onShowRules: () => void;
  onPause: () => void;
}

export const HudBar: React.FC<HudBarProps> = ({
  mode,
  dailyNumber,
  stageIndex,
  totalStages,
  discipline,
  hud,
  muted,
  onToggleMute,
  onShowRules,
  onPause,
}) => {
  const title = DISCIPLINES[discipline].title;

  return (
    <header className="pointer-events-none fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-200">
        <span className="font-display font-semibold text-white whitespace-nowrap">
          {title}
        </span>
        <span className="text-slate-600" aria-hidden="true">·</span>
        <span className="text-slate-400 whitespace-nowrap">
          {mode === 'daily'
            ? `Daily #${dailyNumber} · Stage ${stageIndex + 1}/${totalStages}`
            : 'Practice'}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-mono tabular-nums">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-sans text-xs">Score</span>
            <span className="text-white font-semibold">{hud.score.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-sans text-xs">Streak</span>
            <span className={hud.streak > 1 ? 'text-amber-300 font-semibold' : 'text-slate-200'}>
              ×{hud.streak}
            </span>
          </div>

          {hud.lastReactionMs !== null && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-400 font-sans text-xs">Speed</span>
              <span className="text-teal-300 font-semibold">{hud.lastReactionMs} ms</span>
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onShowRules}
            aria-label="Show stage rules"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span className="hidden sm:inline">Rules</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="p-2 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Pause className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>
    </header>
  );
};
