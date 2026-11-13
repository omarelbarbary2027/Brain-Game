import { Brain, Compass, Grid3x3, LucideIcon, Zap } from 'lucide-react';
import { ChallengeCategory } from '../types/game';

export interface CategoryVisualTheme {
  Icon: LucideIcon;
  textClass: string;
  accentBgClass: string;
  borderClass: string;
  activeCardClass: string;
}

export const CATEGORY_THEMES: Record<ChallengeCategory, CategoryVisualTheme> = {
  Memory: {
    Icon: Brain,
    textClass: 'text-sky-300',
    accentBgClass: 'bg-sky-400/15',
    borderClass: 'border-sky-400/45',
    activeCardClass: 'bg-sky-400/15 border-sky-300/80 text-white',
  },
  Speed: {
    Icon: Zap,
    textClass: 'text-amber-300',
    accentBgClass: 'bg-amber-400/15',
    borderClass: 'border-amber-400/45',
    activeCardClass: 'bg-amber-400/15 border-amber-300/80 text-white',
  },
  Executive: {
    Icon: Compass,
    textClass: 'text-teal-300',
    accentBgClass: 'bg-teal-400/15',
    borderClass: 'border-teal-400/45',
    activeCardClass: 'bg-teal-400/15 border-teal-300/80 text-white',
  },
  'Pattern & IQ': {
    Icon: Grid3x3,
    textClass: 'text-emerald-300',
    accentBgClass: 'bg-emerald-400/15',
    borderClass: 'border-emerald-400/45',
    activeCardClass: 'bg-emerald-400/15 border-emerald-300/80 text-white',
  },
};
