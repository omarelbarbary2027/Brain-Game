import React, { useEffect } from 'react';
import { ArrowRight, CheckCircle2, Home, Play, ShieldAlert, Sparkles, Sun } from 'lucide-react';
import { Difficulty, DisciplineId, GameMode } from '../types/game';
import { getDifficultyLabel, getDisciplineInfo, useLanguage } from '../i18n/LanguageContext';

interface StageBriefingProps {
  discipline: DisciplineId;
  mode: GameMode;
  difficulty: Difficulty;
  stageIndex: number;
  totalStages: number;
  isOverlayHelp?: boolean;
  onStartStage: () => void;
  onMenu?: () => void;
}

export const StageBriefing: React.FC<StageBriefingProps> = ({
  discipline,
  mode,
  difficulty,
  stageIndex,
  totalStages,
  isOverlayHelp = false,
  onStartStage,
  onMenu,
}) => {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const meta = getDisciplineInfo(discipline, lang);
  const diffLabel = getDifficultyLabel(difficulty, lang);

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
      } flex items-center justify-center p-3 sm:p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-title"
    >
      <div className="w-full max-w-lg max-h-[88dvh] overflow-y-auto overscroll-contain clean-scroll rounded-2xl bg-[#131C2E] border border-white/15 p-5 sm:p-7 shadow-2xl animate-modal-enter space-y-4 sm:space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-teal-400">
              {mode === 'daily'
                ? ar
                  ? `المرحلة اليومية ${stageIndex + 1} من ${totalStages} · ${meta.categoryLabel}`
                  : `Daily Stage ${stageIndex + 1} of ${totalStages} · ${meta.categoryLabel}`
                : ar
                ? `تدريب حر · وتيرة ${diffLabel}`
                : `Practice · ${diffLabel} Pace`}
            </p>
            <h2 id="briefing-title" className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {meta.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{meta.cognitiveFocus}</p>
          </div>

          <span dir="ltr" className="text-xs font-mono text-amber-300 pt-1 shrink-0">
            0{stageIndex + 1} / 0{totalStages}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
          <div className="text-[11px] font-medium text-slate-400 mb-2">
            {ar ? 'المطلوب لتجاوز المرحلة' : 'What Is Needed to Clear This Stage'}
          </div>
          <ul className="space-y-2">
            {meta.whatIsNeeded.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-snug">
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
                <div className="font-semibold text-white">{ar ? 'مربع الهدف' : 'Target Tile'}</div>
                <div className="text-slate-400">{ar ? 'احفظه واضغطه' : 'Memorize & tap'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-rose-950/90 border-2 border-rose-500/80 flex items-center justify-center shrink-0 text-rose-400 font-bold">
                ×
              </div>
              <div>
                <div className="font-semibold text-rose-300">{ar ? 'مشتّت خطر' : 'Hazard Decoy'}</div>
                <div className="text-slate-400">{ar ? 'تجنّبه تماماً' : 'Do not memorize'}</div>
              </div>
            </div>
          </div>
        )}

        {discipline === 'tempo' && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">{ar ? 'بطاقات 1–7' : 'Cards 1–7'}</div>
              <div className="text-slate-200 mt-0.5">{ar ? 'تطابق الشكل (1)' : '1-Back Shape'}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">{ar ? 'بطاقات 8–14' : 'Cards 8–14'}</div>
              <div className="text-slate-200 mt-0.5">{ar ? 'اللون والنمط (1)' : '1-Back Finish'}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-amber-400/30">
              <div className="font-mono text-rose-300 font-semibold">{ar ? 'بطاقات 15–20' : 'Cards 15–20'}</div>
              <div className="text-slate-200 mt-0.5">{ar ? 'خطوتان للخلف' : '2-Back Blitz'}</div>
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
                <div className="font-semibold text-white">{ar ? 'انطلاقة سريعة' : 'Quick-Start Node'}</div>
                <div className="text-slate-400">{ar ? 'اضغط 1 مبكراً للمكافأة' : 'Tap early for bonus'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-slate-500" aria-hidden="true" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">{ar ? 'حاجز مغلق' : 'Obsidian Blocker'}</div>
                <div className="text-slate-400">{ar ? 'خانة عائق لا تُفتح' : 'Locked obstacle cell'}</div>
              </div>
            </div>
          </div>
        )}

        {discipline === 'stroop' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">{ar ? 'المرحلة 1 · لون الحبر' : 'Phase 1 · Ink Only'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'كلمة «ذهبي» بحبر فيروزي ← اضغط فيروزي'
                  : '“AMBER” written in Teal → Tap Teal'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">{ar ? 'المرحلة 2 · متبدل' : 'Phase 2 · Alternating'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'انتبه للتوجيه: لون الحبر أو معنى الكلمة'
                  : 'Follow the banner: Ink Color or Word Meaning'}
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
                <div className="font-semibold text-white">{ar ? 'لحظة الحفظ' : 'Study Reveal'}</div>
                <div className="text-slate-400">{ar ? 'ثبّت مواقع الأزواج' : 'Snapshot pair locations'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/15 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 rotate-45 border border-slate-500 block" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">{ar ? 'بطاقة مقلوبة' : 'Concealed Card'}</div>
                <div className="text-slate-400">{ar ? 'طابق الأزواج بالتتابع' : 'Flip pairs consecutively'}</div>
              </div>
            </div>
          </div>
        )}

        {discipline === 'pulse' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">{ar ? 'المرحلة 1 · الأكبر' : 'Phase 1 · Higher'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar ? 'اختر القيمة الأكبر (أو متساوٍ)' : 'Select larger expression (or Equal)'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">{ar ? 'المرحلة 2 · الأقل' : 'Phase 2 · Lower'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar ? 'تُعكس القاعدة! اختر القيمة الأصغر' : 'Rule flips! Select the smaller expression'}
              </div>
            </div>
          </div>
        )}

        {discipline === 'matrix' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">{ar ? '3 سمات بصرية' : '3 Visual Rules'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'راقب تغير الشكل والتعبئة والعدد في الصفوف والأعمدة'
                  : 'Track Shape, Fill Style, and Count across rows & columns'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">{ar ? 'الخانة المفقودة ؟' : 'Missing ? Tile'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'اختر بديلاً من 4 خيارات قبل نفاد المؤقت'
                  : 'Pick 1 of 4 candidates (Keys 1–4) before timer expires'}
              </div>
            </div>
          </div>
        )}

        {discipline === 'digitspan' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">{ar ? 'الجولات 1–3 · تصاعدي' : 'Rounds 1–3 · Forward'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'أدخل الأرقام بنفس ترتيب ظهورها (4-9-2 ← 492)'
                  : 'Enter digits in exact flash order (e.g. 4-9-2 → 492)'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-amber-400/25">
              <div className="font-mono text-amber-300 font-semibold">{ar ? 'الجولات 4–5 · عكسي' : 'Rounds 4–5 · Reverse'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'اعكس الترتيب ذهنياً قبل الإدخال (4-9-2 ← 294)'
                  : 'Flip your memory buffer backwards (4-9-2 → 294)'}
              </div>
            </div>
          </div>
        )}

        {discipline === 'cipher' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">{ar ? 'متتالية من 5 أرقام' : '5-Term Series'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'اكتشف الفروق الحسابية أو الأنماط المتناوبة أو المتداخلة'
                  : 'Find arithmetic steps, alternating ops, or interleaved tracks'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-amber-300 font-semibold">{ar ? 'تلميح القاعدة (H)' : 'Pattern Clue (H)'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'استخدم التلميح لكشف القاعدة واستبعاد خيار خاطئ'
                  : 'Stuck? Use Hint to reveal the rule family & cut 1 decoy'}
              </div>
            </div>
          </div>
        )}

        {discipline === 'ruleswitch' && (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5">
              <div className="font-mono text-teal-400 font-semibold">{ar ? 'قاعدة تصنيف مخفية' : 'Hidden Sort Rule'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'طابق البطاقة مع 1–4 حسب الشكل أو العدد أو اللون'
                  : 'Match active card to 1–4 by Shape, Count, or Finish'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-amber-400/25">
              <div className="font-mono text-amber-300 font-semibold">{ar ? 'تحوّلات صامتة' : 'Silent Shifts'}</div>
              <div className="text-slate-300 mt-0.5">
                {ar
                  ? 'تتبدل القاعدة كل 4–5 مطابقات — تكيّف فوراً!'
                  : 'Rule rotates every 4–5 matches — adapt immediately!'}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-0.5">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>{meta.controlsHint}</span>
          </span>
        </div>

        <div className="flex gap-2.5">
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              className="h-12 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              <span>{ar ? 'القائمة' : 'Menu'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onStartStage}
            className="flex-1 h-12 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-transform cursor-pointer"
          >
            {isOverlayHelp ? (
              <>
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>{ar ? 'متابعة المرحلة' : 'Resume Stage'}</span>
              </>
            ) : (
              <>
                <span>{ar ? `ابدأ ${meta.title}` : `Begin ${meta.title}`}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
