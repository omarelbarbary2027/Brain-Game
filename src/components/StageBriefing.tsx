import React, { useEffect } from 'react';
import { ArrowRight, CheckCircle2, Play, ShieldAlert, Sparkles, Sun } from 'lucide-react';
import { DISCIPLINES, Difficulty, DisciplineId, GameMode } from '../types/game';

interface StageBriefingProps {
  discipline: DisciplineId;
  mode: GameMode;
  difficulty: Difficulty;
  stageIndex: number;
  totalStages: number;
  isOverlayHelp?: boolean;
  onStartStage: () => void;
}

export const StageBriefing: React.FC<StageBriefingProps> = ({
  discipline,
  mode,
  difficulty,
  stageIndex,
  totalStages,
  isOverlayHelp = false,
  onStartStage,
}) => {
  const meta = DISCIPLINES[discipline];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || (isOverlayHelp && e.key === 'Escape')) {
        e.preventDefault();
        onStartStage();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartStage, isOverlayHelp]);

  return (
    <div
      className={`${
        isOverlayHelp
          ? 'fixed inset-0 z-40 bg-[#0B111E]/85'
          : 'w-full h-full'
      } flex items-center justify-center p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#131C2E] border border-white/15 p-6 sm:p-7 shadow-2xl animate-modal-enter space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-teal-400">
              {mode === 'daily'
                ? `Daily Stage ${stageIndex + 1} of ${totalStages} · ${meta.category}`
                : `Practice · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Pace`}
            </p>
            <h2 id="briefing-title" className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {meta.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{meta.cognitiveFocus}</p>
          </div>

          <span className="text-xs font-mono text-amber-300 pt-1 shrink-0">
            0{stageIndex + 1} / 0{totalStages}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
          <div className="text-[11px] font-medium text-slate-400 mb-2.5">
            What Is Needed to Clear This Stage
          </div>
          <ul className="space-y-2.5">
            {meta.whatIsNeeded.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200 leading-snug">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {discipline === 'pattern' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border-2 border-amber-400 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 rotate-45 rounded-[2px] bg-amber-500 block" />
              </div>
              <div>
                <div className="font-semibold text-white">Target Tile</div>
                <div className="text-slate-400">Memorize &amp; tap</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-rose-950/90 border-2 border-rose-500/80 flex items-center justify-center shrink-0 text-rose-400 font-bold">
                ×
              </div>
              <div>
                <div className="font-semibold text-rose-300">Hazard Decoy</div>
                <div className="text-slate-400">Do not memorize</div>
              </div>
            </div>
          </div>
        )}

        {discipline === 'tempo' && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">Cards 1–7</div>
              <div className="text-slate-200 mt-0.5">1-Back Shape</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">Cards 8–14</div>
              <div className="text-slate-200 mt-0.5">1-Back Finish</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-amber-400/30">
              <div className="font-mono text-rose-300 font-semibold">Cards 15–20</div>
              <div className="text-slate-200 mt-0.5">2-Back Blitz</div>
            </div>
          </div>
        )}

        {discipline === 'sequence' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border-2 border-amber-400 flex items-center justify-center shrink-0 font-mono font-bold text-slate-900">
                1
              </div>
              <div>
                <div className="font-semibold text-white">Quick-Start Node</div>
                <div className="text-slate-400">Tap early for bonus</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-slate-500" aria-hidden="true" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">Obsidian Blocker</div>
                <div className="text-slate-400">Locked obstacle cell</div>
              </div>
            </div>
          </div>
        )}

        {discipline === 'stroop' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">Phase 1 · Ink Only</div>
              <div className="text-slate-300 mt-0.5">
                &ldquo;AMBER&rdquo; written in Teal → Tap Teal
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">Phase 2 · Alternating</div>
              <div className="text-slate-300 mt-0.5">
                Follow the banner: Ink Color or Word Meaning
              </div>
            </div>
          </div>
        )}

        {discipline === 'pairs' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border-2 border-amber-400 flex items-center justify-center shrink-0">
                <Sun className="w-4 h-4 text-slate-900" aria-hidden="true" />
              </div>
              <div>
                <div className="font-semibold text-white">Study Reveal</div>
                <div className="text-slate-400">Snapshot pair locations</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/15 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 rotate-45 border border-slate-500 block" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">Concealed Card</div>
                <div className="text-slate-400">Flip pairs consecutively</div>
              </div>
            </div>
          </div>
        )}

        {discipline === 'pulse' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">Phase 1 · Higher</div>
              <div className="text-slate-300 mt-0.5">
                Select larger expression (or Equal)
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">Phase 2 · Lower</div>
              <div className="text-slate-300 mt-0.5">
                Rule flips! Select the smaller expression
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>{meta.controlsHint}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onStartStage}
          className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-transform cursor-pointer"
        >
          {isOverlayHelp ? (
            <>
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>Resume Stage</span>
            </>
          ) : (
            <>
              <span>Begin {meta.title} (Space)</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
