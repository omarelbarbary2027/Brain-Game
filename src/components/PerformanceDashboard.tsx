import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  BarChart3,
  Globe,
  LayoutGrid,
  LogOut,
  Play,
  RotateCcw,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ALL_DISCIPLINE_IDS,
  ChallengeCategory,
  DISCIPLINES,
  Difficulty,
  DisciplineId,
  PlayerProgress,
  SessionLogEntry,
} from '../types/game';
import {
  getCategoryLabel,
  getDifficultyLabel,
  getDisciplineInfo,
  useLanguage,
} from '../i18n/LanguageContext';
import { Lang } from '../i18n/translations';
import { formatReadableDate } from '../utils/seededRandom';
import { getEffectiveStreak } from '../utils/storage';

interface PerformanceDashboardProps {
  todayKey: string;
  progress: PlayerProgress;
  activeUsername: string | null;
  onMenu: () => void;
  onPlayDaily: () => void;
  onToggleMute: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

type ModeFilter = 'all' | 'daily' | 'practice';
type CategoryFilter = 'All' | ChallengeCategory;
type DateRangeFilter = '7d' | '30d' | 'all';
type BreakdownView = 'byChallenge' | 'byModePace';

interface AggregateGroupRow {
  key: string;
  label: string;
  sublabel: string;
  count: number;
  avgScore: number;
  bestScore: number;
  avgReactionMs: number;
  avgAccuracy: number;
  disciplineId?: DisciplineId;
}

const CATEGORY_FILTERS: CategoryFilter[] = [
  'All',
  'Memory',
  'Speed',
  'Executive',
  'Pattern & IQ',
];

function parseDateKeyMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function formatShortDateTime(entry: SessionLogEntry, multiDay: boolean, lang: Lang): string {
  const dt = new Date(entry.timestamp);
  const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  if (multiDay) {
    return dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  return dt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  todayKey,
  progress,
  activeUsername,
  onMenu,
  onPlayDaily,
  onToggleMute,
  onOpenAuth,
  onSignOut,
}) => {
  const { lang, toggleLang } = useLanguage();
  const ar = lang === 'ar';

  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [disciplineFilter, setDisciplineFilter] = useState<'all' | DisciplineId>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('30d');
  const [breakdownView, setBreakdownView] = useState<BreakdownView>('byChallenge');
  const [inspectedEntry, setInspectedEntry] = useState<SessionLogEntry | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<AggregateGroupRow | null>(null);

  const trendContainerRef = useRef<HTMLDivElement | null>(null);
  const trendSvgRef = useRef<SVGSVGElement | null>(null);
  const [trendWidth, setTrendWidth] = useState(640);

  const barContainerRef = useRef<HTMLDivElement | null>(null);
  const barSvgRef = useRef<SVGSVGElement | null>(null);
  const [barWidth, setBarWidth] = useState(520);

  const modeFilters: { id: ModeFilter; label: string }[] = [
    { id: 'all', label: ar ? 'الكل' : 'All Modes' },
    { id: 'daily', label: ar ? 'التحدي اليومي' : 'Daily Trio' },
    { id: 'practice', label: ar ? 'تدريب حر' : 'Practice' },
  ];

  const rangeFilters: { id: DateRangeFilter; label: string }[] = [
    { id: '7d', label: ar ? '7 أيام' : '7 Days' },
    { id: '30d', label: ar ? '30 يوماً' : '30 Days' },
    { id: 'all', label: ar ? 'كل الفترات' : 'All Dates' },
  ];

  const streak = getEffectiveStreak(progress, todayKey);
  const totalSavedRuns = progress.sessionHistory.length;

  const filteredSessions = useMemo(() => {
    const todayMs = parseDateKeyMs(todayKey);
    const cutoffDays = dateRange === '7d' ? 6 : dateRange === '30d' ? 29 : null;

    return [...progress.sessionHistory]
      .filter((entry) => {
        if (modeFilter !== 'all' && entry.mode !== modeFilter) return false;
        if (categoryFilter !== 'All' && DISCIPLINES[entry.discipline].category !== categoryFilter) {
          return false;
        }
        if (disciplineFilter !== 'all' && entry.discipline !== disciplineFilter) {
          return false;
        }
        if (cutoffDays !== null) {
          const entryDayMs = parseDateKeyMs(entry.dateKey);
          const diffDays = (todayMs - entryDayMs) / 86_400_000;
          if (diffDays > cutoffDays) return false;
        }
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [progress.sessionHistory, modeFilter, categoryFilter, disciplineFilter, dateRange, todayKey]);

  const hasChartData = filteredSessions.length > 0;

  // Responsive ResizeObserver for both D3 charts
  useEffect(() => {
    if (!hasChartData) return;
    const observers: ResizeObserver[] = [];

    if (trendContainerRef.current) {
      const w0 = Math.floor(trendContainerRef.current.getBoundingClientRect().width);
      if (w0 > 120) setTrendWidth(w0);
      const obs = new ResizeObserver((entries) => {
        const w = Math.floor(entries[0]?.contentRect.width ?? 640);
        if (w > 120) setTrendWidth(w);
      });
      obs.observe(trendContainerRef.current);
      observers.push(obs);
    }

    if (barContainerRef.current) {
      const w0 = Math.floor(barContainerRef.current.getBoundingClientRect().width);
      if (w0 > 120) setBarWidth(w0);
      const obs = new ResizeObserver((entries) => {
        const w = Math.floor(entries[0]?.contentRect.width ?? 520);
        if (w > 120) setBarWidth(w);
      });
      obs.observe(barContainerRef.current);
      observers.push(obs);
    }

    return () => observers.forEach((o) => o.disconnect());
  }, [hasChartData]);

  const kpis = useMemo(() => {
    const count = filteredSessions.length;
    if (count === 0) {
      return {
        count: 0,
        avgScore: 0,
        bestScore: 0,
        avgReactionMs: 0,
        fastestMs: 0,
        avgAccuracy: 0,
      };
    }

    const avgScore = Math.round(
      filteredSessions.reduce((sum, s) => sum + s.score, 0) / count
    );
    const bestScore = Math.max(...filteredSessions.map((s) => s.score));
    const speedEntries = filteredSessions.filter((s) => s.avgReactionMs > 0);
    const avgReactionMs =
      speedEntries.length > 0
        ? Math.round(
            speedEntries.reduce((sum, s) => sum + s.avgReactionMs, 0) / speedEntries.length
          )
        : 0;
    const fastestMs =
      speedEntries.length > 0 ? Math.min(...speedEntries.map((s) => s.avgReactionMs)) : 0;
    const avgAccuracy = Math.round(
      filteredSessions.reduce((sum, s) => sum + s.accuracy, 0) / count
    );

    return {
      count,
      avgScore,
      bestScore,
      avgReactionMs,
      fastestMs,
      avgAccuracy,
    };
  }, [filteredSessions]);

  const breakdownRows = useMemo<AggregateGroupRow[]>(() => {
    if (filteredSessions.length === 0) return [];

    if (breakdownView === 'byChallenge') {
      const grouped = new Map<DisciplineId, SessionLogEntry[]>();
      for (const s of filteredSessions) {
        const arr = grouped.get(s.discipline) ?? [];
        arr.push(s);
        grouped.set(s.discipline, arr);
      }

      const rows: AggregateGroupRow[] = [];
      for (const id of ALL_DISCIPLINE_IDS) {
        const list = grouped.get(id);
        if (!list || list.length === 0) continue;
        const speedList = list.filter((e) => e.avgReactionMs > 0);
        const info = getDisciplineInfo(id, lang);
        rows.push({
          key: id,
          label: info.title,
          sublabel: info.categoryLabel,
          count: list.length,
          avgScore: Math.round(list.reduce((sum, e) => sum + e.score, 0) / list.length),
          bestScore: Math.max(...list.map((e) => e.score)),
          avgReactionMs:
            speedList.length > 0
              ? Math.round(
                  speedList.reduce((sum, e) => sum + e.avgReactionMs, 0) / speedList.length
                )
              : 0,
          avgAccuracy: Math.round(list.reduce((sum, e) => sum + e.accuracy, 0) / list.length),
          disciplineId: id,
        });
      }
      return rows.sort((a, b) => b.avgScore - a.avgScore);
    }

    const buckets: {
      key: string;
      label: string;
      sublabel: string;
      match: (e: SessionLogEntry) => boolean;
    }[] = [
      {
        key: 'daily',
        label: ar ? 'التحدي اليومي' : 'Daily Trio',
        sublabel: ar ? 'جولة يومية متوازنة' : 'Standard Circuit',
        match: (e) => e.mode === 'daily',
      },
      ...(['relaxed', 'standard', 'master'] as Difficulty[]).map((diff) => ({
        key: `practice-${diff}`,
        label: ar
          ? `تدريب · ${getDifficultyLabel(diff, 'ar')}`
          : `Practice · ${getDifficultyLabel(diff, 'en')}`,
        sublabel: ar ? 'تحدٍّ فردي' : 'Single Challenge',
        match: (e: SessionLogEntry) => e.mode === 'practice' && e.difficulty === diff,
      })),
    ];

    const rows: AggregateGroupRow[] = [];
    for (const bucket of buckets) {
      const list = filteredSessions.filter(bucket.match);
      if (list.length === 0) continue;
      const speedList = list.filter((e) => e.avgReactionMs > 0);
      rows.push({
        key: bucket.key,
        label: bucket.label,
        sublabel: bucket.sublabel,
        count: list.length,
        avgScore: Math.round(list.reduce((sum, e) => sum + e.score, 0) / list.length),
        bestScore: Math.max(...list.map((e) => e.score)),
        avgReactionMs:
          speedList.length > 0
            ? Math.round(
                speedList.reduce((sum, e) => sum + e.avgReactionMs, 0) / speedList.length
              )
            : 0,
        avgAccuracy: Math.round(list.reduce((sum, e) => sum + e.accuracy, 0) / list.length),
      });
    }
    return rows;
  }, [filteredSessions, breakdownView, lang, ar]);

  const activeInspection = inspectedEntry ?? filteredSessions[filteredSessions.length - 1] ?? null;

  // D3 Chart 1: Dual Synchronized Score & Reaction Time Trend Across Dates
  useEffect(() => {
    const svgEl = trendSvgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (filteredSessions.length === 0) return;

    const width = Math.max(280, trendWidth);
    const height = 316;
    const margin = { top: 18, right: 16, bottom: 28, left: 48 };
    const innerW = width - margin.left - margin.right;

    const upperTop = margin.top;
    const upperHeight = 112;
    const gapBetween = 34;
    const lowerTop = upperTop + upperHeight + gapBetween;
    const lowerHeight = 108;

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const defs = svg.append('defs');
    const scoreGrad = defs
      .append('linearGradient')
      .attr('id', 'mnemon-score-area')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    scoreGrad.append('stop').attr('offset', '0%').attr('stop-color', '#FBBF24').attr('stop-opacity', 0.28);
    scoreGrad.append('stop').attr('offset', '100%').attr('stop-color', '#FBBF24').attr('stop-opacity', 0.01);

    const reactGrad = defs
      .append('linearGradient')
      .attr('id', 'mnemon-react-area')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    reactGrad.append('stop').attr('offset', '0%').attr('stop-color', '#2DD4BF').attr('stop-opacity', 0.24);
    reactGrad.append('stop').attr('offset', '100%').attr('stop-color', '#2DD4BF').attr('stop-opacity', 0.01);

    const g = svg.append('g');

    const times = filteredSessions.map((d) => d.timestamp);
    const minT = d3.min(times) ?? Date.now();
    const maxT = d3.max(times) ?? Date.now();
    const span = maxT - minT;
    const padMs = span > 0 ? span * 0.06 : 3_600_000;
    const xScale = d3
      .scaleTime()
      .domain([new Date(minT - padMs), new Date(maxT + padMs)])
      .range([margin.left, margin.left + innerW]);

    const distinctDays = new Set(filteredSessions.map((d) => d.dateKey)).size;
    const tickCount = width < 440 ? 4 : 6;
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(tickCount)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat((dt) => {
        if (distinctDays > 1) {
          return dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        }
        return d3.timeFormat('%H:%M')(dt);
      });

    const maxScore = d3.max(filteredSessions, (d) => d.score) ?? 1000;
    const scoreY = d3
      .scaleLinear()
      .domain([0, Math.max(400, Math.ceil((maxScore * 1.15) / 100) * 100)])
      .nice()
      .range([upperTop + upperHeight, upperTop]);

    const validMs = filteredSessions.filter((d) => d.avgReactionMs > 0);
    const maxReact = d3.max(validMs, (d) => d.avgReactionMs) ?? 1200;
    const reactY = d3
      .scaleLinear()
      .domain([0, Math.max(600, Math.ceil((maxReact * 1.18) / 100) * 100)])
      .nice()
      .range([lowerTop + lowerHeight, lowerTop]);

    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(scoreY)
          .ticks(3)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((sel) => sel.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.07)')
      .attr('stroke-dasharray', '3,3');

    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(scoreY)
          .ticks(3)
          .tickSize(0)
          .tickPadding(6)
          .tickFormat((v) => `${Number(v)}`)
      )
      .call((sel) => sel.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#94A3B8')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px');

    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(reactY)
          .ticks(3)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((sel) => sel.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.07)')
      .attr('stroke-dasharray', '3,3');

    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(reactY)
          .ticks(3)
          .tickSize(0)
          .tickPadding(6)
          .tickFormat((v) => `${Number(v)}ms`)
      )
      .call((sel) => sel.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#94A3B8')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px');

    g.append('text')
      .attr('x', margin.left)
      .attr('y', upperTop - 5)
      .attr('fill', '#FBBF24')
      .attr('font-family', 'Cairo, Plus Jakarta Sans, sans-serif')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(ar ? 'النقاط' : 'Score (pts)');

    g.append('text')
      .attr('x', margin.left)
      .attr('y', lowerTop - 7)
      .attr('fill', '#2DD4BF')
      .attr('font-family', 'Cairo, Plus Jakarta Sans, sans-serif')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(ar ? 'زمن الاستجابة (ms · الأقل أسرع)' : 'Reaction Time (ms · lower is faster)');

    g.append('g')
      .attr('transform', `translate(0,${lowerTop + lowerHeight})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').attr('stroke', 'rgba(255,255,255,0.12)'))
      .selectAll('text')
      .attr('fill', '#94A3B8')
      .attr('font-family', 'Cairo, JetBrains Mono, monospace')
      .attr('font-size', '10px');

    if (filteredSessions.length > 1) {
      const scoreArea = d3
        .area<SessionLogEntry>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y0(upperTop + upperHeight)
        .y1((d) => scoreY(d.score))
        .curve(d3.curveMonotoneX);

      const scoreLine = d3
        .line<SessionLogEntry>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => scoreY(d.score))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(filteredSessions)
        .attr('fill', 'url(#mnemon-score-area)')
        .attr('d', scoreArea);

      g.append('path')
        .datum(filteredSessions)
        .attr('fill', 'none')
        .attr('stroke', '#FBBF24')
        .attr('stroke-width', 2.2)
        .attr('d', scoreLine);
    }

    if (validMs.length > 1) {
      const reactArea = d3
        .area<SessionLogEntry>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y0(lowerTop + lowerHeight)
        .y1((d) => reactY(d.avgReactionMs))
        .curve(d3.curveMonotoneX);

      const reactLine = d3
        .line<SessionLogEntry>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => reactY(d.avgReactionMs))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(validMs)
        .attr('fill', 'url(#mnemon-react-area)')
        .attr('d', reactArea);

      g.append('path')
        .datum(validMs)
        .attr('fill', 'none')
        .attr('stroke', '#2DD4BF')
        .attr('stroke-width', 2.2)
        .attr('d', reactLine);
    }

    if (kpis.avgReactionMs > 0) {
      g.append('line')
        .attr('x1', margin.left)
        .attr('x2', margin.left + innerW)
        .attr('y1', reactY(kpis.avgReactionMs))
        .attr('y2', reactY(kpis.avgReactionMs))
        .attr('stroke', 'rgba(45, 212, 191, 0.35)')
        .attr('stroke-dasharray', '4,4');
    }

    const crosshair = g
      .append('line')
      .attr('y1', upperTop)
      .attr('y2', lowerTop + lowerHeight)
      .attr('stroke', 'rgba(248, 250, 252, 0.35)')
      .attr('stroke-width', 1)
      .style('opacity', 0);

    g.selectAll('.score-dot')
      .data(filteredSessions)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(new Date(d.timestamp)))
      .attr('cy', (d) => scoreY(d.score))
      .attr('r', (d) => (activeInspection?.id === d.id ? 5.5 : 3.5))
      .attr('fill', (d) => (d.mode === 'daily' ? '#FBBF24' : '#F8FAFC'))
      .attr('stroke', '#0B111E')
      .attr('stroke-width', 1.5);

    g.selectAll('.react-dot')
      .data(validMs)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(new Date(d.timestamp)))
      .attr('cy', (d) => reactY(d.avgReactionMs))
      .attr('r', (d) => (activeInspection?.id === d.id ? 5.5 : 3.5))
      .attr('fill', (d) => (d.mode === 'daily' ? '#2DD4BF' : '#99F6E4'))
      .attr('stroke', '#0B111E')
      .attr('stroke-width', 1.5);

    const bisect = d3.bisector<SessionLogEntry, number>((d) => d.timestamp).center;

    g.append('rect')
      .attr('x', margin.left)
      .attr('y', upperTop)
      .attr('width', Math.max(10, innerW))
      .attr('height', lowerTop + lowerHeight - upperTop)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('pointermove pointerdown', (event: PointerEvent) => {
        const [px] = d3.pointer(event);
        const hoveredTs = xScale.invert(px).getTime();
        const nearestIdx = bisect(filteredSessions, hoveredTs);
        const entry = filteredSessions[Math.min(filteredSessions.length - 1, Math.max(0, nearestIdx))];
        if (!entry) return;
        const cx = xScale(new Date(entry.timestamp));
        crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
        setInspectedEntry(entry);
      })
      .on('pointerleave', () => {
        crosshair.style('opacity', 0);
      });
  }, [filteredSessions, trendWidth, kpis.avgReactionMs, activeInspection?.id, lang, ar]);

  // D3 Chart 2: Grouped Horizontal Comparison Across Modes or Challenges
  useEffect(() => {
    const svgEl = barSvgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (breakdownRows.length === 0) return;

    const width = Math.max(260, barWidth);
    const rowHeight = 46;
    const margin = { top: 22, right: 54, bottom: 20, left: width < 400 ? 112 : 140 };
    const height = margin.top + margin.bottom + breakdownRows.length * rowHeight;
    const innerW = Math.max(80, width - margin.left - margin.right);

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g');

    const yScale = d3
      .scaleBand<string>()
      .domain(breakdownRows.map((r) => r.key))
      .range([margin.top, height - margin.bottom])
      .padding(0.28);

    const maxAvgScore = d3.max(breakdownRows, (r) => r.avgScore) ?? 1000;
    const scoreScale = d3
      .scaleLinear()
      .domain([0, Math.max(300, maxAvgScore * 1.12)])
      .range([0, innerW]);

    const maxAvgReact = d3.max(breakdownRows, (r) => r.avgReactionMs) ?? 1200;
    const reactScale = d3
      .scaleLinear()
      .domain([0, Math.max(500, maxAvgReact * 1.15)])
      .range([0, innerW]);

    g.append('rect')
      .attr('x', margin.left)
      .attr('y', 4)
      .attr('width', 10)
      .attr('height', 6)
      .attr('rx', 2)
      .attr('fill', '#FBBF24');
    g.append('text')
      .attr('x', margin.left + 15)
      .attr('y', 10)
      .attr('fill', '#CBD5E1')
      .attr('font-family', 'Cairo, Plus Jakarta Sans, sans-serif')
      .attr('font-size', '10px')
      .text(ar ? 'متوسط النقاط' : 'Avg Score');

    const speedLegendX = ar ? margin.left + 96 : margin.left + 84;
    g.append('rect')
      .attr('x', speedLegendX)
      .attr('y', 4)
      .attr('width', 10)
      .attr('height', 6)
      .attr('rx', 2)
      .attr('fill', '#2DD4BF');
    g.append('text')
      .attr('x', speedLegendX + 15)
      .attr('y', 10)
      .attr('fill', '#CBD5E1')
      .attr('font-family', 'Cairo, Plus Jakarta Sans, sans-serif')
      .attr('font-size', '10px')
      .text(ar ? 'متوسط السرعة (ms)' : 'Avg Speed (ms)');

    const barGroups = g
      .selectAll('.agg-row')
      .data(breakdownRows)
      .enter()
      .append('g')
      .attr('class', 'agg-row')
      .style('cursor', (d) => (d.disciplineId ? 'pointer' : 'default'))
      .on('pointerenter', (_evt, d) => setHoveredGroup(d))
      .on('pointerleave', () => setHoveredGroup(null))
      .on('click', (_evt, d) => {
        if (!d.disciplineId) return;
        setDisciplineFilter((curr) => (curr === d.disciplineId ? 'all' : d.disciplineId!));
      });

    barGroups
      .append('text')
      .attr('x', margin.left - 10)
      .attr('y', (d) => (yScale(d.key) ?? 0) + yScale.bandwidth() * 0.44)
      .attr('text-anchor', 'end')
      .attr('fill', (d) =>
        d.disciplineId && disciplineFilter === d.disciplineId ? '#FBBF24' : '#F1F5F9'
      )
      .attr('font-family', 'Cairo, Plus Jakarta Sans, sans-serif')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((d) => (d.label.length > 18 ? `${d.label.slice(0, 17)}…` : d.label));

    barGroups
      .append('text')
      .attr('x', margin.left - 10)
      .attr('y', (d) => (yScale(d.key) ?? 0) + yScale.bandwidth() * 0.86)
      .attr('text-anchor', 'end')
      .attr('fill', '#94A3B8')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '9.5px')
      .text((d) => `${d.count}× · ${d.avgAccuracy}%`);

    const subH = Math.max(7, Math.floor((yScale.bandwidth() - 4) / 2));

    barGroups
      .append('rect')
      .attr('x', margin.left)
      .attr('y', (d) => yScale(d.key) ?? 0)
      .attr('width', innerW)
      .attr('height', subH)
      .attr('rx', 3)
      .attr('fill', 'rgba(255,255,255,0.04)');

    barGroups
      .append('rect')
      .attr('x', margin.left)
      .attr('y', (d) => yScale(d.key) ?? 0)
      .attr('width', (d) => Math.max(4, scoreScale(d.avgScore)))
      .attr('height', subH)
      .attr('rx', 3)
      .attr('fill', '#FBBF24');

    barGroups
      .append('text')
      .attr('x', (d) => margin.left + Math.max(4, scoreScale(d.avgScore)) + 6)
      .attr('y', (d) => (yScale(d.key) ?? 0) + subH - 1)
      .attr('fill', '#FDE68A')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px')
      .text((d) => `${d.avgScore}`);

    barGroups
      .append('rect')
      .attr('x', margin.left)
      .attr('y', (d) => (yScale(d.key) ?? 0) + subH + 4)
      .attr('width', innerW)
      .attr('height', subH)
      .attr('rx', 3)
      .attr('fill', 'rgba(255,255,255,0.04)');

    barGroups
      .append('rect')
      .attr('x', margin.left)
      .attr('y', (d) => (yScale(d.key) ?? 0) + subH + 4)
      .attr('width', (d) => (d.avgReactionMs > 0 ? Math.max(4, reactScale(d.avgReactionMs)) : 0))
      .attr('height', subH)
      .attr('rx', 3)
      .attr('fill', '#2DD4BF');

    barGroups
      .append('text')
      .attr(
        'x',
        (d) =>
          margin.left +
          (d.avgReactionMs > 0 ? Math.max(4, reactScale(d.avgReactionMs)) : 0) +
          6
      )
      .attr('y', (d) => (yScale(d.key) ?? 0) + subH * 2 + 3)
      .attr('fill', '#99F6E4')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px')
      .text((d) => (d.avgReactionMs > 0 ? `${d.avgReactionMs}ms` : '—'));
  }, [breakdownRows, barWidth, disciplineFilter, ar]);

  const resetAllFilters = () => {
    setModeFilter('all');
    setCategoryFilter('All');
    setDisciplineFilter('all');
    setDateRange('all');
  };

  return (
    <div className="relative w-full h-full bg-[#0B111E] text-slate-100 flex flex-col overflow-hidden">
      {/* Persistent Top Bar with Menu Button */}
      <header className="relative z-20 w-full flex items-center justify-between gap-3 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/10 bg-[#0B111E]/95 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenu}
            aria-label={ar ? 'العودة إلى القائمة الرئيسية' : 'Return to main menu'}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-100 border border-white/15 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>{ar ? 'القائمة' : 'Menu'}</span>
          </button>

          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">
              {ar ? 'لوحة تحليل الأداء' : 'Performance Dashboard'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={ar ? 'Switch language to English' : 'التبديل إلى العربية'}
            className="inline-flex items-center justify-center gap-1 min-w-[38px] min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-100 border border-white/10 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden="true" />
            <span>{ar ? 'EN' : 'عربي'}</span>
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
            className="inline-flex items-center justify-center min-w-[38px] min-h-[38px] p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors cursor-pointer"
          >
            {progress.muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onPlayDaily}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>{ar ? 'ابدأ اليومي' : 'Play Daily'}</span>
          </button>
        </div>
      </header>

      {/* Scrollable Dashboard Workspace */}
      <div className="flex-1 w-full overflow-y-auto overscroll-contain clean-scroll">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-5">
          {/* Sub-header Context + Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 text-teal-300 font-semibold">
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {activeUsername
                    ? activeUsername
                    : ar
                    ? 'زائر (محلي على الجهاز)'
                    : 'Guest (Local Browser)'}
                </span>
              </span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="text-amber-300 hover:text-amber-200 underline underline-offset-2 cursor-pointer"
              >
                {activeUsername ? (ar ? 'تبديل الحساب' : 'Switch User') : ar ? 'دخول' : 'Sign In'}
              </button>
              {activeUsername && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-300 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" aria-hidden="true" />
                  <span>{ar ? 'خروج' : 'Sign Out'}</span>
                </button>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {ar ? `${totalSavedRuns} جولة محفوظة` : `${totalSavedRuns} total runs stored`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-amber-300">
                {ar
                  ? `تتابع ${streak} ${streak === 1 ? 'يوم' : 'أيام'}`
                  : `Streak ${streak} ${streak === 1 ? 'day' : 'days'}`}
              </span>
            </div>

            {/* Interactive Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-white/10">
                {modeFilters.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModeFilter(m.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      modeFilter === m.id
                        ? 'bg-slate-100 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-white/10">
                {rangeFilters.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setDateRange(r.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      dateRange === r.id
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Category + Game Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 overflow-x-auto clean-scroll">
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    if (
                      cat !== 'All' &&
                      disciplineFilter !== 'all' &&
                      DISCIPLINES[disciplineFilter].category !== cat
                    ) {
                      setDisciplineFilter('all');
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-teal-400 text-slate-950 font-semibold'
                      : 'bg-slate-900 border border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {getCategoryLabel(cat, lang)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ms-auto">
              <label htmlFor="dash-game-select" className="text-xs text-slate-400">
                {ar ? 'التحدي' : 'Challenge'}
              </label>
              <select
                id="dash-game-select"
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value as 'all' | DisciplineId)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer"
              >
                <option value="all">{ar ? 'جميع التحديات العشرة' : 'All 10 Challenges'}</option>
                {ALL_DISCIPLINE_IDS.map((id) => {
                  const info = getDisciplineInfo(id, lang);
                  return (
                    <option key={id} value={id}>
                      {info.title} ({info.categoryLabel})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {totalSavedRuns === 0 ? (
            <div className="rounded-xl bg-[#131C2E] border border-white/10 p-8 sm:p-12 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-amber-400" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h2 className="font-display text-xl font-bold text-white">
                  {ar ? 'لا توجد جلسات مسجّلة بعد' : 'No Sessions Recorded Yet'}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {ar
                    ? 'أكمل أول مرحلة من التحدي اليومي أو أي جولة تدريب حر لرسم منحنيات النقاط وسرعة الاستجابة بدقة.'
                    : 'Complete your first Daily Trio stage or Practice challenge to plot real D3 score and reaction-time trends across modes and dates.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onPlayDaily}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>{ar ? 'ابدأ التحدي اليومي' : 'Start Daily Trio'}</span>
                </button>
                <button
                  type="button"
                  onClick={onMenu}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 font-medium text-sm transition-colors cursor-pointer"
                >
                  <span>{ar ? 'تصفّح التحديات العشرة' : 'Browse All 10 Games'}</span>
                </button>
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="rounded-xl bg-[#131C2E] border border-white/10 p-8 text-center space-y-3">
              <h2 className="font-display text-lg font-bold text-white">
                {ar ? 'لا توجد جلسات مطابقة' : 'No Matching Sessions'}
              </h2>
              <p className="text-sm text-slate-300">
                {ar
                  ? 'جرّب توسيع خيارات الوضع أو الفئة أو النطاق الزمني.'
                  : 'Try broadening your mode, category, or date range filters.'}
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{ar ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* 4-Column Single-Elevation KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-[#131C2E] border border-white/10">
                  <div className="text-xs text-slate-400">
                    {ar ? 'الجلسات المطابقة' : 'Sessions Matched'}
                  </div>
                  <div className="text-2xl font-mono font-bold tabular-nums text-white mt-1">
                    {kpis.count}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {ar
                      ? `خلال ${new Set(filteredSessions.map((s) => s.dateKey)).size} ${
                          new Set(filteredSessions.map((s) => s.dateKey)).size === 1 ? 'يوم' : 'أيام'
                        }`
                      : `${new Set(filteredSessions.map((s) => s.dateKey)).size} active ${
                          new Set(filteredSessions.map((s) => s.dateKey)).size === 1
                            ? 'date'
                            : 'dates'
                        }`}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#131C2E] border border-white/10">
                  <div className="text-xs text-slate-400">
                    {ar ? 'متوسط النقاط' : 'Average Score'}
                  </div>
                  <div className="text-2xl font-mono font-bold tabular-nums text-amber-300 mt-1">
                    {kpis.avgScore.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                    {ar
                      ? `الأعلى ${kpis.bestScore.toLocaleString()} نقطة`
                      : `Peak ${kpis.bestScore.toLocaleString()} pts`}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#131C2E] border border-white/10">
                  <div className="text-xs text-slate-400">
                    {ar ? 'متوسط زمن الاستجابة' : 'Avg Reaction Time'}
                  </div>
                  <div
                    dir="ltr"
                    className="text-2xl font-mono font-bold tabular-nums text-teal-300 mt-1 text-start"
                  >
                    {kpis.avgReactionMs > 0 ? `${kpis.avgReactionMs} ms` : '—'}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                    {kpis.fastestMs > 0
                      ? ar
                        ? `الأسرع ${kpis.fastestMs} ms`
                        : `Fastest ${kpis.fastestMs} ms`
                      : ar
                      ? 'لا توجد قياسات سرعة'
                      : 'No speed samples'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#131C2E] border border-white/10">
                  <div className="text-xs text-slate-400">
                    {ar ? 'متوسط الدقة' : 'Mean Accuracy'}
                  </div>
                  <div className="text-2xl font-mono font-bold tabular-nums text-emerald-400 mt-1">
                    {kpis.avgAccuracy}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {ar
                      ? `أطول تتابع ${progress.bestStreak} ${progress.bestStreak === 1 ? 'يوم' : 'أيام'}`
                      : `Best Streak ${progress.bestStreak}d`}
                  </div>
                </div>
              </div>

              {/* 2-Column D3 Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Primary D3 Time-Series Dual Chart */}
                <section className="lg:col-span-7 p-4 sm:p-5 rounded-xl bg-[#131C2E] border border-white/10 flex flex-col justify-between space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-bold text-white">
                        {ar ? 'منحنى النقاط وسرعة الاستجابة' : 'Score & Reaction Trends'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {ar
                          ? 'تطوّر الأداء عبر الأيام · مرّر أو اضغط أي نقطة لمعاينة التفاصيل'
                          : 'Synchronized progression across dates · Hover or tap points to inspect'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        <span>{ar ? 'يومي' : 'Daily'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-100 inline-block" />
                        <span>{ar ? 'تدريب' : 'Practice'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Inspected Point Readout */}
                  {activeInspection && (
                    <div className="px-3 py-2 rounded-lg bg-slate-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                        <span className="font-semibold text-white">
                          {getDisciplineInfo(activeInspection.discipline, lang).title}
                        </span>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className="text-slate-300">
                          {activeInspection.mode === 'daily'
                            ? ar
                              ? 'التحدي اليومي'
                              : 'Daily Trio'
                            : ar
                            ? `تدريب (${getDifficultyLabel(activeInspection.difficulty, 'ar')})`
                            : `Practice (${getDifficultyLabel(activeInspection.difficulty, 'en')})`}
                        </span>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className="text-slate-400 font-mono">
                          {formatShortDateTime(
                            activeInspection,
                            new Set(filteredSessions.map((s) => s.dateKey)).size > 1,
                            lang
                          )}
                        </span>
                      </div>
                      <div dir="ltr" className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                        <span className="text-amber-300 font-semibold">
                          {activeInspection.score.toLocaleString()} {ar ? 'نقطة' : 'pts'}
                        </span>
                        <span className="text-teal-300 font-semibold">
                          {activeInspection.avgReactionMs > 0
                            ? `${activeInspection.avgReactionMs} ms`
                            : '—'}
                        </span>
                        <span className="text-emerald-400">{activeInspection.accuracy}%</span>
                      </div>
                    </div>
                  )}

                  <div ref={trendContainerRef} dir="ltr" className="w-full overflow-hidden">
                    <svg ref={trendSvgRef} className="w-full block" />
                  </div>
                </section>

                {/* Secondary D3 Mode & Challenge Comparison Chart */}
                <section className="lg:col-span-5 p-4 sm:p-5 rounded-xl bg-[#131C2E] border border-white/10 flex flex-col space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-bold text-white">
                        {ar ? 'تفصيل الأداء' : 'Mode & Game Breakdown'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {breakdownView === 'byChallenge'
                          ? ar
                            ? 'اضغط أي شريط تحدٍّ لتصفية البيانات'
                            : 'Click any challenge bar to filter'
                          : ar
                          ? 'مقارنة التحدي اليومي بمستويات التدريب الحر'
                          : 'Comparing Daily vs Practice difficulty tiers'}
                      </p>
                    </div>

                    <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-white/10">
                      <button
                        type="button"
                        onClick={() => setBreakdownView('byChallenge')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          breakdownView === 'byChallenge'
                            ? 'bg-slate-100 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {ar ? 'حسب التحدي' : 'By Game'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBreakdownView('byModePace')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          breakdownView === 'byModePace'
                            ? 'bg-slate-100 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {ar ? 'حسب الوضع' : 'By Mode'}
                      </button>
                    </div>
                  </div>

                  {hoveredGroup && (
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="font-sans font-semibold text-white truncate">
                        {hoveredGroup.label}
                      </span>
                      <span dir="ltr" className="text-slate-300 shrink-0">
                        {ar
                          ? `الأعلى ${hoveredGroup.bestScore} · ${hoveredGroup.avgReactionMs} ms`
                          : `Best ${hoveredGroup.bestScore} · ${hoveredGroup.avgReactionMs} ms`}
                      </span>
                    </div>
                  )}

                  <div
                    ref={barContainerRef}
                    dir="ltr"
                    className="w-full flex-1 overflow-y-auto clean-scroll max-h-[320px]"
                  >
                    <svg ref={barSvgRef} className="w-full block" />
                  </div>
                </section>
              </div>

              {/* Recent Sessions Ledger */}
              <section className="rounded-xl bg-[#131C2E] border border-white/10 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between">
                  <h2 className="font-display text-sm sm:text-base font-bold text-white">
                    {ar ? 'أحدث الجلسات' : 'Recent Sessions'}
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {ar
                      ? `عرض آخر ${Math.min(20, filteredSessions.length)} من أصل ${filteredSessions.length}`
                      : `Showing latest ${Math.min(20, filteredSessions.length)} of ${filteredSessions.length}`}
                  </span>
                </div>

                <div className="overflow-x-auto clean-scroll">
                  <table className="w-full text-start border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] text-slate-400">
                        <th className="py-2.5 px-4 font-medium text-start">
                          {ar ? 'التاريخ' : 'Date'}
                        </th>
                        <th className="py-2.5 px-3 font-medium text-start">
                          {ar ? 'التحدي' : 'Challenge'}
                        </th>
                        <th className="py-2.5 px-3 font-medium text-start">
                          {ar ? 'الوضع' : 'Mode'}
                        </th>
                        <th className="py-2.5 px-3 font-medium text-end">
                          {ar ? 'النقاط' : 'Score'}
                        </th>
                        <th className="py-2.5 px-3 font-medium text-end">
                          {ar ? 'الاستجابة' : 'Reaction'}
                        </th>
                        <th className="py-2.5 px-4 font-medium text-end">
                          {ar ? 'الدقة' : 'Accuracy'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[...filteredSessions]
                        .reverse()
                        .slice(0, 20)
                        .map((entry) => (
                          <tr
                            key={entry.id}
                            onMouseEnter={() => setInspectedEntry(entry)}
                            className="hover:bg-slate-800/50 transition-colors"
                          >
                            <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap font-mono text-xs text-start">
                              {formatReadableDate(entry.dateKey, lang)}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-white whitespace-nowrap text-start">
                              {getDisciplineInfo(entry.discipline, lang).title}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap text-xs text-start">
                              {entry.mode === 'daily'
                                ? ar
                                  ? 'التحدي اليومي'
                                  : 'Daily Trio'
                                : ar
                                ? `تدريب · ${getDifficultyLabel(entry.difficulty, 'ar')}`
                                : `Practice · ${getDifficultyLabel(entry.difficulty, 'en')}`}
                            </td>
                            <td className="py-2.5 px-3 text-end font-mono tabular-nums font-semibold text-amber-300 whitespace-nowrap">
                              {entry.score.toLocaleString()}
                            </td>
                            <td
                              dir="ltr"
                              className="py-2.5 px-3 text-end font-mono tabular-nums text-teal-300 whitespace-nowrap"
                            >
                              {entry.avgReactionMs > 0 ? `${entry.avgReactionMs} ms` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-end font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                              {entry.accuracy}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
