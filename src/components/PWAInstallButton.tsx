import React, { useState } from 'react';
import { Download, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../i18n/LanguageContext';

interface PWAInstallButtonProps {
  variant?: 'header' | 'menu-item';
  onTriggerMenuClose?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onTriggerMenuClose,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      await install();
      onTriggerMenuClose?.();
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      {variant === 'menu-item' ? (
        <button
          type="button"
          onClick={handleAction}
          className="w-full text-start px-3 py-2 rounded-lg text-xs font-medium text-teal-300 hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-2"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {ar ? 'تثبيت التطبيق على الشاشة الرئيسية' : 'Install App (Home Screen)'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAction}
          title={
            ar
              ? isInstallable
                ? 'تثبيت التطبيق'
                : 'إضافة للشاشة الرئيسية'
              : isInstallable
              ? 'Install App'
              : 'Add to Home Screen'
          }
          aria-label={ar ? 'تثبيت التطبيق على الهاتف' : 'Install Mnemon to home screen'}
          className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 backdrop-blur-md text-teal-200 border border-teal-300/35 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shadow-sm"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">
            {ar
              ? isInstallable
                ? 'تثبيت'
                : 'للشاشة الرئيسية'
              : isInstallable
              ? 'Install App'
              : 'Add to Home'}
          </span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGuideModal(false);
              onTriggerMenuClose?.();
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#131C2E] border border-white/15 p-5 sm:p-6 shadow-2xl space-y-4 animate-modal-enter">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Mnemon app icon"
                  className="w-12 h-12 rounded-2xl border border-white/20 shadow-lg shrink-0"
                />
                <div>
                  <h3
                    id="pwa-guide-title"
                    className="font-display text-base font-bold text-white"
                  >
                    {ar ? 'تثبيت التطبيق على الجوال' : 'Install Mnemon on Mobile'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {ar
                      ? 'أضفه إلى شاشتك الرئيسية بأيقونة التطبيق وتشغيل بملء الشاشة'
                      : 'Add to your home screen with its custom icon & full-screen mode'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGuideModal(false);
                  onTriggerMenuClose?.();
                }}
                aria-label={ar ? 'إغلاق نافذة التثبيت' : 'Close install instructions'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs sm:text-sm text-slate-200 bg-slate-900/80 border border-white/10 rounded-xl p-3.5">
                <p className="font-semibold text-amber-300">
                  {ar ? 'آيفون وآيباد (سفاري)' : 'iPhone & iPad (Safari)'}
                </p>
                <ol className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-amber-300 font-semibold">1.</span>
                    <span>
                      {ar ? (
                        <>
                          اضغط زر <strong className="text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline text-teal-300" /> المشاركة</strong> في شريط متصفح Safari (افتح الرابط في Safari مباشرة).
                        </>
                      ) : (
                        <>
                          Tap the <strong className="text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline text-teal-300" /> Share</strong> button in Safari&apos;s toolbar (open directly in Safari, not an in-app preview).
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-amber-300 font-semibold">2.</span>
                    <span>
                      {ar ? (
                        <>
                          مرّر للأسفل واختر <strong className="text-white">إضافة إلى الشاشة الرئيسية</strong>.
                        </>
                      ) : (
                        <>
                          Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-amber-300 font-semibold">3.</span>
                    <span>
                      {ar ? (
                        <>
                          تأكد من أيقونة <strong className="text-white">Mnemon</strong> ثم اضغط <strong className="text-white">إضافة</strong>.
                        </>
                      ) : (
                        <>
                          Confirm the <strong className="text-white">Mnemon</strong> icon and tap <strong className="text-white">Add</strong>.
                        </>
                      )}
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm text-slate-200 bg-slate-900/80 border border-white/10 rounded-xl p-3.5">
                <p className="font-semibold text-teal-300 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" aria-hidden="true" />
                  <span>{ar ? 'أندرويد ومتصفحات الجوال' : 'Android & Mobile Browsers'}</span>
                </p>
                <ol className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-teal-300 font-semibold">1.</span>
                    <span>
                      {ar ? (
                        <>
                          افتح رابط التطبيق مباشرة في <strong className="text-white">Chrome</strong> أو <strong className="text-white">Edge</strong> (خارج الإطار المضمّن).
                        </>
                      ) : (
                        <>
                          Open the deployed Mnemon link directly in <strong className="text-white">Chrome</strong> or <strong className="text-white">Edge</strong> (outside an embedded iframe).
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-teal-300 font-semibold">2.</span>
                    <span>
                      {ar ? (
                        <>
                          اضغط قائمة المتصفح <strong className="text-white inline-flex items-center"><MoreVertical className="w-3.5 h-3.5 inline" /></strong> واختر <strong className="text-white">تثبيت التطبيق</strong> أو <strong className="text-white">الإضافة إلى الشاشة الرئيسية</strong>.
                        </>
                      ) : (
                        <>
                          Tap the browser menu <strong className="text-white inline-flex items-center"><MoreVertical className="w-3.5 h-3.5 inline" /></strong> and choose <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.
                        </>
                      )}
                    </span>
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowGuideModal(false);
                onTriggerMenuClose?.();
              }}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              {ar ? 'حسناً' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
