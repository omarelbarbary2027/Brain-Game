import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { OperationType, auth, db, handleFirestoreError } from '../firebase';
import {
  ALL_DISCIPLINE_IDS,
  DailyCompletionRecord,
  Difficulty,
  DisciplineId,
  PersonalBest,
  PlayerProgress,
  SessionLogEntry,
  StageResult,
} from '../types/game';
import {
  DEFAULT_BEST,
  createDefaultBests,
  createDefaultProgress,
  saveProgress,
} from '../utils/storage';

export const USERNAME_REGEX = /^[a-zA-Z0-9_.\-]{3,24}$/;
const DATE_KEY_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function validateUsername(
  raw: string,
  lang: 'en' | 'ar' = 'en'
): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = raw.trim();
  if (cleaned.length < 3 || cleaned.length > 24) {
    return {
      valid: false,
      cleaned,
      error:
        lang === 'ar'
          ? 'يجب أن يتكوّن اسم المستخدم من 3 إلى 24 حرفاً.'
          : 'Username must be 3–24 characters.',
    };
  }
  if (!USERNAME_REGEX.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error:
        lang === 'ar'
          ? 'استخدم فقط أحرفاً إنجليزية أو أرقاماً أو (_) أو (-) أو (.).'
          : 'Use only letters, numbers, underscores (_), hyphens (-), or dots (.).',
    };
  }
  return { valid: true, cleaned };
}

export function usernameToAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@users.mnemon.app`;
}

export function deriveDisplayUsername(user: User | null): string {
  if (!user) return 'Guest';
  const candidate =
    user.displayName?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'Player';
  if (USERNAME_REGEX.test(candidate)) return candidate;
  const sanitized = candidate.replace(/[^a-zA-Z0-9_.\-]/g, '').slice(0, 24);
  return sanitized.length >= 3 ? sanitized : `Player_${user.uid.slice(0, 6)}`;
}

function sanitizeInt(n: unknown, min = 0, max = 10_000_000): number {
  const val = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0;
  return Math.max(min, Math.min(max, val));
}

function sanitizePersonalBests(
  bests: Partial<Record<DisciplineId, PersonalBest>>
): Record<DisciplineId, PersonalBest> {
  const clean = createDefaultBests();
  for (const id of ALL_DISCIPLINE_IDS) {
    const src = bests[id] ?? DEFAULT_BEST;
    clean[id] = {
      bestScore: sanitizeInt(src.bestScore, 0),
      fastestAvgMs: sanitizeInt(src.fastestAvgMs, 0),
      bestAccuracy: sanitizeInt(src.bestAccuracy, 0, 100),
      gamesPlayed: sanitizeInt(src.gamesPlayed, 0),
    };
  }
  return clean;
}

function sanitizeStageList(stages: StageResult[]): StageResult[] {
  return stages.slice(0, 5).map((s) => ({
    discipline: s.discipline,
    label: String(s.label).slice(0, 48),
    score: sanitizeInt(s.score, 0),
    accuracy: sanitizeInt(s.accuracy, 0, 100),
    avgReactionMs: sanitizeInt(s.avgReactionMs, 0),
    bestStreak: sanitizeInt(s.bestStreak, 0),
    hintsUsed: sanitizeInt(s.hintsUsed, 0),
    roundsCompleted: sanitizeInt(s.roundsCompleted, 0),
    totalRounds: sanitizeInt(s.totalRounds, 1),
  }));
}

function sanitizeSessionId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  return VALID_ID_REGEX.test(cleaned) && cleaned.length > 0
    ? cleaned
    : `s_${Date.now()}`;
}

export async function signUpWithUsername(username: string, password: string): Promise<User> {
  const check = validateUsername(username);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid username.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const email = usernameToAuthEmail(check.cleaned);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: check.cleaned });
  await ensureUserProfile(cred.user, check.cleaned);
  return cred.user;
}

export async function signInWithUsername(username: string, password: string): Promise<User> {
  const check = validateUsername(username);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid username.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  const email = usernameToAuthEmail(check.cleaned);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(cred.user, check.cleaned);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(user: User, preferredUsername?: string): Promise<void> {
  const profilePath = `users/${user.uid}`;
  const profileRef = doc(db, 'users', user.uid);
  let existsOnServer = false;

  try {
    const snap = await getDoc(profileRef);
    existsOnServer = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  if (existsOnServer) return;

  const username =
    preferredUsername && USERNAME_REGEX.test(preferredUsername)
      ? preferredUsername
      : deriveDisplayUsername(user);

  try {
    await setDoc(profileRef, {
      uid: user.uid,
      username,
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDate: '',
      muted: false,
      personalBests: createDefaultBests(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, profilePath);
  }
}

export function subscribeUserProgress(
  uid: string,
  onProgress: (progress: PlayerProgress, username: string) => void,
  onSyncError?: (message: string) => void
): () => void {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    return () => {};
  }

  let latestProfile: {
    username: string;
    currentStreak: number;
    bestStreak: number;
    lastCompletedDate: string | null;
    muted: boolean;
    personalBests: Record<DisciplineId, PersonalBest>;
  } | null = null;
  let latestDailyRecords: Record<string, DailyCompletionRecord> = {};
  let latestSessions: SessionLogEntry[] = [];
  let hasProfile = false;

  const emitMerged = () => {
    if (!hasProfile || !latestProfile) return;
    const merged: PlayerProgress = {
      currentStreak: latestProfile.currentStreak,
      bestStreak: latestProfile.bestStreak,
      lastCompletedDate: latestProfile.lastCompletedDate,
      dailyRecords: latestDailyRecords,
      personalBests: latestProfile.personalBests,
      sessionHistory: latestSessions,
      muted: latestProfile.muted,
    };
    saveProgress(merged, uid);
    onProgress(merged, latestProfile.username);
  };

  const profilePath = `users/${uid}`;
  const dailyPath = `users/${uid}/dailyRecords`;
  const sessionsPath = `users/${uid}/sessions`;

  const unsubProfile = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        const defaults = createDefaultProgress();
        latestProfile = {
          username: deriveDisplayUsername(auth.currentUser),
          currentStreak: defaults.currentStreak,
          bestStreak: defaults.bestStreak,
          lastCompletedDate: defaults.lastCompletedDate,
          muted: defaults.muted,
          personalBests: defaults.personalBests,
        };
        hasProfile = true;
        emitMerged();
        return;
      }
      const data = snap.data();
      latestProfile = {
        username:
          typeof data.username === 'string' && USERNAME_REGEX.test(data.username)
            ? data.username
            : deriveDisplayUsername(auth.currentUser),
        currentStreak: sanitizeInt(data.currentStreak, 0),
        bestStreak: sanitizeInt(data.bestStreak, 0),
        lastCompletedDate:
          typeof data.lastCompletedDate === 'string' && DATE_KEY_REGEX.test(data.lastCompletedDate)
            ? data.lastCompletedDate
            : null,
        muted: Boolean(data.muted),
        personalBests: sanitizePersonalBests(
          (data.personalBests ?? {}) as Partial<Record<DisciplineId, PersonalBest>>
        ),
      };
      hasProfile = true;
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, profilePath);
      } catch (err) {
        onSyncError?.(err instanceof Error ? err.message : 'Unable to load user profile.');
      }
    }
  );

  const unsubDaily = onSnapshot(
    collection(db, 'users', uid, 'dailyRecords'),
    (snap) => {
      const next: Record<string, DailyCompletionRecord> = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const dateKey = typeof d.dateKey === 'string' ? d.dateKey : docSnap.id;
        if (!DATE_KEY_REGEX.test(dateKey)) return;
        next[dateKey] = {
          dateKey,
          dailyNumber: sanitizeInt(d.dailyNumber, 1),
          totalScore: sanitizeInt(d.totalScore, 0),
          avgReactionMs: sanitizeInt(d.avgReactionMs, 0),
          overallAccuracy: sanitizeInt(d.overallAccuracy, 0, 100),
          completedAt: sanitizeInt(d.completedAt, 1),
          stages: Array.isArray(d.stages) ? (d.stages as StageResult[]) : [],
        };
      });
      latestDailyRecords = next;
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, dailyPath);
      } catch (err) {
        onSyncError?.(err instanceof Error ? err.message : 'Unable to sync daily records.');
      }
    }
  );

  const sessionsQuery = query(
    collection(db, 'users', uid, 'sessions'),
    orderBy('timestamp', 'desc'),
    limit(300)
  );

  const unsubSessions = onSnapshot(
    sessionsQuery,
    (snap) => {
      const list: SessionLogEntry[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const dateKey = typeof d.dateKey === 'string' ? d.dateKey : '';
        if (!DATE_KEY_REGEX.test(dateKey)) return;
        list.push({
          id: docSnap.id,
          dateKey,
          timestamp: sanitizeInt(d.timestamp, 1),
          mode: d.mode === 'daily' ? 'daily' : 'practice',
          difficulty: (d.difficulty as Difficulty) || 'standard',
          discipline: d.discipline as DisciplineId,
          score: sanitizeInt(d.score, 0),
          avgReactionMs: sanitizeInt(d.avgReactionMs, 0),
          accuracy: sanitizeInt(d.accuracy, 0, 100),
          bestStreak: sanitizeInt(d.bestStreak, 0),
        });
      });
      latestSessions = list.sort((a, b) => a.timestamp - b.timestamp);
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, sessionsPath);
      } catch (err) {
        onSyncError?.(err instanceof Error ? err.message : 'Unable to sync session history.');
      }
    }
  );

  return () => {
    unsubProfile();
    unsubDaily();
    unsubSessions();
  };
}

export async function syncDailyCompletion(
  uid: string,
  username: string,
  nextProgress: PlayerProgress,
  bestDailyRecord: DailyCompletionRecord,
  newEntries: SessionLogEntry[]
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  await ensureUserProfile(auth.currentUser, username);

  const profilePath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      username,
      currentStreak: sanitizeInt(nextProgress.currentStreak, 0),
      bestStreak: sanitizeInt(nextProgress.bestStreak, 0),
      lastCompletedDate:
        nextProgress.lastCompletedDate && DATE_KEY_REGEX.test(nextProgress.lastCompletedDate)
          ? nextProgress.lastCompletedDate
          : '',
      muted: Boolean(nextProgress.muted),
      personalBests: sanitizePersonalBests(nextProgress.personalBests),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }

  const dailyPath = `users/${uid}/dailyRecords/${bestDailyRecord.dateKey}`;
  try {
    await setDoc(doc(db, 'users', uid, 'dailyRecords', bestDailyRecord.dateKey), {
      uid,
      dateKey: bestDailyRecord.dateKey,
      dailyNumber: sanitizeInt(bestDailyRecord.dailyNumber, 1),
      totalScore: sanitizeInt(bestDailyRecord.totalScore, 0),
      avgReactionMs: sanitizeInt(bestDailyRecord.avgReactionMs, 0),
      overallAccuracy: sanitizeInt(bestDailyRecord.overallAccuracy, 0, 100),
      completedAt: sanitizeInt(bestDailyRecord.completedAt, 1),
      stages: sanitizeStageList(bestDailyRecord.stages),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, dailyPath);
  }

  for (const entry of newEntries) {
    const sessionId = sanitizeSessionId(entry.id);
    const sessionPath = `users/${uid}/sessions/${sessionId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'sessions', sessionId), {
        uid,
        dateKey: entry.dateKey,
        timestamp: sanitizeInt(entry.timestamp, 1),
        mode: entry.mode,
        difficulty: entry.difficulty,
        discipline: entry.discipline,
        score: sanitizeInt(entry.score, 0),
        avgReactionMs: sanitizeInt(entry.avgReactionMs, 0),
        accuracy: sanitizeInt(entry.accuracy, 0, 100),
        bestStreak: sanitizeInt(entry.bestStreak, 0),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, sessionPath);
    }
  }
}

export async function syncPracticeCompletion(
  uid: string,
  username: string,
  nextProgress: PlayerProgress,
  entry: SessionLogEntry
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  await ensureUserProfile(auth.currentUser, username);

  const profilePath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      personalBests: sanitizePersonalBests(nextProgress.personalBests),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }

  const sessionId = sanitizeSessionId(entry.id);
  const sessionPath = `users/${uid}/sessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'sessions', sessionId), {
      uid,
      dateKey: entry.dateKey,
      timestamp: sanitizeInt(entry.timestamp, 1),
      mode: entry.mode,
      difficulty: entry.difficulty,
      discipline: entry.discipline,
      score: sanitizeInt(entry.score, 0),
      avgReactionMs: sanitizeInt(entry.avgReactionMs, 0),
      accuracy: sanitizeInt(entry.accuracy, 0, 100),
      bestStreak: sanitizeInt(entry.bestStreak, 0),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, sessionPath);
  }
}

export async function syncMutePreference(uid: string, muted: boolean): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  await ensureUserProfile(auth.currentUser);
  const profilePath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      muted: Boolean(muted),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export function formatAuthError(
  error: unknown,
  lang: 'en' | 'ar' = 'en'
): { message: string; needsProviderEnable: boolean } {
  const code = (error as { code?: string })?.code ?? '';
  const msg = error instanceof Error ? error.message : String(error);
  const ar = lang === 'ar';

  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return {
      message: ar
        ? 'تسجيل الدخول بكلمة المرور غير مفعّل بعد في لوحة Firebase. لا نطلب أي بريد إلكتروني من اللاعبين، ولكن يلزم تفعيل خيار Email/Password مرة واحدة من الإعدادات.'
        : 'Password accounts are not enabled yet in Firebase Console. No email is collected from players, but the Email/Password provider toggle must be enabled once.',
      needsProviderEnable: true,
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      message: ar
        ? 'يسمح فقط بالأحرف الإنجليزية والأرقام والرموز _ و - و . (من 3 إلى 24 حرفاً).'
        : 'Username may only use letters, numbers, _, -, or . (3–24 characters).',
      needsProviderEnable: false,
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return {
      message: ar
        ? 'اسم المستخدم أو كلمة المرور غير صحيحة.'
        : 'Incorrect username or password.',
      needsProviderEnable: false,
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      message: ar
        ? 'اسم المستخدم هذا مسجّل بالفعل. سجّل الدخول أو اختر اسماً آخر.'
        : 'That username is already taken. Sign in or pick another username.',
      needsProviderEnable: false,
    };
  }
  if (code === 'auth/weak-password') {
    return {
      message: ar
        ? 'يجب ألا تقل كلمة المرور عن 6 أحرف.'
        : 'Password must be at least 6 characters.',
      needsProviderEnable: false,
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      message: ar
        ? 'محاولات كثيرة متتالية. انتظر لحظة ثم أعد المحاولة.'
        : 'Too many attempts. Wait a moment and try again.',
      needsProviderEnable: false,
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      message: ar
        ? 'تعذر الاتصال بالشبكة. تحقق من اتصالك بالإنترنت وأعد المحاولة.'
        : 'Network error. Check your internet connection and retry.',
      needsProviderEnable: false,
    };
  }
  return {
    message: msg || (ar ? 'تعذر إتمام العملية. يرجى المحاولة مجدداً.' : 'Authentication failed. Please try again.'),
    needsProviderEnable: false,
  };
}
