import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, UserCheck, UserPlus, X } from 'lucide-react';
import {
  formatAuthError,
  signInWithUsername,
  signUpWithUsername,
  validateUsername,
} from '../services/userProgressService';
import { useLanguage } from '../i18n/LanguageContext';
import firebaseConfig from '../../firebase-applet-config.json';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'signin' | 'signup';
  currentUsername: string | null;
  onClose: () => void;
  onAuthenticated: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signin',
  currentUsername,
  onClose,
  onAuthenticated,
}) => {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsProviderEnable, setNeedsProviderEnable] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setNeedsProviderEnable(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNeedsProviderEnable(false);

    const check = validateUsername(username, lang);
    if (!check.valid) {
      setErrorMsg(check.error || (ar ? 'اسم المستخدم غير صالح.' : 'Invalid username.'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(
        ar ? 'يجب ألا تقل كلمة المرور عن 6 أحرف.' : 'Password must be at least 6 characters.'
      );
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpWithUsername(check.cleaned, password);
      } else {
        await signInWithUsername(check.cleaned, password);
      }
      setUsername('');
      setPassword('');
      onAuthenticated();
    } catch (err) {
      const formatted = formatAuthError(err, lang);
      setErrorMsg(formatted.message);
      setNeedsProviderEnable(formatted.needsProviderEnable);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#131C2E] border border-white/15 p-5 sm:p-6 shadow-2xl space-y-5 animate-modal-enter max-h-[90dvh] overflow-y-auto clean-scroll">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-lg sm:text-xl font-bold text-white"
            >
              {ar
                ? mode === 'signin'
                  ? 'تسجيل الدخول إلى ملفك'
                  : 'إنشاء حساب لاعب جديد'
                : mode === 'signin'
                ? 'Sign In to Your Profile'
                : 'Create Player Account'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {currentUsername
                ? ar
                  ? `الحساب النشط حالياً: ${currentUsername}. سجّل الدخول للتبديل بين اللاعبين.`
                  : `Currently active: ${currentUsername}. Sign in to switch accounts.`
                : ar
                ? 'بدون بريد إلكتروني — يكفي اسم المستخدم وكلمة المرور لحفظ نتائج كل لاعب بشكل مستقل.'
                : 'No email required — use a username & password only to keep your stats separate.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={ar ? 'إغلاق نافذة الحساب' : 'Close account modal'}
            className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
            }}
            className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              mode === 'signin'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {ar ? 'تسجيل الدخول' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
            }}
            className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              mode === 'signup'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {ar ? 'حساب جديد' : 'Create Account'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="mnemon-username"
              className="block text-xs font-medium text-slate-200"
            >
              {ar ? 'اسم المستخدم' : 'Username'}
            </label>
            <div className="relative">
              <UserCheck
                className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="mnemon-username"
                type="text"
                dir="ltr"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={ar ? 'مثال: omar_99' : 'e.g. alex_99'}
                className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {ar
                ? 'من 3 إلى 24 حرفاً · أحرف إنجليزية وأرقام أو _ أو - أو .'
                : '3–24 characters · Letters, numbers, _, -, or .'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="mnemon-password"
              className="block text-xs font-medium text-slate-200"
            >
              {ar ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="mnemon-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={ar ? '6 أحرف على الأقل' : 'At least 6 characters'}
                className="w-full min-h-[44px] ps-9 pe-11 py-2 rounded-xl bg-slate-900 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={
                  ar
                    ? showPassword
                      ? 'إخفاء كلمة المرور'
                      : 'إظهار كلمة المرور'
                    : showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                className="absolute end-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200 space-y-2">
              <p>{errorMsg}</p>
              {needsProviderEnable && (
                <p className="text-[11px] text-amber-200 leading-relaxed">
                  {ar ? (
                    <>
                      لا نجمع أي بريد إلكتروني من اللاعبين، ولكن مشروع Firebase{' '}
                      <span className="font-mono">{firebaseConfig.projectId}</span> يتطلب تفعيل موفر كلمة المرور (&quot;Email/Password&quot;) مرة واحدة من:
                    </>
                  ) : (
                    <>
                      Players never enter an email, but Firebase project{' '}
                      <span className="font-mono">{firebaseConfig.projectId}</span> requires its
                      password provider (&quot;Email/Password&quot;) toggled ON once under
                      Authentication → Sign-in method:
                    </>
                  )}
                  <br />
                  <span dir="ltr" className="font-mono break-all text-amber-300">
                    console.firebase.google.com/project/{firebaseConfig.projectId}/authentication/providers
                  </span>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
          >
            {mode === 'signin' ? (
              <LogIn className="w-4 h-4" aria-hidden="true" />
            ) : (
              <UserPlus className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {submitting
                ? ar
                  ? 'جارٍ الاتصال...'
                  : 'Connecting...'
                : mode === 'signin'
                ? ar
                  ? 'تسجيل الدخول'
                  : 'Sign In'
                : ar
                ? 'إنشاء الحساب والبدء'
                : 'Create Account & Start'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
