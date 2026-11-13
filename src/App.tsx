import { useCallback, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  Difficulty,
  DisciplineId,
  GameMode,
  GameState,
  PlayerProgress,
  StageResult,
  getDailyStageOrder,
} from './types/game';
import { getDisciplineInfo, useLanguage } from './i18n/LanguageContext';
import { auth } from './firebase';
import { getDailyNumber, getLocalDateKey } from './utils/seededRandom';
import { sound } from './utils/sound';
import {
  buildDailyCompletionUpdate,
  buildPracticeCompletionUpdate,
  getEffectiveStreak,
  loadProgress,
  saveProgress,
} from './utils/storage';
import {
  deriveDisplayUsername,
  ensureUserProfile,
  signOutUser,
  subscribeUserProgress,
  syncDailyCompletion,
  syncMutePreference,
  syncPracticeCompletion,
} from './services/userProgressService';
import { TitleScreen } from './components/TitleScreen';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { HudBar } from './components/HudBar';
import { StageBriefing } from './components/StageBriefing';
import { AuthModal } from './components/AuthModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  PauseModal,
  RoundSummaryModal,
  VictoryModal,
} from './components/GameModals';
import {
  LiveStageHud,
  PatternEchoStage,
} from './components/stages/PatternEchoStage';
import { TempoMatchStage } from './components/stages/TempoMatchStage';
import { SequenceTrailStage } from './components/stages/SequenceTrailStage';
import { StroopReflexStage } from './components/stages/StroopReflexStage';
import { DualPairsStage } from './components/stages/DualPairsStage';
import { MentalPulseStage } from './components/stages/MentalPulseStage';
import { MatrixLogicStage } from './components/stages/MatrixLogicStage';
import { DigitSpanStage } from './components/stages/DigitSpanStage';
import { CipherSequenceStage } from './components/stages/CipherSequenceStage';
import { RuleSwitchStage } from './components/stages/RuleSwitchStage';

const INITIAL_HUD: LiveStageHud = {
  score: 0,
  streak: 0,
  lastReactionMs: null,
  round: 1,
  totalRounds: 4,
};

export default function App() {
  const { lang } = useLanguage();
  const [todayKey] = useState<string>(() => getLocalDateKey());
  const dailyNumber = getDailyNumber(todayKey);
  const dailyStageOrder = useMemo(() => getDailyStageOrder(todayKey), [todayKey]);

  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  const [progress, setProgress] = useState<PlayerProgress>(() => {
    const loaded = loadProgress('guest');
    sound.setMuted(loaded.muted);
    return loaded;
  });

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [selectedMode, setSelectedMode] = useState<GameMode>('daily');
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty>('standard');

  const [stageIndex, setStageIndex] = useState(0);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [newBestDisciplines, setNewBestDisciplines] = useState<Set<string>>(() => new Set());
  const [lastPrevBestScore, setLastPrevBestScore] = useState<number>(0);
  const [runSeed, setRunSeed] = useState<string>(todayKey);
  const [runKey, setRunKey] = useState<number>(1);
  const [hud, setHud] = useState<LiveStageHud>(INITIAL_HUD);
  const [showRulesHelp, setShowRulesHelp] = useState(false);

  // Firebase Auth listener + strictly isolated per-user progress subscription
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      setAuthUser(user);

      if (!user) {
        setActiveUsername(null);
        const guestProgress = loadProgress('guest');
        sound.setMuted(guestProgress.muted);
        setProgress(guestProgress);
        setAuthReady(true);
        return;
      }

      const derivedName = deriveDisplayUsername(user);
      setActiveUsername(derivedName);

      // Immediately swap to user-scoped local cache so previous user's stats never leak
      const cachedUserProgress = loadProgress(user.uid);
      sound.setMuted(cachedUserProgress.muted);
      setProgress(cachedUserProgress);
      setAuthReady(true);

      try {
        await ensureUserProfile(user, derivedName);
      } catch (err) {
        console.error('Profile initialization error:', err);
      }

      if (cancelled || auth.currentUser?.uid !== user.uid) return;

      unsubFirestore = subscribeUserProgress(
        user.uid,
        (syncedProgress, profileUsername) => {
          sound.setMuted(syncedProgress.muted);
          setProgress(syncedProgress);
          setActiveUsername(profileUsername);
        },
        (errMessage) => {
          console.error('Firestore sync warning:', errMessage);
        }
      );
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const scopeKey = authUser?.uid ?? 'guest';

  const stageQueue: DisciplineId[] =
    selectedMode === 'daily' ? dailyStageOrder : [selectedMode];
  const currentDiscipline = stageQueue[stageIndex] ?? 'pattern';
  const activeDifficulty: Difficulty =
    selectedMode === 'daily' ? 'standard' : selectedDifficulty;

  const handleOpenAuth = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutUser();
      setStageResults([]);
      setGameState((curr) => (curr === 'GAME_OVER' ? 'TITLE_MENU' : curr));
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setProgress((prev) => {
      const nextMuted = !prev.muted;
      sound.setMuted(nextMuted);
      const updated = { ...prev, muted: nextMuted };
      saveProgress(updated, scopeKey);
      if (authUser) {
        void syncMutePreference(authUser.uid, nextMuted).catch((err) => {
          console.error('Mute sync failed:', err);
        });
      }
      return updated;
    });
  }, [authUser, scopeKey]);

  const startRunForMode = useCallback(
    (mode: GameMode) => {
      const seed =
        mode === 'daily'
          ? `daily:${todayKey}`
          : `practice:${mode}:${Date.now()}`;
      setSelectedMode(mode);
      setRunSeed(seed);
      setStageIndex(0);
      setStageResults([]);
      setNewBestDisciplines(new Set());
      setLastPrevBestScore(0);
      setHud(INITIAL_HUD);
      setShowRulesHelp(false);
      setRunKey((k) => k + 1);
      setGameState('STAGE_BRIEFING');
      sound.playTick();
    },
    [todayKey]
  );

  const startNewRun = useCallback(() => {
    startRunForMode(selectedMode);
  }, [startRunForMode, selectedMode]);

  const handleBeginStageFromBriefing = useCallback(() => {
    setGameState('PLAYING');
    sound.playTick();
  }, []);

  const handleViewTodayResult = useCallback(() => {
    const record = progress.dailyRecords[todayKey];
    if (!record) return;
    setSelectedMode('daily');
    setStageResults(record.stages);
    setGameState('GAME_OVER');
  }, [progress.dailyRecords, todayKey]);

  const handleStageComplete = useCallback(
    (result: StageResult) => {
      const prevBest = progress.personalBests[result.discipline]?.bestScore ?? 0;
      setLastPrevBestScore(prevBest);
      if (result.score > 0 && result.score > prevBest) {
        setNewBestDisciplines((prev) => {
          const next = new Set(prev);
          next.add(result.discipline);
          return next;
        });
      }

      const nextResults = [...stageResults, result];
      setStageResults(nextResults);

      if (stageIndex + 1 < stageQueue.length) {
        setGameState('ROUND_SUMMARY');
      } else {
        if (selectedMode === 'daily') {
          const totalScore = nextResults.reduce((sum, s) => sum + s.score, 0);
          const validSpeeds = nextResults.filter((s) => s.avgReactionMs > 0);
          const avgReactionMs =
            validSpeeds.length > 0
              ? Math.round(
                  validSpeeds.reduce((sum, s) => sum + s.avgReactionMs, 0) /
                    validSpeeds.length
                )
              : 0;
          const overallAccuracy = Math.round(
            nextResults.reduce((sum, s) => sum + s.accuracy, 0) /
              nextResults.length
          );

          setProgress((prev) => {
            const { updated, bestDailyRecord, newEntries } =
              buildDailyCompletionUpdate(
                prev,
                {
                  dateKey: todayKey,
                  dailyNumber,
                  totalScore,
                  avgReactionMs,
                  overallAccuracy,
                  stages: nextResults,
                  completedAt: Date.now(),
                },
                scopeKey
              );

            if (authUser) {
              const uname = activeUsername || deriveDisplayUsername(authUser);
              void syncDailyCompletion(
                authUser.uid,
                uname,
                updated,
                bestDailyRecord,
                newEntries
              ).catch((err) => {
                console.error('Daily completion cloud sync error:', err);
              });
            }

            return updated;
          });
        } else {
          setProgress((prev) => {
            const { updated, entry } = buildPracticeCompletionUpdate(
              prev,
              result,
              todayKey,
              activeDifficulty,
              scopeKey
            );

            if (authUser) {
              const uname = activeUsername || deriveDisplayUsername(authUser);
              void syncPracticeCompletion(
                authUser.uid,
                uname,
                updated,
                entry
              ).catch((err) => {
                console.error('Practice completion cloud sync error:', err);
              });
            }

            return updated;
          });
        }
        setGameState('GAME_OVER');
      }
    },
    [
      progress.personalBests,
      stageResults,
      stageIndex,
      stageQueue.length,
      selectedMode,
      todayKey,
      dailyNumber,
      activeDifficulty,
      scopeKey,
      authUser,
      activeUsername,
    ]
  );

  const handleContinueNextStage = useCallback(() => {
    setStageIndex((idx) => idx + 1);
    setHud(INITIAL_HUD);
    setShowRulesHelp(false);
    setRunKey((k) => k + 1);
    setGameState('STAGE_BRIEFING');
    sound.playTick();
  }, []);

  const handlePauseToggle = useCallback(() => {
    if (showRulesHelp) {
      setShowRulesHelp(false);
      return;
    }
    setGameState((curr) => {
      if (curr === 'PLAYING') return 'PAUSED';
      if (curr === 'PAUSED') return 'PLAYING';
      return curr;
    });
  }, [showRulesHelp]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (authModalOpen) {
          e.preventDefault();
          setAuthModalOpen(false);
          return;
        }
        if (showRulesHelp) {
          e.preventDefault();
          setShowRulesHelp(false);
          return;
        }
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
          handlePauseToggle();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, showRulesHelp, authModalOpen, handlePauseToggle]);

  const effectiveStreak = getEffectiveStreak(progress, todayKey);
  const lastCompletedResult = stageResults[stageResults.length - 1];
  const nextDiscipline = stageQueue[stageIndex + 1];
  const isStagePaused = gameState !== 'PLAYING' || showRulesHelp || authModalOpen;

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0B111E] text-slate-100">
      {gameState === 'TITLE_MENU' ? (
        <TitleScreen
          todayKey={todayKey}
          progress={progress}
          selectedMode={selectedMode}
          selectedDifficulty={selectedDifficulty}
          activeUsername={activeUsername}
          authReady={authReady}
          isAuthModalOpen={authModalOpen}
          onSelectMode={setSelectedMode}
          onSelectDifficulty={setSelectedDifficulty}
          onStart={startNewRun}
          onQuickLaunchDiscipline={startRunForMode}
          onViewTodayResult={handleViewTodayResult}
          onOpenDashboard={() => setGameState('DASHBOARD')}
          onToggleMute={handleToggleMute}
          onOpenAuth={() => handleOpenAuth('signin')}
          onSignOut={handleSignOut}
        />
      ) : gameState === 'DASHBOARD' ? (
        <PerformanceDashboard
          todayKey={todayKey}
          progress={progress}
          activeUsername={activeUsername}
          onMenu={() => setGameState('TITLE_MENU')}
          onPlayDaily={() => startRunForMode('daily')}
          onToggleMute={handleToggleMute}
          onOpenAuth={() => handleOpenAuth('signin')}
          onSignOut={handleSignOut}
        />
      ) : (
        <div className="relative w-full h-full flex flex-col bg-gradient-to-b from-[#0E1525] via-[#0B111E] to-[#090E19]">
          <HudBar
            mode={selectedMode}
            dailyNumber={dailyNumber}
            stageIndex={stageIndex}
            totalStages={stageQueue.length}
            discipline={currentDiscipline}
            hud={hud}
            muted={progress.muted}
            showPlayMetrics={gameState === 'PLAYING' || gameState === 'PAUSED'}
            onMenu={() => {
              setShowRulesHelp(false);
              setGameState('TITLE_MENU');
            }}
            onToggleMute={handleToggleMute}
            onShowRules={() => setShowRulesHelp(true)}
            onPause={handlePauseToggle}
          />

          <div className="flex-1 min-h-0 w-full pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col overflow-y-auto overscroll-contain clean-scroll">
            {gameState === 'STAGE_BRIEFING' ? (
              <StageBriefing
                discipline={currentDiscipline}
                mode={selectedMode}
                difficulty={activeDifficulty}
                stageIndex={stageIndex}
                totalStages={stageQueue.length}
                personalBestScore={progress.personalBests[currentDiscipline]?.bestScore ?? 0}
                isBlockedByModal={authModalOpen}
                onStartStage={handleBeginStageFromBriefing}
                onMenu={() => setGameState('TITLE_MENU')}
              />
            ) : (
              <>
                {currentDiscipline === 'pattern' && (
                  <PatternEchoStage
                    key={`pattern-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'tempo' && (
                  <TempoMatchStage
                    key={`tempo-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'sequence' && (
                  <SequenceTrailStage
                    key={`sequence-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'stroop' && (
                  <StroopReflexStage
                    key={`stroop-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'pairs' && (
                  <DualPairsStage
                    key={`pairs-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'pulse' && (
                  <MentalPulseStage
                    key={`pulse-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'matrix' && (
                  <MatrixLogicStage
                    key={`matrix-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'digitspan' && (
                  <DigitSpanStage
                    key={`digitspan-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'cipher' && (
                  <CipherSequenceStage
                    key={`cipher-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}

                {currentDiscipline === 'ruleswitch' && (
                  <RuleSwitchStage
                    key={`ruleswitch-${runKey}`}
                    seed={runSeed}
                    difficulty={activeDifficulty}
                    isPaused={isStagePaused}
                    onHudUpdate={setHud}
                    onComplete={handleStageComplete}
                  />
                )}
              </>
            )}
          </div>

          {showRulesHelp && gameState === 'PLAYING' && (
            <StageBriefing
              discipline={currentDiscipline}
              mode={selectedMode}
              difficulty={activeDifficulty}
              stageIndex={stageIndex}
              totalStages={stageQueue.length}
              personalBestScore={progress.personalBests[currentDiscipline]?.bestScore ?? 0}
              isOverlayHelp
              isBlockedByModal={authModalOpen}
              onStartStage={() => setShowRulesHelp(false)}
              onMenu={() => {
                setShowRulesHelp(false);
                setGameState('TITLE_MENU');
              }}
            />
          )}

          {gameState === 'PAUSED' && !showRulesHelp && (
            <PauseModal
              onResume={() => setGameState('PLAYING')}
              onRestart={startNewRun}
              onQuit={() => setGameState('TITLE_MENU')}
            />
          )}

          {gameState === 'ROUND_SUMMARY' && lastCompletedResult && nextDiscipline && (
            <RoundSummaryModal
              stageIndex={stageIndex}
              totalStages={stageQueue.length}
              result={lastCompletedResult}
              previousBestScore={lastPrevBestScore}
              nextStageTitle={getDisciplineInfo(nextDiscipline, lang).title}
              onContinue={handleContinueNextStage}
              onMenu={() => setGameState('TITLE_MENU')}
            />
          )}

          {gameState === 'GAME_OVER' && (
            <VictoryModal
              mode={selectedMode}
              dailyNumber={dailyNumber}
              todayKey={todayKey}
              streak={effectiveStreak}
              stages={stageResults}
              newBestDisciplines={newBestDisciplines}
              record={progress.dailyRecords[todayKey]}
              onPlayAgain={startNewRun}
              onOpenDashboard={() => setGameState('DASHBOARD')}
              onReturnTitle={() => setGameState('TITLE_MENU')}
            />
          )}
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        currentUsername={activeUsername}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={() => setAuthModalOpen(false)}
      />

      <OfflineIndicator />
    </main>
  );
}
