// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CircleDollarSign,
  Wallet,
  Sparkles,
  TrendingUp,
  Layers,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Tag,
  Package,
  History,
  Clock,
  Check,
  Flame,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  ChevronDown,
  X
} from 'lucide-react';
import { GlassCard } from './GlassCard';

export interface InventoryItem {
  id: string;
  name: string;
  market_hash_name: string;
  game: string;
  gameId: number;
  wear: string;
  rarity: string;
  rarityColor: string;
  price: string;
  priceNum: number;
  tradable: boolean;
  image: string;
}

export interface InventoryHistoryItem {
  id: string;
  date: string;
  time: string;
  event: string;
  type: string;
  items?: any[];
}

export interface EconomyStats {
  wallet: string;
  walletBalance: string;
  totalInventoryValue: string;
  inventoryValue: string;
  totalDeposited: string;
  totalSpent: string;
  totalItems: number;
  currency: string | number;
  topValuableItems: InventoryItem[];
}

export interface EconomyMarketSpatialViewProps {
  animKey: number;
  userProfile?: {
    name: string;
    steamId: string;
    wallet?: string;
  };
}

const GAME_FILTER_OPTIONS = [
  { id: 'all', label: 'Все предметы' },
  { id: '730', label: 'CS2' },
  { id: '570', label: 'Dota 2' },
  { id: '440', label: 'TF2' },
  { id: '753', label: 'Карточки Steam' },
  { id: '252490', label: 'Rust' },
];

export const EconomyMarketSpatialView: React.FC<EconomyMarketSpatialViewProps> = ({
  animKey,
  userProfile
}) => {
  const [stats, setStats] = useState<EconomyStats>({
    wallet: userProfile?.wallet ?? '—',
    walletBalance: userProfile?.wallet ?? '—',
    totalInventoryValue: '—',
    inventoryValue: '—',
    totalDeposited: '—',
    totalSpent: '—',
    totalItems: 0,
    currency: '',
    topValuableItems: []
  });

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<InventoryHistoryItem[]>([]);
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'price-desc' | 'price-asc' | 'rarity' | 'name'>('price-desc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sortOpen]);

  const sortOptions = [
    { value: 'price-desc', label: 'По убыванию цены' },
    { value: 'price-asc', label: 'По возрастанию цены' },
    { value: 'rarity', label: 'По ценности/редкости' },
    { value: 'name', label: 'По названию (А-Я)' },
  ];
  const activeSortLabel = sortOptions.find((o) => o.value === sortBy)?.label || 'По убыванию цены';
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load Economy Stats & Inventory Items
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, itemsRes, histRes] = await Promise.all([
        fetch('/api/economy/stats').then((r) => r.json()).catch(() => null),
        fetch('/api/inventory/items?sortBy=price_desc').then((r) => r.json()).catch(() => null),
        fetch('/api/inventory/history').then((r) => r.json()).catch(() => null),
      ]);

      if (statsRes && !statsRes.error) {
        setStats((prev) => ({ ...prev, ...statsRes }));
      }
      if (itemsRes) {
        const rawItems = Array.isArray(itemsRes) ? itemsRes : itemsRes.items || [];
        setItems(rawItems);
      }
      if (histRes && Array.isArray(histRes.history)) {
        setHistory(histRes.history);
      }
    } catch (e) {
      // Keep previous cached state on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [animKey]);

  // Force Rescan of Steam Inventory
  const handleRefreshInventory = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setFeedback('Синхронизация инвентаря с серверами Valve...');
    try {
      const res = await fetch('/api/inventory/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
        if (data.totalValue) {
          setStats((prev) => ({
            ...prev,
            totalInventoryValue: data.totalValue,
            inventoryValue: data.totalValue,
            totalItems: data.totalCount ?? data.items?.length ?? prev.totalItems
          }));
        }
        if (Array.isArray(data.history)) {
          setHistory(data.history);
        }
        setFeedback(`Успешно обновлено: ${data.totalCount || data.items?.length || 0} предметов`);
      } else {
        setFeedback(data.error || 'Не удалось обновить инвентарь');
      }
    } catch (e) {
      setFeedback('Ошибка соединения при синхронизации');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (selectedGameFilter !== 'all') {
          if (String(item.gameId) !== String(selectedGameFilter)) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.name && item.name.toLowerCase().includes(q);
          const matchWear = item.wear && item.wear.toLowerCase().includes(q);
          const matchGame = item.game && item.game.toLowerCase().includes(q);
          if (!matchName && !matchWear && !matchGame) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-desc') return (b.priceNum || 0) - (a.priceNum || 0);
        if (sortBy === 'price-asc') return (a.priceNum || 0) - (b.priceNum || 0);
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'rarity') return (b.priceNum || 0) - (a.priceNum || 0);
        return 0;
      });
  }, [items, selectedGameFilter, searchQuery, sortBy]);

  // Top valuable items for the highlight deck
  const topItems = useMemo(() => {
    if (stats.topValuableItems && stats.topValuableItems.length > 0) {
      return stats.topValuableItems.slice(0, 3);
    }
    return items.slice(0, 3);
  }, [stats.topValuableItems, items]);

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: HEADER PLAQUE & REFRESH ACTION
      ==================================================================== */}
      <GlassCard delay={20} animKey={animKey} className="p-3.5 px-4 shrink-0 flex items-center justify-between gap-4">
        {/* Left: Icon, Title & Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-300 shadow-lg shrink-0">
            <CircleDollarSign className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Экономика и инвентарь Steam
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono font-semibold text-emerald-300">
                MARKET VALUATION
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Оценка скинов, кейсов, коллекционных карточек и предметов инвентаря через Steam Market
            </p>
          </div>
        </div>

        {/* Right: Items counter pill & Live Refresh button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.07] border border-white/15 flex items-center gap-2 font-mono text-xs">
            <Package className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-white/80">
              В инвентаре: <span className="text-amber-300 font-bold">{stats.totalItems || items.length}</span> шт.
            </span>
          </div>

          <button
            onClick={handleRefreshInventory}
            disabled={isRefreshing}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
              isRefreshing
                ? 'bg-amber-500/25 border-amber-400/40 text-amber-200 opacity-80 cursor-wait'
                : 'bg-white/12 hover:bg-white/20 border-white/20 text-white shadow-sm'
            }`}
            title="Синхронизировать инвентарь с серверами Valve"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-300' : 'text-white/80'}`} />
            <span>{isRefreshing ? 'Синхронизация...' : 'Синхронизировать'}</span>
          </button>
        </div>
      </GlassCard>

      {/* Optional Feedback banner */}
      {feedback && (
        <div className="shrink-0 px-4 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-mono flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-white/50 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ====================================================================
          ROW 2: 4 CORE FINANCIAL BENTO CARDS (Wallet, Inv Value, Deposited, Spent)
      ==================================================================== */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {/* Metric 1: Wallet Balance */}
        <GlassCard delay={40} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Баланс кошелька</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-300">
              STEAM WALLET
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-white">
               {userProfile?.wallet || stats.walletBalance || '—'}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span>Доступно в профиле</span>
             <span className="text-emerald-400">{stats.walletBalance && stats.walletBalance !== '—' ? 'Доступен' : 'Нет данных'}</span>
          </div>
        </GlassCard>

        {/* Metric 2: Total Inventory Value */}
        <GlassCard delay={60} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Оценка инвентаря</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-mono text-purple-300">
              PORTFOLIO
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-purple-200">
              {stats.inventoryValue || stats.totalInventoryValue || '0 ₴'}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span>Всего предметов</span>
            <span className="text-purple-300 font-semibold">{stats.totalItems || items.length} шт.</span>
          </div>
        </GlassCard>

        {/* Metric 3: Total Deposited */}
        <GlassCard delay={80} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Всего пополнено</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono text-emerald-300">
              DEPOSITED
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-200">
              {stats.totalDeposited || '0 ₴'}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
             <span>За всё время</span>
             <span className="text-white/60">Нет данных Steam</span>
          </div>
        </GlassCard>

        {/* Metric 4: Total Spent */}
        <GlassCard delay={100} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                <CircleDollarSign className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Всего потрачено</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] font-mono text-sky-300">
              LIFETIME
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-sky-200">
              {stats.totalSpent || '0 ₴'}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
             <span>Игры, маркет и подарки</span>
             <span className="text-sky-300">Нет данных Steam</span>
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 3: INVENTORY CATALOG (8 COLS) + TOP VALUABLE & RECENT HISTORY (4 COLS)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* LEFT COLUMN: INVENTORY ITEMS MATRIX (8 COLS) */}
        <GlassCard delay={120} animKey={animKey} className="col-span-8 p-3.5 px-4 flex flex-col justify-between h-full min-h-0">
          {/* Header & Filter Controls Sub-Row */}
          <div className="space-y-2.5 shrink-0 mb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                    Каталог предметов инвентаря
                  </h3>
                  <p className="text-[11px] font-mono text-white/50 leading-tight">
                    Отображается: {filteredItems.length} из {items.length} предметов
                  </p>
                </div>
              </div>

              {/* Sort Selector Dropdown */}
              <div ref={sortRef} className={`relative flex items-center gap-2 ${sortOpen ? 'z-50' : ''}`}>
                <span className="text-[11px] font-mono text-white/50">Сортировка:</span>
                <button
                  type="button"
                  onClick={() => setSortOpen((v) => !v)}
                  className="bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 rounded-xl px-2.5 py-1 text-xs font-mono text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm select-none"
                >
                  <span>{activeSortLabel}</span>
                  <ChevronDown className={`w-3 h-3 text-white/60 transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`} />
                </button>

                {sortOpen && (
                  <div
                    style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)', isolation: 'isolate' }}
                    className="absolute top-full right-0 mt-1.5 z-50 w-48 rounded-2xl backdrop-blur-3xl bg-[#211e1a]/90 border border-white/30 shadow-[0_24px_64px_rgba(0,0,0,0.95)] p-1.5 flex flex-col overflow-hidden animate-in fade-in duration-150"
                  >
                    {sortOptions.map((opt) => {
                      const isSelected = opt.value === sortBy;
                      return (
                        <div
                          key={opt.value}
                          onClick={() => {
                            setSortBy(opt.value as any);
                            setSortOpen(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-mono flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-500/30 text-white font-medium border border-emerald-400/40'
                              : 'text-white/80 hover:bg-white/15 hover:text-white'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-3 h-3 text-emerald-300" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Search Input & Game Filter Pills */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по названию предмета, скина или редкости..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/15 focus:border-cyan-400/50 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Game Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto shrink-0">
                {GAME_FILTER_OPTIONS.map((opt) => {
                  const isSelected = selectedGameFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedGameFilter(opt.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-semibold shadow-sm'
                          : 'bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scrollable Inventory Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/50">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-300" />
                <span className="text-xs font-mono">Загрузка инвентаря Steam...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/40">
                <Package className="w-8 h-8 opacity-40" />
                <span className="text-xs font-mono">Предметы не найдены</span>
                <span className="text-[11px] font-mono text-white/30">Попробуйте изменить поисковый запрос или фильтр</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pb-1">
                {filteredItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-white/25 p-2.5 flex flex-col justify-between gap-2 transition-all duration-150 group"
                  >
                    {/* Item Thumbnail Frame */}
                    <div className="w-full h-24 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center p-1.5 relative overflow-hidden shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const next = e.currentTarget.nextElementSibling;
                            if (next) next.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`${item.image ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center text-white/25`}>
                        <Package className="w-8 h-8" />
                      </div>

                      {/* Game badge top-left */}
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded-md bg-black/75 border border-white/15 text-[9px] font-mono text-white/70">
                        {item.game}
                      </span>

                      {/* Tradable status dot top-right */}
                      {item.tradable && (
                        <span
                          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black/60"
                          title="Можно передавать и продавать"
                        />
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-200 transition-colors" title={item.name}>
                        {item.name}
                      </h4>
                      <p className="text-[10px] font-mono text-white/45 truncate mt-0.5" title={item.wear}>
                        {item.wear || item.game}
                      </p>
                    </div>

                    {/* Bottom Price & Rarity Tag */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-white/10 mt-auto">
                      <span
                        className="px-1.5 py-0.2 rounded border border-amber-400/40 bg-amber-500/15 text-amber-200 text-[9px] font-mono font-medium truncate max-w-[85px]"
                        title={item.rarity}
                      >
                        {item.rarity}
                      </span>
                      <span className="text-xs font-bold font-mono text-amber-300 shrink-0">
                        {item.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* RIGHT COLUMN: TOP VALUABLE SKINS & RECENT INVENTORY HISTORY (4 COLS) */}
        <div className="col-span-4 flex flex-col gap-3 h-full min-h-0">
          {/* Top Valuables Plaque */}
          <GlassCard delay={140} animKey={animKey} className="p-3.5 px-4 flex flex-col justify-between flex-1 min-h-0">
            <div className="flex items-center justify-between shrink-0 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                    Топ ценных предметов
                  </h3>
                  <p className="text-[10px] font-mono text-white/50 leading-tight">
                    Наиболее дорогие позиции профиля
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-300">
                TOP 3
              </span>
            </div>

            {/* Top Items List */}
            <div className="flex flex-col justify-between flex-1 gap-2 min-h-0">
              {topItems.map((item, idx) => (
                <div
                  key={`${item.id}-top-${idx}`}
                  className="flex-1 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 hover:border-white/25 px-3 py-1.5 flex items-center justify-between gap-3 transition-all duration-150"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <Package className="w-4 h-4 text-white/30" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-white truncate max-w-[140px]" title={item.name}>
                        {item.name}
                      </h5>
                      <span className="text-[10px] font-mono text-white/50 truncate block">
                        {item.game} • {item.wear}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <div className="text-xs font-bold text-amber-300">{item.price}</div>
                    <span className="text-[9px] text-emerald-400">В наличии</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Recent Inventory History Ticker */}
          <GlassCard delay={160} animKey={animKey} className="p-3.5 px-4 flex flex-col justify-between flex-1 min-h-0">
            <div className="flex items-center justify-between shrink-0 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                    История инвентаря
                  </h3>
                  <p className="text-[10px] font-mono text-white/50 leading-tight">
                    Последние операции Steam
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-white/40">
                {history.length} записей
              </span>
            </div>

            {/* History List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-white/40 text-[11px] font-mono">
                  История операций пуста
                </div>
              ) : (
                history.slice(0, 5).map((h, i) => (
                  <div
                    key={h.id || i}
                    className="p-1.5 px-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between text-[11px] font-mono"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-white/80 font-medium truncate block">
                        {h.event || 'Операция с предметом'}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {h.date} {h.time ? `• ${h.time}` : ''}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/70 shrink-0 font-semibold">
                      {h.type || 'Steam'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
