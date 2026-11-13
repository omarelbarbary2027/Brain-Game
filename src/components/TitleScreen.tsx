import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Globe,
  LayoutGrid,
  LogOut,
  Play,
  RotateCcw,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
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
import {
  getCategoryLabel,
  getDifficultyLabel,
  getDisciplineInfo,
  getPaceDescription,
  useLanguage,
} from '../i18n/LanguageContext';
import { formatReadableDate, getDailyNumber } from '../utils/seededRandom';
import { getEffectiveStreak } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleScreenProps {
  todayKey: string;
  progress: PlayerProgress;
  selectedMode: GameMode;
  selectedDifficulty: Difficulty;
  activeUsername: string | null;
  authReady: boolean;
  isAuthModalOpen: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStart: () => void;
  onViewTodayResult: () => void;
  onOpenDashboard: () => void;
  onToggleMute: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

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
  activeUsername,
  authReady,
  isAuthModalOpen,
  onSelectMode,
  onSelectDifficulty,
  onStart,
  onViewTodayResult,
  onOpenDashboard,
  onToggleMute,
  onOpenAuth,
  onSignOut,
}) => {
  const { lang, toggleLang } = useLanguage();
  const ar = lang === 'ar';

  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'All' | ChallengeCategory>('All');

  const dailyNumber = getDailyNumber(todayKey);
  const readableDate = formatReadableDate(todayKey, lang);
  const streak = getEffectiveStreak(progress, todayKey);
  const todayRecord = progress.dailyRecords[todayKey];
  const dailyStages = useMemo(() => getDailyStageOrder(todayKey), [todayKey]);

  const isDaily = selectedMode === 'daily';
  const activeDiscipline: DisciplineId = isDaily ? dailyStages[0] : selectedMode;
  const activeDisciplineInfo = getDisciplineInfo(activeDiscipline, lang);
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
      if (isAuthModalOpen) return;
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart, isAuthModalOpen]);

  const difficultyLabel = getDifficultyLabel(selectedDifficulty, lang);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0B111E] flex flex-col">
      {/* Full-Bleed Tabletop Key-Art Hero visible across both Mobile & Desktop */}
      {!imgError ? (
        <img
          src={backdropImg}
          alt={
            ar
              ? 'لوحة ألغاز داكنة أنيقة بقطع عاجية ونحاسية مصقولة'
              : 'Minimalist dark slate tabletop puzzle board with ivory and brushed brass tiles'
          }
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover object-[76%_center] rtl:object-[24%_center] sm:object-center opacity-100 pointer-events-none"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#131C2E] to-[#0B111E] pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Light atmospheric vignette for crisp text readability without hiding the hero tiles */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0B111E]/55 via-[#0B111E]/30 to-[#0B111E]/65 sm:bg-gradient-to-r rtl:sm:bg-gradient-to-l sm:from-[#0B111E]/75 sm:via-[#0B111E]/40 sm:to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Transparent Header with Frosted Glass Icons letting the Hero shine underneath */}
      <header className="relative z-30 w-full flex items-center justify-between gap-2 px-3 sm:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0 bg-transparent">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={ar ? 'فتح القائمة' : 'Open menu'}
            className="inline-flex items-center gap-1.5 sm:gap-2 min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/60 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            {menuOpen ? (
              <X className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <LayoutGrid className="w-4 h-4 text-amber-400" aria-hidden="true" />
            )}
            <span>{ar ? 'القائمة' : 'Menu'}</span>
          </button>

          {menuOpen && (
            <div className="absolute start-0 mt-2 w-64 rounded-xl bg-[#131C2E]/90 backdrop-blur-xl border border-white/20 shadow-2xl p-1.5 z-40 space-y-1 animate-modal-enter">
              <button
                type="button"
                onClick={() => {
                  onSelectMode('daily');
                  setMenuOpen(false);
                }}
                className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {ar ? `التحدي اليومي (#${dailyNumber})` : `Today's Daily Trio (#${dailyNumber})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isDaily) onSelectMode('pattern');
                  setCategoryFilter('All');
                  setMenuOpen(false);
                }}
                className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {ar ? 'جميع التحديات الذهنية (10)' : 'All 10 Brain Challenges'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenDashboard();
                }}
                className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-amber-300 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {ar ? 'لوحة الأداء والإحصاءات' : 'Performance Dashboard'}
              </button>
              <PWAInstallButton
                variant="menu-item"
                onTriggerMenuClose={() => setMenuOpen(false)}
              />
              {todayRecord && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onViewTodayResult();
                  }}
                  className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-teal-300 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {ar ? 'ملخص نتيجة اليوم' : "Today's Daily Summary"}
                </button>
              )}
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                onClick={() => {
                  toggleLang();
                  setMenuOpen(false);
                }}
                className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>{ar ? 'تبديل اللغة إلى English' : 'Switch Language to عربي'}</span>
                <Globe className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {activeUsername
                  ? ar
                    ? `تبديل اللاعب (${activeUsername})`
                    : `Switch User (${activeUsername})`
                  : ar
                  ? 'تسجيل الدخول / إنشاء حساب'
                  : 'Sign In / Create Account'}
              </button>
              {activeUsername && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-rose-300 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{ar ? 'تسجيل الخروج' : 'Sign Out'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onToggleMute();
                  setMenuOpen(false);
                }}
                className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {ar
                  ? progress.muted
                    ? 'تشغيل الصوت'
                    : 'كتم الصوت'
                  : progress.muted
                  ? 'Unmute Sound'
                  : 'Mute Sound'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
            className="inline-flex items-center justify-center gap-1 min-w-[36px] min-h-[36px] px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/60 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            <Globe className="w-3.5 h-3.5 text-teal-300 shrink-0" aria-hidden="true" />
            <span>{ar ? 'EN' : 'عربي'}</span>
          </button>

          <PWAInstallButton variant="header" />

          <button
            type="button"
            onClick={onOpenAuth}
            disabled={!authReady}
            aria-label={
              activeUsername
                ? ar
                  ? `الحساب: ${activeUsername}`
                  : `Account: ${activeUsername}`
                : ar
                ? 'تسجيل الدخول'
                : 'Sign in'
            }
            className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/60 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap max-w-[106px] sm:max-w-[160px] shadow-sm"
          >
            <User className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {!authReady ? '...' : activeUsername ?? (ar ? 'دخول' : 'Sign In')}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenDashboard}
            aria-label={ar ? 'فتح لوحة الأداء' : 'Open performance dashboard'}
            className="inline-flex items-center justify-center gap-1.5 min-w-[36px] min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/60 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">{ar ? 'الأداء' : 'Dashboard'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={
              ar
                ? progress.muted
                  ? 'تشغيل الصوت'
                  : 'كتم الصوت'
                : progress.muted
                ? 'Unmute audio'
                : 'Mute audio'
            }
            className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-lg bg-slate-950/35 hover:bg-slate-900/60 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer shadow-sm"
          >
            {progress.muted ? (
              <VolumeX className="w-4 h-4 text-slate-300" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area: Full-Scale Brand Hero + Translucent Glass Cards */}
      <div className="relative z-10 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain clean-scroll">
        <div className="w-full max-w-2xl px-4 sm:px-12 lg:px-16 pt-1 sm:pt-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2.5 sm:space-y-4">
          {/* Full Brand Lockup & Daily Metadata */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt=""
                  aria-hidden="true"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/20 shadow-lg shrink-0"
                />
                <span className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                  MNEMON
                </span>
              </div>

              {!activeUsername ? (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="sm:hidden px-2.5 py-1 rounded-md bg-slate-950/35 backdrop-blur-md border border-white/15 text-[11px] text-teal-300 hover:text-teal-200 cursor-pointer shrink-0"
                >
                  {ar ? 'حفظ لكل لاعب' : 'Save per user'}
                </button>
              ) : (
                <span className="sm:hidden px-2.5 py-1 rounded-md bg-slate-950/35 backdrop-blur-md border border-white/15 text-[11px] text-teal-300 font-semibold truncate max-w-[110px]">
                  {activeUsername}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-slate-100 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
              <span
                className="inline-flex items-center gap-1.5 text-amber-300"
                title={
                  ar
                    ? 'رقم إصدار اللغز اليومي العالمي'
                    : "Today's global daily puzzle edition number"
                }
              >
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{ar ? `تحدي #${dailyNumber}` : `Daily #${dailyNumber}`}</span>
              </span>
              <span className="text-slate-400" aria-hidden="true">·</span>
              <span>{readableDate}</span>
              <span className="text-slate-400" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {ar
                  ? `تتابع ${streak} ${streak === 1 ? 'يوم' : 'أيام'}`
                  : `Streak ${streak} ${streak === 1 ? 'day' : 'days'}`}
              </span>
              <span className="hidden sm:inline text-slate-400" aria-hidden="true">·</span>
              {activeUsername ? (
                <span className="hidden sm:inline text-teal-300 font-semibold">
                  {ar ? `اللاعب: ${activeUsername}` : `Player: ${activeUsername}`}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="hidden sm:inline text-teal-300 hover:text-teal-200 underline underline-offset-2 cursor-pointer"
                >
                  {ar
                    ? 'وضع الزائر · سجّل لحفظ تقدّم كل لاعب'
                    : 'Guest · Sign in to track per user'}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-100/95 max-w-lg leading-snug sm:leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
            {ar
              ? 'نمِّ الذاكرة وسرعة البديهة والتحكم الذهني واكتشاف الأنماط عبر تحدي اليوم أو 10 تمارين متخصصة.'
              : 'Train memory, speed, executive control & pattern IQ across the Daily Trio or 10 Practice drills.'}
          </p>

          {/* Mode Selector & Translucent Glass Details Card */}
          <div className="space-y-2 sm:space-y-2.5 max-w-xl">
            <div className="inline-flex p-1 rounded-lg bg-slate-950/40 backdrop-blur-md border border-white/15">
              <button
                type="button"
                onClick={() => onSelectMode('daily')}
                className={`px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isDaily
                    ? 'bg-slate-100 text-slate-950 shadow-sm font-semibold'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                {ar ? 'التحدي اليومي' : 'Daily Trio'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isDaily) onSelectMode('pattern');
                }}
                className={`px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isDaily
                    ? 'bg-slate-100 text-slate-950 shadow-sm font-semibold'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                {ar ? 'جميع التحديات (10)' : 'All 10 Challenges'}
              </button>
            </div>

            {isDaily ? (
              <div className="p-3 sm:p-4 rounded-xl bg-slate-950/45 backdrop-blur-md border border-white/15 space-y-2 sm:space-y-2.5 shadow-xl">
                <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-200">
                  <span className="truncate">
                    {ar
                      ? `مراحل اليوم الثلاث · الإصدار #${dailyNumber}`
                      : `Today's 3-Stage Circuit · Edition #${dailyNumber}`}
                  </span>
                  <span className="font-mono tabular-nums text-teal-300 shrink-0 font-medium">
                    {ar ? 'مجموعة متجددة' : 'New daily set'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {dailyStages.map((id, i) => {
                    const info = getDisciplineInfo(id, lang);
                    return (
                      <div
                        key={id}
                        className="px-2.5 py-1.5 sm:p-3 rounded-lg bg-white/[0.06] border border-white/10 flex sm:block items-center justify-between gap-2"
                      >
                        <div className="flex sm:block items-center gap-2 min-w-0">
                          <span className="text-[11px] font-mono text-amber-300 shrink-0 font-semibold">
                            0{i + 1}
                          </span>
                          <span className="text-slate-400 sm:hidden" aria-hidden="true">·</span>
                          <div className="text-xs font-semibold text-white truncate sm:mt-0.5">
                            {info.title}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-300 shrink-0 sm:mt-1">
                          <span className="sm:hidden">{info.categoryLabel}</span>
                          <span className="hidden sm:inline leading-snug">
                            {info.categoryLabel} · {info.shortTitle}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {todayRecord && (
                  <div className="pt-1.5 sm:pt-2 border-t border-white/15 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] sm:text-[11px] text-slate-300">
                        {ar ? 'أفضل نتيجة اليوم' : "Today's Best"}
                      </div>
                      <div className="text-xs sm:text-sm font-mono font-semibold tabular-nums text-emerald-300 truncate">
                        {ar
                          ? `${todayRecord.totalScore.toLocaleString('en-US')} نقطة · ${todayRecord.avgReactionMs} ms`
                          : `${todayRecord.totalScore.toLocaleString('en-US')} pts · ${todayRecord.avgReactionMs} ms`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onViewTodayResult}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>{ar ? 'الملخص' : 'Summary'}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 rtl:rotate-180" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 sm:p-4 rounded-xl bg-slate-950/45 backdrop-blur-md border border-white/15 space-y-2 sm:space-y-2.5 shadow-xl">
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
                          : 'bg-white/[0.08] text-slate-200 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      {getCategoryLabel(cat, lang)}
                    </button>
                  ))}
                </div>

                {/* Height-constrained Challenge Grid so Start button stays visible above the fold */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 max-h-[112px] sm:max-h-[164px] overflow-y-auto clean-scroll pe-0.5">
                  {filteredDisciplines.map((id) => {
                    const active = selectedMode === id;
                    const info = getDisciplineInfo(id, lang);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectMode(id)}
                        className={`px-2.5 py-2 rounded-lg text-start border transition-colors cursor-pointer ${
                          active
                            ? 'bg-teal-400/20 border-teal-300/75 text-white'
                            : 'bg-white/[0.06] border-white/10 text-slate-200 hover:bg-white/[0.12]'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{info.title}</div>
                        <div className="text-[11px] text-slate-300/80 truncate">
                          {info.categoryLabel} · {info.shortTitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-teal-300">
                    {ar
                      ? `المطلوب · ${activeDisciplineInfo.title}`
                      : `What Is Needed · ${activeDisciplineInfo.title}`}
                  </div>
                  <p className="text-xs text-slate-200 leading-snug sm:hidden">
                    {activeDisciplineInfo.summary}
                  </p>
                  <ul className="hidden sm:block space-y-1">
                    {activeDisciplineInfo.whatIsNeeded.map((line, i) => (
                      <li key={i} className="text-xs text-slate-200 leading-snug">
                        · {line}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Challenge Pace Selector + Live Pace Explanation */}
                <div className="pt-2 border-t border-white/15 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {activeBest.gamesPlayed > 0 ? (
                      <div className="text-[11px] font-mono tabular-nums text-slate-300">
                        {ar
                          ? `أفضل نتيجة: ${activeBest.bestScore.toLocaleString('en-US')} نقطة`
                          : `Best: ${activeBest.bestScore.toLocaleString('en-US')} pts`}
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-200">
                        {ar ? 'اختر وتيرة اللعب' : 'Select Pace (before Start)'}
                      </span>
                    )}

                    <div className="inline-flex p-0.5 rounded-lg bg-white/[0.08] border border-white/15 ms-auto">
                      {(['relaxed', 'standard', 'master'] as Difficulty[]).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => onSelectDifficulty(diff)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            selectedDifficulty === diff
                              ? 'bg-slate-100 text-slate-950 font-semibold'
                              : 'text-slate-200 hover:text-white'
                          }`}
                        >
                          {getDifficultyLabel(diff, lang)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-300">
                    {getPaceDescription(selectedDifficulty, lang)}
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
                    ? ar
                      ? 'إعادة التحدي اليومي'
                      : 'Replay Daily Trio'
                    : ar
                    ? 'ابدأ تحدي اليوم'
                    : 'Start Daily Puzzle'
                  : ar
                  ? `ابدأ ${activeDisciplineInfo.title} · ${difficultyLabel}`
                  : `Start ${activeDisciplineInfo.title} · ${difficultyLabel}`}
              </span>
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-400 tracking-wide pt-1">
            <span className="sm:hidden">
              {ar
                ? 'اضغط المربعات للعب · القائمة والصوت في الشريط العلوي'
                : 'Tap Tiles · Menu & Sound Top Bar'}
            </span>
            <span className="hidden sm:inline">
              {ar
                ? 'اضغط المربعات أو استخدم الأسهم / 1–4 / المسافة · H تلميح · Esc إيقاف مؤقت'
                : 'Click or Tap Tiles · Arrow Keys / 1–4 / Space Act · H Hint · Esc Pause'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
