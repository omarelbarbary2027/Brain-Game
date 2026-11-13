import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calendar, ChevronRight, LayoutGrid, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import backdropImg from '../assets/images/mnemon_tabletop_backdrop_1794526451477.jpg';
import {
  ALL_DISCIPLINE_IDS,
  ChallengeCategory,
  DISCIPLINES,
  Difficulty,
  DisciplineId,
  GameMode,
  PlayerProgress,
  getDailyStageOrder,
} from '../types/game';
import { formatReadableDate, getDailyNumber } from '../utils/seededRandom';
import { getEffectiveStreak } from '../utils/storage';

interface TitleScreenProps {
  todayKey: string;
  progress: PlayerProgress;
  selectedMode: GameMode;
  selectedDifficulty: Difficulty;
  onSelectMode: (mode: GameMode) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStart: () => void;
  onViewTodayResult: () => void;
  onOpenDashboard: () => void;
  onToggleMute: () => void;
}

const PACE_DESCRIPTIONS: Record<Difficulty, string> = {
  relaxed: 'Relaxed Pace · +40% timer window & gentler grid depth',
  standard: 'Standard Pace · Balanced daily timing & medium complexity',
  master: 'Master Pace · Tight speed fuses & maximum depth',
};

const CATEGORY_FILTERS: ('All' | ChallengeCategory)[] = [
  'All',
  'Memory',
  'Speed',
  'Executive',
  'Pattern & IQ',
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  todayKey,
  progress,
  selectedMode,
  selectedDifficulty,
  onSelectMode,
  onSelectDifficulty,
  onStart,
  onViewTodayResult,
  onOpenDashboard,
  onToggleMute,
}) => {
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'All' | ChallengeCategory>('All');

  const dailyNumber = getDailyNumber(todayKey);
  const readableDate = formatReadableDate(todayKey);
  const streak = getEffectiveStreak(progress, todayKey);
  const todayRecord = progress.dailyRecords[todayKey];
  const dailyStages = useMemo(() => getDailyStageOrder(todayKey), [todayKey]);

  const isDaily = selectedMode === 'daily';
  const activeDiscipline: DisciplineId = isDaily ? dailyStages[0] : selectedMode;
  const activeBest = progress.personalBests[activeDiscipline];

  const filteredDisciplines = useMemo(() => {
    if (categoryFilter === 'All') return ALL_DISCIPLINE_IDS;
    return ALL_DISCIPLINE_IDS.filter((id) => DISCIPLINES[id].category === categoryFilter);
  }, [categoryFilter]);

  const handleSelectCategory = (cat: 'All' | ChallengeCategory) => {
    setCategoryFilter(cat);
    if (cat !== 'All' && !isDaily && DISCIPLINES[selectedMode].category !== cat) {
      const firstMatch = ALL_DISCIPLINE_IDS.find((id) => DISCIPLINES[id].category === cat);
      if (firstMatch) onSelectMode(firstMatch);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON') return;
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart]);

  const difficultyLabel =
    selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0B111E] flex flex-col">
      {/* Bundled Illustrated Tabletop Key-Art Backdrop */}
      {!imgError ? (
        <img
          src={backdropImg}
          alt="Minimalist dark slate tabletop puzzle board with ivory and brushed brass tiles"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-80 pointer-events-none"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#131C2E] to-[#0B111E] pointer-events-none"
          aria-hidden="true"
        />
      )}

      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0B111E]/96 via-[#0B111E]/90 to-[#0B111E]/35 pointer-events-none"
        aria-hidden="true"
      />

      {/* Persistent Top Bar: Always pinned cleanly inside viewport */}
      <header className="relative z-30 w-full flex items-center justify-between gap-2 px-4 sm:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Open menu"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-white/15 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            {menuOpen ? (
              <X className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <LayoutGrid className="w-4 h-4 text-amber-400" aria-hidden="true" />
            )}
            <span>Menu</span>
          </button>

          {menuOpen && (
            <div className="absolute left-0 mt-2 w-60 rounded-xl bg-[#131C2E] border border-white/15 shadow-2xl p-1.5 z-40 space-y-1 animate-modal-enter">
              <button
                type="button"
                onClick={() => {
                  onSelectMode('daily');
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Today&apos;s Daily Trio (#{dailyNumber})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isDaily) onSelectMode('pattern');
                  setCategoryFilter('All');
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                All 10 Brain Challenges
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenDashboard();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Performance Dashboard
              </button>
              {todayRecord && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onViewTodayResult();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-teal-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Today&apos;s Daily Summary
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onToggleMute();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {progress.muted ? 'Unmute Sound' : 'Mute Sound'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDashboard}
            aria-label="Open performance dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-white/15 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={progress.muted ? 'Unmute audio' : 'Mute audio'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            {progress.muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{progress.muted ? 'Muted' : 'Sound On'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Top-anchored flow (never clips top via my-auto), clean-scroll on tiny screens */}
      <div className="relative z-10 flex-1 w-full overflow-y-auto overscroll-contain clean-scroll">
        <div className="w-full max-w-2xl px-4 sm:px-12 lg:px-16 pt-2 sm:pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 sm:space-y-4">
          {/* Brand Lockup & Daily Metadata */}
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5">
              <svg
                width="34"
                height="34"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden="true"
                className="shrink-0 sm:w-10 sm:h-10"
              >
                <rect x="2" y="2" width="18" height="18" rx="4" fill="#F8FAFC" />
                <rect x="24" y="2" width="18" height="18" rx="4" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
                <rect x="2" y="24" width="18" height="18" rx="4" fill="#1E293B" stroke="#2DD4BF" strokeWidth="2" />
                <rect x="24" y="24" width="18" height="18" rx="4" fill="#F59E0B" />
                <circle cx="11" cy="11" r="3" fill="#0F172A" />
              </svg>
              <span className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
                MNEMON
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-slate-300 font-medium">
              <span
                className="inline-flex items-center gap-1.5 text-amber-300"
                title="Today's global daily puzzle edition number"
              >
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Edition #{dailyNumber}</span>
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>{readableDate}</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Streak {streak} {streak === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
            Train memory, speed, executive control, and pattern IQ across a rotating Daily Trio or 10 Practice challenges.
          </p>

          {/* Mode Selector & Details Card */}
          <div className="space-y-2.5 max-w-xl">
            <div className="inline-flex p-1 rounded-lg bg-slate-900/90 border border-white/10">
              <button
                type="button"
                onClick={() => onSelectMode('daily')}
                className={`px-3.5 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isDaily
                    ? 'bg-slate-100 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Daily Trio
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isDaily) onSelectMode('pattern');
                }}
                className={`px-3.5 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isDaily
                    ? 'bg-slate-100 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All 10 Challenges
              </button>
            </div>

            {isDaily ? (
              <div className="p-3 sm:p-4 rounded-xl bg-slate-900/85 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="truncate">
                    Today&apos;s 3-Stage Circuit · Edition #{dailyNumber}
                  </span>
                  <span className="font-mono tabular-nums text-teal-400 shrink-0">
                    New daily set
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {dailyStages.map((id, i) => (
                    <div
                      key={id}
                      className="px-3 py-2 sm:p-3 rounded-lg bg-slate-800/70 border border-white/5 flex sm:block items-center justify-between gap-3"
                    >
                      <div className="flex sm:block items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-amber-300 shrink-0">
                          0{i + 1}
                        </span>
                        <span className="text-slate-600 sm:hidden" aria-hidden="true">·</span>
                        <div className="text-xs font-semibold text-slate-100 truncate sm:mt-0.5">
                          {DISCIPLINES[id].title}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 shrink-0 sm:mt-1">
                        <span className="sm:hidden">
                          {DISCIPLINES[id].category} · {DISCIPLINES[id].shortTitle}
                        </span>
                        <span className="hidden sm:inline leading-snug">
                          {DISCIPLINES[id].category} · {DISCIPLINES[id].shortTitle}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {todayRecord && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400">Today&apos;s Best</div>
                      <div className="text-xs sm:text-sm font-mono font-semibold tabular-nums text-emerald-400 truncate">
                        {todayRecord.totalScore.toLocaleString()} pts · {todayRecord.avgReactionMs} ms
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onViewTodayResult}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Summary</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 sm:p-4 rounded-xl bg-slate-900/85 border border-white/10 space-y-2.5">
                {/* Category Filter Bar */}
                <div className="flex items-center gap-1 overflow-x-auto clean-scroll pb-0.5">
                  {CATEGORY_FILTERS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'bg-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Height-constrained Challenge Grid so Start button stays visible above the fold */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 max-h-[138px] sm:max-h-[164px] overflow-y-auto clean-scroll pr-0.5">
                  {filteredDisciplines.map((id) => {
                    const active = selectedMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectMode(id)}
                        className={`px-2.5 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                          active
                            ? 'bg-teal-500/15 border-teal-400/70 text-white'
                            : 'bg-slate-800/60 border-white/5 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">
                          {DISCIPLINES[id].title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {DISCIPLINES[id].category} · {DISCIPLINES[id].shortTitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-teal-400">
                    What Is Needed · {DISCIPLINES[activeDiscipline].title}
                  </div>
                  <p className="text-xs text-slate-300 leading-snug sm:hidden">
                    {DISCIPLINES[activeDiscipline].summary}
                  </p>
                  <ul className="hidden sm:block space-y-1">
                    {DISCIPLINES[activeDiscipline].whatIsNeeded.map((line, i) => (
                      <li key={i} className="text-xs text-slate-300 leading-snug">
                        · {line}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Challenge Pace Selector + Live Pace Explanation */}
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {activeBest.gamesPlayed > 0 ? (
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        Best: {activeBest.bestScore.toLocaleString()} pts
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-300">
                        Select Pace (before Start)
                      </span>
                    )}

                    <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-white/10 ml-auto">
                      {(['relaxed', 'standard', 'master'] as Difficulty[]).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => onSelectDifficulty(diff)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                            selectedDifficulty === diff
                              ? 'bg-slate-100 text-slate-950 font-semibold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-300/90">
                    {PACE_DESCRIPTIONS[selectedDifficulty]}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={onStart}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-semibold text-sm sm:text-base shadow-lg transition-transform cursor-pointer whitespace-nowrap"
            >
              {isDaily && todayRecord ? (
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              )}
              <span>
                {isDaily
                  ? todayRecord
                    ? 'Replay Daily Trio'
                    : 'Start Daily Puzzle'
                  : `Start ${DISCIPLINES[activeDiscipline].title} · ${difficultyLabel}`}
              </span>
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-400 tracking-wide pt-1">
            <span className="sm:hidden">Tap Tiles · Menu &amp; Sound Top Bar</span>
            <span className="hidden sm:inline">
              Click or Tap Tiles · Arrow Keys / 1–4 / Space Act · H Hint · Esc Pause
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
