import React, { startTransition, useCallback, useEffect, useRef, useState, ViewTransition } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, QrCode, Shield } from 'lucide-react';
import { DiscordLogo, SteamLogo } from './discord/PlatformIcons';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDiscord: () => void;
  onOpenSteam: () => void;
  steamConnected: boolean;
}

type CodeType = 'email' | 'mobile' | null;

export function LoginModal({ isOpen, onClose, onOpenDiscord, onOpenSteam, steamConnected }: LoginModalProps) {
  const [service, setService] = useState<'choice' | 'steam'>('choice');
  const [activeTab, setActiveTab] = useState<'credentials' | 'qr'>('credentials');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRequest = useRef(0);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [accountName, setAccountName] = useState(() => {
    try { return localStorage.getItem('vapor_steam_account_name') || ''; }
    catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [codeType, setCodeType] = useState<CodeType>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [guardCode, setGuardCode] = useState('');
  const [guardLoading, setGuardLoading] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);

  const stopQr = useCallback(() => {
    qrRequest.current++;
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    qrPollRef.current = null;
    setQrDataUrl(null);
    setQrLoading(false);
    setQrError(null);
    fetch('/api/login/cancel', { method: 'POST' }).catch(() => {});
  }, []);

  const close = () => {
    if (activeTab === 'qr' || awaitingConfirmation) stopQr();
    onClose();
  };

  const leaveSteam = () => {
    if (activeTab === 'qr' || awaitingConfirmation) stopQr();
    setActiveTab('credentials');
    setAwaitingConfirmation(false);
    setCodeType(null);
    startTransition(() => setService('choice'));
  };

  useEffect(() => () => {
    qrRequest.current++;
    if (qrPollRef.current) clearInterval(qrPollRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setService('choice');
      setActiveTab('credentials');
      setPassword('');
      setGuardCode('');
      setCodeType(null);
      setAwaitingConfirmation(false);
    }
  }, [isOpen]);

  const startPolling = useCallback(() => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    qrPollRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        if (data.isLoggedOn || data.loggedIn) {
          if (qrPollRef.current) clearInterval(qrPollRef.current);
          qrPollRef.current = null;
          onClose();
        }
      } catch {
        // The connection can be temporarily unavailable during Steam authentication.
      }
    }, 2500);
  }, [onClose]);

  const generateQr = useCallback(async () => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    qrPollRef.current = null;
    const requestId = ++qrRequest.current;
    setQrLoading(true);
    setQrError(null);
    setQrDataUrl(null);
    try {
      const response = await fetch('/api/login/qr', { method: 'POST' });
      const data = await response.json().catch(() => { throw new Error('Сервер входа недоступен'); });
      if (!response.ok || data.success === false || !data.qrDataUrl) {
        throw new Error(data.error || 'Не удалось получить QR-код');
      }
      if (requestId !== qrRequest.current) return;
      setQrDataUrl(data.qrDataUrl);
      startPolling();
    } catch (error: any) {
      if (requestId === qrRequest.current) setQrError(error.message || 'Не удалось получить QR-код');
    } finally {
      if (requestId === qrRequest.current) setQrLoading(false);
    }
  }, [startPolling]);

  useEffect(() => {
    if (isOpen && service === 'steam' && activeTab === 'qr' && !qrDataUrl && !qrLoading && !qrError) {
      generateQr();
    }
  }, [isOpen, service, activeTab, qrDataUrl, qrLoading, qrError, generateQr]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (service === 'steam') leaveSteam();
        else close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, service, activeTab, awaitingConfirmation, onClose, stopQr]);

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountName.trim() || !password) return;
    setCredLoading(true);
    setCredError(null);
    try {
      const response = await fetch('/api/login/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: accountName.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (data.status === 'need_code' || data.status === 'success' || data.status === 'pending') {
        try { localStorage.setItem('vapor_steam_account_name', accountName.trim()); }
        catch { /* Session login still works when browser storage is unavailable. */ }
      }
      if (data.status === 'need_code') setCodeType(data.codeType === 'email' ? 'email' : 'mobile');
      else if (data.status === 'success' || data.status === 'pending') {
        setAwaitingConfirmation(true);
        startPolling();
      }
    } catch (error: any) {
      setCredError(error.message || 'Ошибка входа');
    } finally {
      setCredLoading(false);
    }
  };

  const submitGuard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!guardCode.trim()) return;
    setGuardLoading(true);
    setGuardError(null);
    try {
      const response = await fetch('/api/login/guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: guardCode.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (data.status === 'success' || data.status === 'pending') {
        setAwaitingConfirmation(true);
        startPolling();
      }
    } catch (error: any) {
      setGuardError(error.message || 'Не удалось проверить код');
    } finally {
      setGuardLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <main className="auth-page" aria-label="Выбор сервиса и вход">
      <div className="auth-layout">
        <header className="auth-topline">
          <span className="auth-brand"><img src="/vapor.png" alt="" className="w-6 h-6 inline-block align-middle rounded-md" /> VAPOR <span className="auth-brand-suffix">/ CONNECT</span></span>
        </header>

        <div className="auth-body">
          <div className="auth-intro">
            <div className="auth-eyebrow"><span className="auth-live-dot" /> ВАШЕ ПРОСТРАНСТВО</div>
            <h1>Всё на<br /><em>своей орбите.</em></h1>
            <p>Управляйте Steam и Discord в одном месте. Выберите сервис, чтобы продолжить.</p>
            <div className="auth-footnote">01 / 02 &nbsp;·&nbsp; ПОДКЛЮЧЕНИЕ СЕРВИСОВ</div>
          </div>

          <ViewTransition key={service} enter="auth-enter" exit="auth-exit" default="none">
            <section className="auth-content" aria-label={service === 'choice' ? 'Выбор сервиса' : 'Вход в Steam'}>
              {service === 'choice' ? (
                <>
                  <div className="auth-section-label">Выберите направление <span>01 — 02</span></div>
                   <button type="button" className="auth-service auth-service--steam" onClick={() => steamConnected ? onOpenSteam() : startTransition(() => setService('steam'))}>
                    <span className="auth-service-icon"><SteamLogo className="w-8 h-8" /></span>
                    <span className="auth-service-copy">
                      <strong>Steam</strong>
                      <small>Библиотека, карточки, достижения и часы</small>
                       <span className="auth-service-action">{steamConnected ? 'Открыть Steam' : 'Войти в Steam'} <ArrowRight size={15} /></span>
                    </span>
                    <span className="auth-service-number">01</span>
                  </button>
                  <button type="button" className="auth-service auth-service--discord" onClick={onOpenDiscord}>
                    <span className="auth-service-icon"><DiscordLogo className="w-8 h-8" /></span>
                    <span className="auth-service-copy">
                      <strong>Discord</strong>
                      <small>Квесты, активность и каталог игр</small>
                      <span className="auth-service-action">Открыть Discord <ArrowRight size={15} /></span>
                    </span>
                    <span className="auth-service-number">02</span>
                  </button>
                  <p className="auth-hint">Для Discord регистрация не требуется. Аккаунт можно подключить позже во вкладке «Квесты».</p>
                </>
              ) : (
                <div className="auth-form-card">
                  <button type="button" className="auth-back" onClick={leaveSteam}><ArrowLeft size={15} /> К выбору сервиса</button>
                  <span className="auth-form-icon"><SteamLogo className="w-7 h-7" /></span>
                  <h2>Вход в Steam</h2>
                  <p className="auth-form-description">Используйте аккаунт Steam или сканируйте QR-код в Steam Mobile.</p>
                  {awaitingConfirmation && <p role="status" className="auth-notice">Подтвердите вход в Steam Mobile. Ожидаем подключение…</p>}
                  {!codeType && (
                    <div className="auth-tabs" role="tablist" aria-label="Способ входа">
                      <button type="button" role="tab" aria-selected={activeTab === 'credentials'} className={activeTab === 'credentials' ? 'is-active' : ''} onClick={() => {
                        if (activeTab === 'qr') stopQr();
                        setActiveTab('credentials');
                      }}><KeyRound size={15} /> Логин и пароль</button>
                      <button type="button" role="tab" aria-selected={activeTab === 'qr'} className={activeTab === 'qr' ? 'is-active' : ''} onClick={() => setActiveTab('qr')}><QrCode size={15} /> QR-код</button>
                    </div>
                  )}
                  {!codeType && activeTab === 'credentials' && (
                      <form onSubmit={submitCredentials} className="auth-fields">
                       <label>Логин Steam<input type="text" autoComplete="username" required value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="Имя аккаунта" /></label>
                       <p className="auth-form-description">Имя аккаунта запоминается на этом устройстве. Пароль не сохраняется.</p>
                      <label>Пароль<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Ваш пароль" /></label>
                      {credError && <p role="alert" className="auth-error">{credError}</p>}
                      <button type="submit" className="auth-submit" disabled={credLoading || awaitingConfirmation}>
                        {credLoading ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                        {credLoading ? 'Подключаем…' : 'Войти в Steam'}
                      </button>
                    </form>
                  )}
                  {!codeType && activeTab === 'qr' && (
                    <div className="auth-qr-section">
                      <div className="auth-qr-frame">
                        {qrDataUrl ? <img src={qrDataUrl} alt="QR-код для входа через Steam Mobile" /> :
                          <div className="auth-qr-placeholder">{qrLoading ? <Loader2 size={27} className="animate-spin" /> : <QrCode size={27} />}</div>}
                      </div>
                      <p>Откройте Steam Mobile → Steam Guard → Сканировать QR-код</p>
                      {qrError && <p role="alert" className="auth-error">{qrError}</p>}
                      <button type="button" className="auth-refresh" onClick={generateQr} disabled={qrLoading}>Обновить QR-код</button>
                    </div>
                  )}
                  {codeType && (
                    <form onSubmit={submitGuard} className="auth-fields">
                      <p className="auth-guard-title"><Shield size={17} /> Подтверждение Steam Guard</p>
                      <p className="auth-form-description">Введите код из {codeType === 'email' ? 'письма Steam' : 'приложения Steam Mobile'}.</p>
                      <label>Код подтверждения<input type="text" autoComplete="one-time-code" inputMode="text" autoFocus required maxLength={5} value={guardCode} onChange={event => setGuardCode(event.target.value.toUpperCase())} placeholder="XXXXX" /></label>
                      {guardError && <p role="alert" className="auth-error">{guardError}</p>}
                      <button type="submit" className="auth-submit" disabled={guardLoading || !guardCode.trim()}>{guardLoading ? 'Проверяем…' : 'Подтвердить вход'} <ArrowRight size={17} /></button>
                      <button type="button" className="auth-refresh" onClick={() => setCodeType(null)}>Назад к входу</button>
                    </form>
                  )}
                </div>
              )}
            </section>
          </ViewTransition>
        </div>
        <footer className="auth-footer"><span>VAPOR / PRIVATE SPACE</span><span>Steam · Discord</span></footer>
      </div>
    </main>
  );
}

export default LoginModal;
