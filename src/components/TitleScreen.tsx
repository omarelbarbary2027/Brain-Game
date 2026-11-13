import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Check,
  ChevronRight,
  Globe,
  LayoutGrid,
  LogOut,
  Play,
  RotateCcw,
  Trophy,
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
import { CATEGORY_THEMES } from '../utils/categoryTheme';
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
  onQuickLaunchDiscipline: (discipline: DisciplineId) => void;
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
  onQuickLaunchDiscipline,
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
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const dailyNumber = getDailyNumber(todayKey);
  const readableDate = formatReadableDate(todayKey, lang);
  const streak = getEffectiveStreak(progress, todayKey);
  const todayRecord = progress.dailyRecords[todayKey];
  const dailyStages = useMemo(() => getDailyStageOrder(todayKey), [todayKey]);

  const isDaily = selectedMode === 'daily';
  const activeDiscipline: DisciplineId = isDaily ? dailyStages[0] : selectedMode;
  const activeDisciplineInfo = getDisciplineInfo(activeDiscipline, lang);
  const activeBest = progress.personalBests[activeDiscipline];
  const activeTheme = CATEGORY_THEMES[activeDisciplineInfo.category];
  const ActiveCategoryIcon = activeTheme.Icon;

  const todayStageScoreMap = useMemo(() => {
    const map = new Map<DisciplineId, number>();
    if (todayRecord) {
      for (const st of todayRecord.stages) {
        map.set(st.discipline, st.score);
      }
    }
    return map;
  }, [todayRecord]);

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

  // Click-outside + Escape closes dropdown menu reliably
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isAuthModalOpen || menuOpen) return;
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart, isAuthModalOpen, menuOpen]);

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
          className="absolute inset-0 w-full h-full object-cover object-[78%_center] lg:object-right opacity-95 pointer-events-none"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#131C2E] to-[#0B111E] pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Atmospheric scrim preserving contrast over the tabletop key art */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none"
        aria-hidden="true"
      />

      {/* Transparent Header with Frosted Glass Controls letting the Hero shine underneath */}
      <header className="relative z-30 w-full flex items-center justify-between gap-2 px-3 sm:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0 bg-transparent">
        <div ref={menuContainerRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={ar ? 'فتح القائمة' : 'Open menu'}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] min-w-[40px] px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/65 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            {menuOpen ? (
              <X className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <LayoutGrid className="w-4 h-4 text-amber-400" aria-hidden="true" />
            )}
            <span>{ar ? 'القائمة' : 'Menu'}</span>
          </button>

          {menuOpen && (
            <div className="absolute start-0 mt-2 w-64 rounded-xl bg-[#131C2E]/95 backdrop-blur-xl border border-white/20 shadow-2xl p-1.5 z-40 space-y-1 animate-modal-enter">
              <button
                type="button"
                onClick={() => {
                  onSelectMode('daily');
                  setMenuOpen(false);
                }}
                className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
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
                className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {ar ? 'جميع التحديات الذهنية (10)' : 'All 10 Brain Challenges'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenDashboard();
                }}
                className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-amber-300 hover:bg-white/10 transition-colors cursor-pointer"
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
                  className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-teal-300 hover:bg-white/10 transition-colors cursor-pointer"
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
                className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between"
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
                className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
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
                  className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-rose-300 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-2"
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
                className="w-full text-start px-3 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
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
            className="inline-flex items-center justify-center gap-1 min-w-[40px] min-h-[40px] px-2.5 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/65 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-sm"
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
            className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/65 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap max-w-[112px] sm:max-w-[160px] shadow-sm"
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
            className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-950/35 hover:bg-slate-900/65 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shadow-sm"
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
            className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] p-2 rounded-lg bg-slate-950/35 hover:bg-slate-900/65 backdrop-blur-md text-slate-100 border border-white/20 text-xs font-medium transition-colors cursor-pointer shadow-sm"
          >
            {progress.muted ? (
              <VolumeX className="w-4 h-4 text-slate-300" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area: Brand Hero + Interactive Mode Surface */}
      <div className="relative z-10 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain clean-scroll">
        <div className="w-full max-w-xl lg:max-w-xl px-4 sm:px-8 lg:px-12 pt-2 sm:pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 sm:space-y-4">
          {/* Brand Lockup & Clean Typographic Metadata */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt=""
                  aria-hidden="true"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-white/20 shadow-lg shrink-0"
                />
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                  MNEMON
                </h1>
              </div>

              {!activeUsername ? (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="sm:hidden px-2.5 py-1.5 rounded-lg bg-slate-950/40 backdrop-blur-md border border-white/15 text-[11px] font-medium text-teal-300 hover:text-teal-200 cursor-pointer shrink-0"
                >
                  {ar ? 'حفظ لكل لاعب' : 'Save per user'}
                </button>
              ) : (
                <span className="sm:hidden text-xs text-teal-300 font-semibold truncate max-w-[110px]">
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

          <p className="text-xs sm:text-sm text-slate-100/95 max-w-xl leading-snug sm:leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
            {ar
              ? 'نمِّ الذاكرة وسرعة البديهة والتحكم الذهني واكتشاف الأنماط عبر تحدي اليوم أو 10 تمارين متخصصة.'
              : 'Train memory, speed, executive control & pattern IQ across the Daily Trio or 10 Practice drills.'}
          </p>

          {/* Mode Selector + Single-Elevation Glass Surface */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex p-1 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/20">
              <button
                type="button"
                onClick={() => onSelectMode('daily')}
                className={`min-h-[36px] px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
                className={`min-h-[36px] px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isDaily
                    ? 'bg-slate-100 text-slate-950 shadow-sm font-semibold'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                {ar ? 'جميع التحديات (10)' : 'All 10 Challenges'}
              </button>
            </div>

            {isDaily ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/25 sm:bg-slate-950/30 backdrop-blur-xl border border-white/20 space-y-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-200">
                  <span className="truncate font-medium">
                    {ar
                      ? `مراحل اليوم الثلاث · الإصدار #${dailyNumber}`
                      : `Today's 3-Stage Circuit · Edition #${dailyNumber}`}
                  </span>
                  <span className="text-teal-300 shrink-0 font-medium">
                    {ar ? 'اضغط أي مرحلة للبدء المباشر' : 'Tap any stage to play'}
                  </span>
                </div>

                {/* Clickable Daily Stage Cards with Category Icons, Domain Color Accents & Best Scores */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {dailyStages.map((id, i) => {
                    const info = getDisciplineInfo(id, lang);
                    const theme = CATEGORY_THEMES[info.category];
                    const CatIcon = theme.Icon;
                    const todayStageScore = todayStageScoreMap.get(id);
                    const stageBest = progress.personalBests[id]?.bestScore ?? 0;

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onQuickLaunchDiscipline(id)}
                        className={`group w-full min-h-[56px] text-start p-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.18] active:scale-[0.99] backdrop-blur-md border border-white/15 hover:${theme.borderClass} flex sm:flex-col items-center sm:items-stretch justify-between gap-2.5 transition-all cursor-pointer`}
                      >
                        <div className="flex items-center sm:justify-between gap-2.5 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg ${theme.accentBgClass} flex items-center justify-center shrink-0`}
                            >
                              <CatIcon className={`w-3.5 h-3.5 ${theme.textClass}`} aria-hidden="true" />
                            </span>
                            <div className="min-w-0 sm:hidden">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono font-semibold text-amber-300">
                                  0{i + 1}
                                </span>
                                <span className="text-xs font-semibold text-white truncate">
                                  {info.title}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-300 truncate">
                                {info.categoryLabel} · {info.shortTitle}
                              </div>
                            </div>
                          </div>

                          <div className="hidden sm:flex items-center justify-between gap-1.5">
                            <span className="text-[11px] font-mono font-semibold text-amber-300">
                              0{i + 1}
                            </span>
                            <ChevronRight
                              className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors rtl:rotate-180"
                              aria-hidden="true"
                            />
                          </div>
                        </div>

                        <div className="hidden sm:block">
                          <div className="text-sm font-semibold text-white truncate">
                            {info.title}
                          </div>
                          <div className={`text-[11px] ${theme.textClass} truncate mt-0.5`}>
                            {info.categoryLabel} · {info.shortTitle}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 sm:pt-1.5 sm:border-t sm:border-white/10 sm:justify-between">
                          {todayStageScore !== undefined ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-emerald-300 font-medium">
                              <Check className="w-3 h-3" aria-hidden="true" />
                              {todayStageScore.toLocaleString('en-US')}
                            </span>
                          ) : stageBest > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-slate-300">
                              <Trophy className="w-3 h-3 text-amber-400" aria-hidden="true" />
                              {stageBest.toLocaleString('en-US')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {ar ? 'جاهز' : 'Play'}
                            </span>
                          )}

                          <ChevronRight
                            className="sm:hidden w-4 h-4 text-slate-400 group-hover:text-white transition-colors rtl:rotate-180"
                            aria-hidden="true"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {todayRecord && (
                  <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-300">
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
                      className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>{ar ? 'الملخص' : 'Summary'}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 rtl:rotate-180" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/25 sm:bg-slate-950/30 backdrop-blur-xl border border-white/20 space-y-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {/* Category Filter Bar + Compact Pace Switcher (flex-wrap prevents mobile/RTL clipping) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {CATEGORY_FILTERS.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleSelectCategory(cat)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap cursor-pointer backdrop-blur-md ${
                          categoryFilter === cat
                            ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                            : 'bg-white/[0.10] text-slate-100 hover:bg-white/[0.20]'
                        }`}
                      >
                        {getCategoryLabel(cat, lang)}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 sm:inline-flex p-0.5 rounded-lg bg-white/[0.10] backdrop-blur-md border border-white/20 sm:ms-auto shrink-0">
                    {(['relaxed', 'standard', 'master'] as Difficulty[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => onSelectDifficulty(diff)}
                        className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap text-center ${
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

                {/* All 10 Challenge Cards Visible Without Hidden Scroll Clipping */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredDisciplines.map((id) => {
                    const active = selectedMode === id;
                    const info = getDisciplineInfo(id, lang);
                    const theme = CATEGORY_THEMES[info.category];
                    const CatIcon = theme.Icon;
                    const best = progress.personalBests[id]?.bestScore ?? 0;

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectMode(id)}
                        className={`min-h-[54px] px-2.5 py-2 rounded-xl text-start border transition-all cursor-pointer flex items-center gap-2.5 backdrop-blur-md ${
                          active
                            ? `${theme.activeCardClass} shadow-md`
                            : 'bg-white/[0.08] border-white/15 text-slate-100 hover:bg-white/[0.18]'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg ${theme.accentBgClass} flex items-center justify-center shrink-0`}
                        >
                          <CatIcon className={`w-3.5 h-3.5 ${theme.textClass}`} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate text-white">
                            {info.title}
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-300/85 truncate">
                            <span className="truncate">{info.shortTitle}</span>
                            {best > 0 && (
                              <span className="font-mono tabular-nums text-amber-300 shrink-0">
                                {best.toLocaleString('en-US')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Concise Active Challenge Summary + Pace Note */}
                <div className="pt-2 border-t border-white/15 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg ${activeTheme.accentBgClass} flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      <ActiveCategoryIcon
                        className={`w-4 h-4 ${activeTheme.textClass}`}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-white">
                        <span>{activeDisciplineInfo.title}</span>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className={`font-medium ${activeTheme.textClass}`}>
                          {activeDisciplineInfo.categoryLabel}
                        </span>
                        {activeBest.gamesPlayed > 0 && (
                          <>
                            <span className="text-slate-500" aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-amber-300 font-medium">
                              {ar
                                ? `أفضل: ${activeBest.bestScore.toLocaleString('en-US')}`
                                : `Best: ${activeBest.bestScore.toLocaleString('en-US')}`}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-slate-200/90 leading-snug">
                        {activeDisciplineInfo.summary}
                      </p>
                      <p className="text-[11px] text-amber-300/95">
                        {getPaceDescription(selectedDifficulty, lang)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Primary Action CTA — Positioned Cleanly in Thumb Reach */}
          <div className="pt-0.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStart}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-semibold text-sm sm:text-base shadow-lg transition-transform cursor-pointer whitespace-nowrap"
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

            <span className="hidden lg:inline text-xs text-slate-400">
              {ar
                ? 'اختصارات: الأسهم / 1–4 / المسافة · H تلميح · Esc إيقاف مؤقت'
                : 'Shortcuts: Arrows / 1–4 / Space · H Hint · Esc Pause'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
