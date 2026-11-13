import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import {
  ALL_DISCIPLINE_IDS,
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
  onToggleMute: () => void;
}

const BACKDROP_URL = '/src/assets/images/mnemon_tabletop_backdrop_1794526451477.jpg';

export const TitleScreen: React.FC<TitleScreenProps> = ({
  todayKey,
  progress,
  selectedMode,
  selectedDifficulty,
  onSelectMode,
  onSelectDifficulty,
  onStart,
  onViewTodayResult,
  onToggleMute,
}) => {
  const [imgError, setImgError] = useState(false);

  const dailyNumber = getDailyNumber(todayKey);
  const readableDate = formatReadableDate(todayKey);
  const streak = getEffectiveStreak(progress, todayKey);
  const todayRecord = progress.dailyRecords[todayKey];
  const dailyStages = useMemo(() => getDailyStageOrder(todayKey), [todayKey]);

  const isDaily = selectedMode === 'daily';
  const activeDiscipline: DisciplineId = isDaily ? dailyStages[0] : selectedMode;
  const activeBest = progress.personalBests[activeDiscipline];

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

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0B111E] flex items-center">
      {!imgError ? (
        <img
          src={BACKDROP_URL}
          alt="Minimalist dark slate tabletop puzzle board with ivory and brushed brass tiles"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#131C2E] to-[#0B111E]"
          aria-hidden="true"
        />
      )}

      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0B111E]/96 via-[#0B111E]/90 to-[#0B111E]/35"
        aria-hidden="true"
      />

      <div className="absolute top-5 right-6 z-20">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={progress.muted ? 'Unmute audio' : 'Mute audio'}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          {progress.muted ? (
            <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
          ) : (
            <Volume2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
          )}
          <span>{progress.muted ? 'Muted' : 'Sound On'}</span>
        </button>
      </div>

      <div className="relative z-10 w-full max-w-2xl px-6 sm:px-12 lg:px-16 py-5 flex flex-col justify-between h-full max-h-[860px]">
        <div className="my-auto space-y-4">
          <div>
            <div className="flex items-center gap-3.5 mb-2">
              <svg
                width="42"
                height="42"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <rect x="2" y="2" width="18" height="18" rx="4" fill="#F8FAFC" />
                <rect x="24" y="2" width="18" height="18" rx="4" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
                <rect x="2" y="24" width="18" height="18" rx="4" fill="#1E293B" stroke="#2DD4BF" strokeWidth="2" />
                <rect x="24" y="24" width="18" height="18" rx="4" fill="#F59E0B" />
                <circle cx="11" cy="11" r="3" fill="#0F172A" />
              </svg>
              <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">
                MNEMON
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-300 font-medium">
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                Daily #{dailyNumber}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>{readableDate}</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Streak {streak} {streak === 1 ? 'day' : 'days'}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-400">6 Disciplines</span>
            </div>
          </div>

          <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
            Train spatial memory, visual recall, impulse control, and arithmetic speed across a rotating Daily Trio or 6 dedicated Practice challenges.
          </p>

          <div className="space-y-3 max-w-xl">
            <div className="inline-flex p-1 rounded-lg bg-slate-900/90 border border-white/10">
              <button
                type="button"
                onClick={() => onSelectMode('daily')}
                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isDaily
                    ? 'bg-slate-100 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All 6 Challenges
              </button>
            </div>

            {isDaily ? (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Today&apos;s Rotating Lineup (1 Memory · 1 Speed · 1 Executive)</span>
                  <span className="font-mono tabular-nums text-teal-400 shrink-0">Standard</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {dailyStages.map((id, i) => (
                    <div
                      key={id}
                      className="p-3 rounded-lg bg-slate-800/70 border border-white/5 space-y-1"
                    >
                      <div className="text-[11px] font-mono text-amber-300">
                        0{i + 1} · {DISCIPLINES[id].category}
                      </div>
                      <div className="text-xs font-semibold text-slate-100">
                        {DISCIPLINES[id].title}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {DISCIPLINES[id].summary}
                      </p>
                    </div>
                  ))}
                </div>

                {todayRecord && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
                    <span className="text-emerald-400 font-medium font-mono tabular-nums">
                      Completed · {todayRecord.totalScore.toLocaleString()} pts · {todayRecord.avgReactionMs} ms
                    </span>
                    <button
                      type="button"
                      onClick={onViewTodayResult}
                      className="text-slate-200 underline underline-offset-4 hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      View Summary
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_DISCIPLINE_IDS.map((id) => {
                    const active = selectedMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectMode(id)}
                        className={`px-3 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
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

                <div className="space-y-1 pt-0.5">
                  <div className="text-[11px] font-medium text-teal-400">
                    What Is Needed · {DISCIPLINES[activeDiscipline].title}
                  </div>
                  <ul className="space-y-1">
                    {DISCIPLINES[activeDiscipline].whatIsNeeded.map((line, i) => (
                      <li key={i} className="text-xs text-slate-300 leading-snug">
                        · {line}
                      </li>
                    ))}
                  </ul>
                </div>

                {activeBest.gamesPlayed > 0 && (
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 pt-1 border-t border-white/10">
                    Best: {activeBest.bestScore.toLocaleString()} pts · Fastest{' '}
                    {activeBest.fastestAvgMs > 0 ? `${activeBest.fastestAvgMs} ms` : '—'} ·{' '}
                    {activeBest.bestAccuracy}% acc
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-400">Challenge Pace</span>
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-white/10">
                    {(['relaxed', 'standard', 'master'] as Difficulty[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => onSelectDifficulty(diff)}
                        className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                          selectedDifficulty === diff
                            ? 'bg-slate-100 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-0.5">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-semibold text-sm sm:text-base shadow-lg transition-transform cursor-pointer whitespace-nowrap"
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
                  : `Start ${DISCIPLINES[activeDiscipline].title}`}
              </span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 tracking-wide pt-2">
          Click or Tap Tiles · Arrow Keys / 1–4 / Space Act · H Hint · Esc Pause
        </p>
      </div>
    </div>
  );
};
