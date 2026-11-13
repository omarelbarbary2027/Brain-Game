import React from 'react';
import { HelpCircle, LayoutGrid, Pause, Volume2, VolumeX } from 'lucide-react';
import { DisciplineId, GameMode } from '../types/game';
import { getDisciplineInfo, useLanguage } from '../i18n/LanguageContext';
import { LiveStageHud } from './stages/PatternEchoStage';

interface HudBarProps {
  mode: GameMode;
  dailyNumber: number;
  stageIndex: number;
  totalStages: number;
  discipline: DisciplineId;
  hud: LiveStageHud;
  muted: boolean;
  showPlayMetrics: boolean;
  onMenu: () => void;
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
  showPlayMetrics,
  onMenu,
  onToggleMute,
  onShowRules,
  onPause,
}) => {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const title = getDisciplineInfo(discipline, lang).title;

  return (
    <header className="sticky top-0 inset-x-0 z-30 shrink-0 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2.5 bg-[#0B111E]/92 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenu}
          aria-label={ar ? 'العودة للقائمة الرئيسية' : 'Return to main menu'}
          className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-white/15 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <LayoutGrid className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" aria-hidden="true" />
          <span className="hidden sm:inline">{ar ? 'القائمة' : 'Menu'}</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-slate-200 min-w-0">
          <span className="font-display font-semibold text-white truncate">
            {title}
          </span>
          <span className="text-slate-600 shrink-0" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-slate-400 whitespace-nowrap text-[11px] sm:text-xs shrink-0">
            {mode === 'daily' ? (
              <>
                <span className="sm:hidden">
                  {stageIndex + 1}/{totalStages}
                </span>
                <span className="hidden sm:inline">
                  #{dailyNumber} · {stageIndex + 1}/{totalStages}
                </span>
              </>
            ) : ar ? (
              'تدريب'
            ) : (
              'Practice'
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {showPlayMetrics && (
          <div className="flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm font-mono tabular-nums">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans text-[11px] sm:text-xs hidden sm:inline">
                {ar ? 'النقاط' : 'Score'}
              </span>
              <span className="text-white font-semibold">{hud.score.toLocaleString('en-US')}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans text-[11px] sm:text-xs hidden sm:inline">
                {ar ? 'التتابع' : 'Streak'}
              </span>
              <span className={hud.streak > 1 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                ×{hud.streak}
              </span>
            </div>

            {hud.lastReactionMs !== null && (
              <div className="hidden md:flex items-center gap-1.5 min-w-[96px] justify-end">
                <span className="text-slate-400 font-sans text-xs">
                  {ar ? 'السرعة' : 'Speed'}
                </span>
                <span dir="ltr" className="text-teal-300 font-semibold">
                  {hud.lastReactionMs} ms
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showPlayMetrics && (
            <button
              type="button"
              onClick={onShowRules}
              aria-label={ar ? 'عرض شرح المرحلة' : 'Show stage rules'}
              className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] sm:min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <HelpCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" aria-hidden="true" />
              <span className="hidden sm:inline">{ar ? 'الشرح' : 'Rules'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={
              ar
                ? muted
                  ? 'تشغيل الصوت'
                  : 'كتم الصوت'
                : muted
                ? 'Unmute sound'
                : 'Mute sound'
            }
            className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-h-[38px] sm:min-w-[38px] p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
            )}
          </button>

          {showPlayMetrics && (
            <button
              type="button"
              onClick={onPause}
              aria-label={ar ? 'إيقاف مؤقت' : 'Pause game'}
              className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] sm:min-h-[38px] px-2 sm:px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Pause className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{ar ? 'إيقاف' : 'Pause'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
