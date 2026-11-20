import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ArrowRight,
  RefreshCw,
  Shield,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { SteamLogo } from './discord/PlatformIcons';

interface SteamInlineLoginProps {
  theme: any;
  lang: 'ru' | 'en';
  onLoginSuccess: (name: string) => void;
  addLog: (level: string, message: string) => void;
}

export function SteamInlineLogin({
  theme,
  lang,
  onLoginSuccess,
  addLog
}: SteamInlineLoginProps) {
  const [authTab, setAuthTab] = useState<'credentials' | 'qr'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guardCode, setGuardCode] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [steamGuardWarning, setSteamGuardWarning] = useState<string | null>(null);
  const [qrSeconds, setQrSeconds] = useState(165);

  const loadQr = () => {
    setQrUrl(null);
    setQrSeconds(180);
    fetch('/api/login/qr', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d && (d.qrDataUrl || d.qrUrl)) {
          setQrUrl(d.qrDataUrl || d.qrUrl);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (authTab === 'qr') {
      loadQr();
    }
  }, [authTab]);

  useEffect(() => {
    if (authTab !== 'qr') return;
    const interval = setInterval(() => {
      setQrSeconds((prev) => (prev > 0 ? prev - 1 : 180));
    }, 1000);
    return () => clearInterval(interval);
  }, [authTab]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsSubmitting(true);
    setSteamGuardWarning(null);
    try {
      const res = await fetch('/api/login/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: username,
          password,
          twoFactorCode: guardCode || undefined
        })
      });
      const data = await res.json();
      if (data.status === 'need_code' || data.need_code) {
        const warn = lang === 'ru'
          ? 'Требуется код Steam Guard! Введите 5-значный код в поле 2FA GUARD.'
          : 'Steam Guard code required! Enter the 5-digit code in 2FA GUARD field.';
        setSteamGuardWarning(warn);
        addLog('WARN', warn);
      } else if (data.success || data.status === 'success') {
        const persona = data.personaName || username;
        addLog('SUCCESS', `Авторизация Steam успешна: [${persona}]!`);
        onLoginSuccess(persona);
      } else {
        addLog('ERROR', 'Ошибка входа: ' + (data.error || 'Неверные данные'));
      }
    } catch (err: any) {
      addLog('ERROR', 'Ошибка подключения к серверу: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckQrApproval = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.isLoggedOn && data.user) {
        addLog('SUCCESS', 'Авторизация подтверждена через Steam Mobile!');
        onLoginSuccess(data.user.personaName || 'Steam User');
      } else {
        addLog('INFO', 'Ожидание подтверждения QR в приложении Steam Mobile...');
      }
    } catch (e) {}
  };

  const qrFormatted = `${String(Math.floor(qrSeconds / 60)).padStart(2, '0')}:${String(qrSeconds % 60).padStart(2, '0')}`;

  return (
    <div className="w-full min-h-[calc(100vh-160px)] flex items-center justify-center relative select-none">
      {/* Centered Liquid Glass Steam Registration Card */}
      <div
        className="relative z-10 w-full max-w-[430px] mx-4 p-8 rounded-2xl backdrop-blur-2xl bg-gradient-to-b from-[#161822]/70 via-[#0e1017]/74 to-[#07080d]/80 border border-white/[0.14] shadow-[0_24px_70px_rgba(0,0,0,0.85)] space-y-6 transition-all duration-300"
        style={{
          boxShadow:
            'inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), inset 0 0 18px 0 rgba(255, 255, 255, 0.02), 0 24px 60px rgba(0, 0, 0, 0.85)'
        }}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div
            className={`w-12 h-12 rounded-xl bg-white/[0.06] border ${theme?.accentBorder || 'border-amber-500/40'} ${theme?.primaryText || 'text-amber-400'} mx-auto flex items-center justify-center shadow-lg`}
          >
            <SteamLogo className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            {lang === 'ru' ? 'Вход в Менеджер Steam' : 'Sign in to Steam Manager'}
          </h2>
          <p className="text-xs text-white/55 max-w-xs mx-auto leading-relaxed">
            {lang === 'ru'
              ? 'Авторизуйтесь в аккаунте Steam, чтобы активировать фарм часов, карточек и ачивок.'
              : 'Authenticate to unlock Steam hour boosting, card drops, and achievements.'}
          </p>
        </div>

        {/* Tab Switcher: 01 Login vs 02 QR */}
        <div className="p-1 rounded-xl bg-black/60 border border-white/[0.12] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAuthTab('credentials')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-transform duration-150 active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
              authTab === 'credentials'
                ? 'bg-white/[0.14] text-white shadow-sm border border-white/20'
                : 'text-white/45 hover:text-white/80'
            }`}
          >
            {lang === 'ru' ? '01 Логин и пароль' : '01 Credentials'}
          </button>
          <button
            type="button"
            onClick={() => setAuthTab('qr')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-transform duration-150 active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
              authTab === 'qr'
                ? `${theme?.activeNavBg || 'bg-amber-500/20 text-amber-300'} shadow-sm border`
                : 'text-white/45 hover:text-white/80'
            }`}
          >
            {lang === 'ru' ? '02 QR-код' : '02 Mobile QR'}
          </button>
        </div>

        {/* Tab 01: Credentials Form */}
        {authTab === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-white/50 uppercase">
                {lang === 'ru' ? 'Логин Steam' : 'Steam Login'}
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Steam account name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/[0.14] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-white/50 uppercase">
                {lang === 'ru' ? 'Пароль' : 'Password'}
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/[0.14] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-white/50 uppercase">
                2FA STEAM GUARD
              </label>
              <div className="relative">
                <Shield size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  maxLength={5}
                  value={guardCode}
                  onChange={(e) => setGuardCode(e.target.value.toUpperCase())}
                  placeholder={lang === 'ru' ? '8X9K4 (если требуется)' : '8X9K4 (if required)'}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border ${
                    steamGuardWarning ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-white/[0.14] focus:border-white/40'
                  } shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] text-xs font-mono tracking-widest uppercase text-white placeholder-white/25 focus:outline-none transition-colors`}
                />
              </div>
            </div>

            {steamGuardWarning && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle size={15} strokeWidth={1.5} className="shrink-0 text-amber-400 mt-0.5" />
                <span className="leading-relaxed">{steamGuardWarning}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-transform duration-120 active:scale-[0.98] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                theme?.primaryBg || 'bg-amber-500 text-black hover:bg-amber-400'
              } shadow-lg`}
              style={{ boxShadow: theme?.glowShadow }}
            >
              <span>
                {isSubmitting
                  ? lang === 'ru'
                    ? 'Подключение к Steam...'
                    : 'Connecting...'
                  : lang === 'ru'
                  ? 'Войти в аккаунт Steam'
                  : 'Sign in to Steam'}
              </span>
              <ArrowRight size={15} />
            </button>
          </form>
        ) : (
          /* Tab 02: QR Code */
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-black/60 border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center gap-4">
              <div className="relative p-2 rounded-lg bg-white shrink-0 shadow-md flex items-center justify-center min-w-[110px] min-h-[110px]">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="Steam QR"
                    className="w-24 h-24 object-contain select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="w-24 h-24 flex flex-col items-center justify-center text-neutral-700 text-[10px] font-medium text-center">
                    <RefreshCw size={18} className="animate-spin text-amber-500 mb-1" />
                    <span>{lang === 'ru' ? 'Загрузка...' : 'Loading...'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>STEAM GUARD QR</span>
                </div>
                <p className="text-white/60 text-[11px] leading-relaxed">
                  {lang === 'ru'
                    ? 'Отсканируйте код в Steam Mobile на телефоне.'
                    : 'Scan with Steam Mobile on your phone.'}
                </p>
                <div className="flex items-center gap-2 text-[10px] font-mono text-white/50">
                  <span>TTL: {qrFormatted}</span>
                  <button
                    type="button"
                    onClick={loadQr}
                    className="text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={10} />
                    <span>{lang === 'ru' ? 'Обновить' : 'Refresh'}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckQrApproval}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                theme?.primaryBg || 'bg-amber-500 text-black hover:bg-amber-400'
              } shadow-lg active:scale-[0.99]`}
              style={{ boxShadow: theme?.glowShadow }}
            >
              <span>{lang === 'ru' ? 'Проверить подтверждение входа' : 'Check QR Approval'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Footer Note */}
        <p className="text-[10px] font-mono text-center text-white/35">
          {lang === 'ru'
            ? 'AES-256 Token Vault • Прямой сокет Steam CM'
            : 'AES-256 Token Vault • Direct Steam CM Socket'}
        </p>
      </div>
    </div>
  );
}
