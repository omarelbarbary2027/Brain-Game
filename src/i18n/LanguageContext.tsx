import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  DISCIPLINES,
  Difficulty,
  DisciplineId,
  ChallengeCategory,
  getCognitiveRank,
} from '../types/game';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DISCIPLINES_AR,
  Lang,
  PACE_DESCRIPTIONS_I18N,
  RANK_TEXT_AR,
} from './translations';

const LANG_STORAGE_KEY = 'mnemon_lang_v1';

interface LanguageContextValue {
  lang: Lang;
  isRtl: boolean;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  isRtl: false,
  setLang: () => {},
  toggleLang: () => {},
});

function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // Ignore storage read error
  }
  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    const isRtl = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.title =
      lang === 'ar'
        ? 'منيمون (Mnemon) — ألغاز الذاكرة والسرعة الذهنية اليومية'
        : 'Mnemon — Daily Memory & Cognitive Speed Puzzles';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage write error
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        isRtl: lang === 'ar',
        setLang,
        toggleLang,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export function getDisciplineInfo(id: DisciplineId, lang: Lang) {
  const base = DISCIPLINES[id];
  if (lang === 'en') {
    return {
      ...base,
      categoryLabel: base.category,
    };
  }
  const ar = DISCIPLINES_AR[id];
  return {
    ...base,
    ...ar,
    categoryLabel: CATEGORY_LABELS.ar[base.category],
  };
}

export function getCategoryLabel(cat: 'All' | ChallengeCategory, lang: Lang): string {
  return CATEGORY_LABELS[lang][cat];
}

export function getDifficultyLabel(diff: Difficulty, lang: Lang): string {
  return DIFFICULTY_LABELS[lang][diff];
}

export function getPaceDescription(diff: Difficulty, lang: Lang): string {
  return PACE_DESCRIPTIONS_I18N[lang][diff];
}

export function getLocalizedCognitiveRank(
  accuracy: number,
  avgReactionMs: number,
  totalScore: number,
  stageCount: number,
  lang: Lang
) {
  const rank = getCognitiveRank(accuracy, avgReactionMs, totalScore, stageCount);
  if (lang === 'en') return rank;
  const ar = RANK_TEXT_AR[rank.grade];
  return {
    grade: rank.grade,
    title: ar.title,
    summary: ar.summary,
  };
}
