import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../i18n/LanguageContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500/95 px-3 py-2 text-xs font-medium text-slate-950 shadow-xl border border-amber-300/60"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        {ar
          ? 'أنت غير متصل — يتم حفظ تقدّمك محلياً'
          : 'Offline Mode — Local progress cached'}
      </span>
    </div>
  );
};
