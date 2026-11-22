import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  ShoppingBag,
  Award,
  CalendarDays,
  BarChart3,
  Utensils,
} from 'lucide-react';
import type {
  BranchConfig,
  BranchId,
  DualBranchStoreState,
  Lang,
  MenuCategory,
  MenuItem,
  OnlineOrder,
} from '../types.ts';
import { BRANCH_CONFIGS, BRANCH_ORDER } from '../data/initialData.ts';

interface BranchAnalyticsPanelProps {
  lang: Lang;
  adminBranch: BranchId;
  branchConfig: BranchConfig;
  branchConfigs?: Record<BranchId, BranchConfig>;
  stores: DualBranchStoreState;
  orders: OnlineOrder[];
  menu: MenuItem[];
}

type TrendGranularity = 'daily' | 'weekly';

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Saturday as start of week for Egyptian hospitality calendar (or Monday fallback)
  const day = copy.getDay(); // 0=Sun..6=Sat
  const diffToSat = (day + 1) % 7;
  copy.setDate(copy.getDate() - diffToSat);
  return copy;
}

const CATEGORY_COLORS: Record<MenuCategory, string> = {
  mains: '#D4AF37',
  appetizers: '#10B981',
  drinks_desserts: '#E69F45',
  shisha: '#8B5CF6',
};

export const BranchAnalyticsPanel: React.FC<BranchAnalyticsPanelProps> = ({
  lang,
  adminBranch,
  branchConfig,
  branchConfigs = BRANCH_CONFIGS,
  stores,
  orders,
  menu,
}) => {
  const [granularity, setGranularity] = useState<TrendGranularity>('daily');
  const currency = lang === 'ar' ? 'ج.م' : 'EGP';
  const branchShort = lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn;

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled'),
    [orders]
  );

  const totalRevenue = useMemo(
    () => activeOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
    [activeOrders]
  );

  const avgOrderValue = useMemo(
    () => (activeOrders.length > 0 ? Math.round(totalRevenue / activeOrders.length) : 0),
    [activeOrders.length, totalRevenue]
  );

  // Anchor rolling window to the latest date between today and the most recent branch order
  const anchorDate = useMemo(() => {
    let latest = new Date();
    latest = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate());
    for (const o of activeOrders) {
      const parsed = new Date(o.createdAt);
      if (!Number.isNaN(parsed.getTime())) {
        const dayOnly = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        if (dayOnly > latest) {
          latest = dayOnly;
        }
      }
    }
    return latest;
  }, [activeOrders]);

  const dailyData = useMemo(() => {
    const bucketMap = new Map<
      string,
      { key: string; label: string; revenue: number; orders: number }
    >();

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() - offset);
      const key = toDayKey(d);
      const label = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      bucketMap.set(key, { key, label, revenue: 0, orders: 0 });
    }

    for (const order of activeOrders) {
      const parsed = new Date(order.createdAt);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = toDayKey(parsed);
      const bucket = bucketMap.get(key);
      if (bucket) {
        bucket.revenue += Number(order.totalAmount) || 0;
        bucket.orders += 1;
      }
    }

    return Array.from(bucketMap.values());
  }, [activeOrders, anchorDate, lang]);

  const weeklyData = useMemo(() => {
    const currentWeekStart = getStartOfWeek(anchorDate);
    const buckets: { start: Date; key: string; label: string; revenue: number; orders: number }[] =
      [];

    for (let w = 3; w >= 0; w--) {
      const start = new Date(currentWeekStart);
      start.setDate(currentWeekStart.getDate() - w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startLabel = start.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        day: 'numeric',
        month: 'short',
      });
      const endLabel = end.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        day: 'numeric',
        month: 'short',
      });
      buckets.push({
        start,
        key: toDayKey(start),
        label: `${startLabel} – ${endLabel}`,
        revenue: 0,
        orders: 0,
      });
    }

    for (const order of activeOrders) {
      const parsed = new Date(order.createdAt);
      if (Number.isNaN(parsed.getTime())) continue;
      const orderWeekStart = toDayKey(getStartOfWeek(parsed));
      const match = buckets.find((b) => b.key === orderWeekStart);
      if (match) {
        match.revenue += Number(order.totalAmount) || 0;
        match.orders += 1;
      }
    }

    return buckets.map(({ label, revenue, orders: count }) => ({
      label,
      revenue,
      orders: count,
    }));
  }, [activeOrders, anchorDate, lang]);

  const popularItemsData = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        quantity: number;
        revenue: number;
      }
    >();

    for (const order of activeOrders) {
      for (const item of order.items) {
        const displayName = lang === 'ar' ? item.titleAr : item.titleEn || item.titleAr;
        const existing = map.get(item.menuItemId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.price * item.quantity;
        } else {
          map.set(item.menuItemId, {
            id: item.menuItemId,
            name: displayName,
            quantity: item.quantity,
            revenue: item.price * item.quantity,
          });
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 6);
  }, [activeOrders, lang]);

  const categoryBreakdownData = useMemo(() => {
    const labels: Record<MenuCategory, string> = {
      mains: lang === 'ar' ? 'أطباق رئيسية' : 'Mains',
      appetizers: lang === 'ar' ? 'مقبلات' : 'Appetizers',
      drinks_desserts: lang === 'ar' ? 'مشروبات وحلويات' : 'Drinks & Desserts',
      shisha: lang === 'ar' ? 'أصناف خاصة' : 'Specialties',
    };

    const counts: Record<MenuCategory, { total: number; popular: number }> = {
      mains: { total: 0, popular: 0 },
      appetizers: { total: 0, popular: 0 },
      drinks_desserts: { total: 0, popular: 0 },
      shisha: { total: 0, popular: 0 },
    };

    for (const item of menu) {
      const bucket = counts[item.category];
      if (!bucket) continue;
      bucket.total += 1;
      if (item.popular || item.featured || item.tags?.includes('popular')) {
        bucket.popular += 1;
      }
    }

    return (['mains', 'appetizers', 'drinks_desserts'] as MenuCategory[]).map((cat) => ({
      category: cat,
      name: labels[cat],
      total: counts[cat].total,
      popular: counts[cat].popular,
      color: CATEGORY_COLORS[cat],
    }));
  }, [menu, lang]);

  const branchComparisonData = useMemo(() => {
    return BRANCH_ORDER.map((bId) => {
      const cfg = branchConfigs[bId];
      const bOrders = (stores[bId]?.orders || []).filter((o) => o.status !== 'cancelled');
      const rev = bOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      return {
        branchId: bId,
        name: lang === 'ar' ? cfg.shortNameAr : cfg.shortNameEn,
        revenue: rev,
        orders: bOrders.length,
        isActive: bId === adminBranch,
      };
    });
  }, [adminBranch, branchConfigs, lang, stores]);

  const trendChartData = granularity === 'daily' ? dailyData : weeklyData;
  const topDish = popularItemsData[0];

  return (
    <div className="space-y-6">
      {/* Header + Granularity Switcher */}
      <div className="bg-[#1E1E1E] border border-[#D4AF37]/40 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 bg-[#121212] border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display-serif text-xl sm:text-2xl font-bold text-[#D4AF37]">
              {lang === 'ar'
                ? `التحليلات ومؤشرات الإيرادات — ${branchShort}`
                : `Revenue Trends & Menu Analytics — ${branchShort}`}
            </h2>
            <p className="text-xs sm:text-sm text-[#C9C1B1] mt-1">
              {lang === 'ar'
                ? 'متابعة فورية لاتجاهات الإيرادات اليومية والأسبوعية والأصناف الأكثر طلباً لكل فرع.'
                : 'Live insights into daily and weekly revenue trends and top-ordered dishes per branch.'}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label={lang === 'ar' ? 'نطاق التحليل الزمني' : 'Timeframe Toggle'}
          className="inline-flex bg-[#121212] border border-[#D4AF37]/40 p-1 shrink-0 self-start md:self-center"
        >
          <button
            type="button"
            onClick={() => setGranularity('daily')}
            className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              granularity === 'daily'
                ? 'bg-[#D4AF37] text-[#121212]'
                : 'text-[#C9C1B1] hover:text-[#F7F3E9]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'يومي (آخر ٧ أيام)' : 'Daily (7 Days)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setGranularity('weekly')}
            className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              granularity === 'weekly'
                ? 'bg-[#D4AF37] text-[#121212]'
                : 'text-[#C9C1B1] hover:text-[#F7F3E9]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'أسبوعي (٤ أسابيع)' : 'Weekly (4 Weeks)'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-4">
          <div className="flex items-center justify-between text-xs text-[#C9C1B1] mb-1">
            <span>{lang === 'ar' ? 'إجمالي إيرادات الطلبات' : 'Active Orders Revenue'}</span>
            <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#D4AF37]">
            {totalRevenue.toLocaleString()} <span className="text-xs">{currency}</span>
          </p>
        </div>

        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-4">
          <div className="flex items-center justify-between text-xs text-[#C9C1B1] mb-1">
            <span>{lang === 'ar' ? 'متوسط قيمة الطلب' : 'Avg. Order Value'}</span>
            <ShoppingBag className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#F7F3E9]">
            {avgOrderValue.toLocaleString()} <span className="text-xs text-[#D4AF37]">{currency}</span>
          </p>
        </div>

        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-4">
          <div className="flex items-center justify-between text-xs text-[#C9C1B1] mb-1">
            <span>{lang === 'ar' ? 'الطلبات النشطة' : 'Active Orders'}</span>
            <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#F7F3E9]">
            {activeOrders.length}
          </p>
        </div>

        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-4">
          <div className="flex items-center justify-between text-xs text-[#C9C1B1] mb-1">
            <span>{lang === 'ar' ? 'الأكثر طلباً بالفرع' : 'Top Ordered Dish'}</span>
            <Award className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-sm sm:text-base font-bold text-[#F7F3E9] truncate">
            {topDish
              ? topDish.name
              : lang === 'ar'
              ? 'بانتظار طلبات جديدة'
              : 'No orders yet'}
          </p>
          {topDish && (
            <span className="text-[11px] font-mono text-[#10B981]">
              {topDish.quantity}× · {topDish.revenue.toLocaleString()} {currency}
            </span>
          )}
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily / Weekly Revenue AreaChart */}
        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#D4AF37]">
                {granularity === 'daily'
                  ? lang === 'ar'
                    ? 'منحنى الإيرادات اليومية (٧ أيام)'
                    : 'Daily Revenue Trend (7 Days)'
                  : lang === 'ar'
                  ? 'منحنى الإيرادات الأسبوعية (٤ أسابيع)'
                  : 'Weekly Revenue Trend (4 Weeks)'}
              </h3>
              <p className="text-xs text-[#9E9585]">
                {lang === 'ar'
                  ? `إجمالي المبيعات (${currency}) لفرع ${branchShort}`
                  : `Order revenue (${currency}) for ${branchShort}`}
              </p>
            </div>
          </div>

          <div className="h-[290px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 14, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="goldRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(212,175,55,0.14)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  stroke="#9E9585"
                  tick={{ fill: '#C9C1B1', fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9E9585"
                  tick={{ fill: '#C9C1B1', fontSize: 11 }}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as {
                      revenue: number;
                      orders: number;
                    };
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="bg-[#121212] border border-[#D4AF37] px-3.5 py-2.5 text-xs shadow-xl space-y-1"
                      >
                        <div className="font-bold text-[#D4AF37]">{label}</div>
                        <div className="text-[#F7F3E9] font-mono">
                          {lang === 'ar' ? 'الإيرادات:' : 'Revenue:'}{' '}
                          <span className="font-bold text-[#D4AF37]">
                            {row.revenue.toLocaleString()} {currency}
                          </span>
                        </div>
                        <div className="text-[#C9C1B1] font-mono">
                          {lang === 'ar' ? 'عدد الطلبات:' : 'Orders:'}{' '}
                          <span className="font-bold text-[#10B981]">{row.orders}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#D4AF37"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#goldRevenueGradient)"
                  activeDot={{ r: 5, fill: '#D4AF37', stroke: '#121212', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Most Popular Menu Items (Ordered Quantities) */}
        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#D4AF37]">
                {lang === 'ar'
                  ? `الأصناف الأكثر طلباً — ${branchShort}`
                  : `Most Popular Ordered Items — ${branchShort}`}
              </h3>
              <p className="text-xs text-[#9E9585]">
                {lang === 'ar'
                  ? 'مرتبة حسب عدد مرات الطلب وإجمالي المبيعات'
                  : 'Ranked by total units ordered and revenue generated'}
              </p>
            </div>
          </div>

          {popularItemsData.length === 0 ? (
            <div className="h-[290px] flex flex-col items-center justify-center text-center border border-dashed border-[#D4AF37]/25 p-6">
              <Utensils className="w-8 h-8 text-[#D4AF37]/40 mb-2" />
              <p className="text-sm text-[#C9C1B1]">
                {lang === 'ar'
                  ? 'لا توجد طلبات مسجلة لهذا الفرع بعد لعرض الأصناف الأكثر مبيعاً.'
                  : 'No active orders recorded for this branch yet.'}
              </p>
            </div>
          ) : (
            <div className="h-[290px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={popularItemsData}
                  layout="vertical"
                  margin={{ top: 6, right: 20, left: 10, bottom: 6 }}
                >
                  <CartesianGrid stroke="rgba(212,175,55,0.12)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke="#9E9585"
                    tick={{ fill: '#C9C1B1', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={145}
                    stroke="#9E9585"
                    tick={{ fill: '#F7F3E9', fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload as {
                        name: string;
                        quantity: number;
                        revenue: number;
                      };
                      return (
                        <div
                          dir={lang === 'ar' ? 'rtl' : 'ltr'}
                          className="bg-[#121212] border border-[#D4AF37] px-3.5 py-2.5 text-xs shadow-xl space-y-1"
                        >
                          <div className="font-bold text-[#D4AF37]">{item.name}</div>
                          <div className="text-[#F7F3E9] font-mono">
                            {lang === 'ar' ? 'الكمية المطلوبة:' : 'Units Ordered:'}{' '}
                            <span className="font-bold text-[#10B981]">{item.quantity}</span>
                          </div>
                          <div className="text-[#C9C1B1] font-mono">
                            {lang === 'ar' ? 'إجمالي الإيراد:' : 'Revenue:'}{' '}
                            <span className="font-bold text-[#D4AF37]">
                              {item.revenue.toLocaleString()} {currency}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="quantity" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {popularItemsData.map((entry, idx) => (
                      <Cell
                        key={entry.id}
                        fill={idx === 0 ? '#D4AF37' : idx === 1 ? '#10B981' : '#C99E32'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Cross-Branch Revenue Comparison & Branch Menu Catalog Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch-by-Branch Revenue Comparison */}
        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="font-bold text-base sm:text-lg text-[#D4AF37]">
              {lang === 'ar' ? 'مقارنة إيرادات الفروع الثلاثة' : '3-Branch Revenue Comparison'}
            </h3>
            <p className="text-xs text-[#9E9585]">
              {lang === 'ar'
                ? 'الفرع النشط مُميَّز باللون الذهبي للمقارنة السريعة'
                : 'Currently managed branch is highlighted in gold'}
            </p>
          </div>
          <div className="h-[250px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchComparisonData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(212,175,55,0.12)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#9E9585"
                  tick={{ fill: '#F7F3E9', fontSize: 11 }}
                />
                <YAxis
                  stroke="#9E9585"
                  tick={{ fill: '#C9C1B1', fontSize: 11 }}
                  width={56}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as {
                      name: string;
                      revenue: number;
                      orders: number;
                    };
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="bg-[#121212] border border-[#D4AF37] px-3.5 py-2.5 text-xs shadow-xl space-y-1"
                      >
                        <div className="font-bold text-[#D4AF37]">{row.name}</div>
                        <div className="text-[#F7F3E9] font-mono">
                          {row.revenue.toLocaleString()} {currency}
                        </div>
                        <div className="text-[#10B981] font-mono">
                          {row.orders} {lang === 'ar' ? 'طلب' : 'orders'}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  {branchComparisonData.map((entry) => (
                    <Cell
                      key={entry.branchId}
                      fill={entry.isActive ? '#D4AF37' : '#574C32'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Branch Menu Catalog & Signature Dishes Breakdown */}
        <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="font-bold text-base sm:text-lg text-[#D4AF37]">
              {lang === 'ar'
                ? `توزيع قائمة الطعام والأصناف المميزة — ${branchShort}`
                : `Menu Catalog & Signature Mix — ${branchShort}`}
            </h3>
            <p className="text-xs text-[#9E9585]">
              {lang === 'ar'
                ? 'إجمالي الأصناف مقابل الأصناف المميزة/الأكثر طلباً في كل قسم'
                : 'Total dishes vs. featured/popular dishes per menu category'}
            </p>
          </div>
          <div className="h-[250px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdownData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(212,175,55,0.12)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#9E9585"
                  tick={{ fill: '#F7F3E9', fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#9E9585"
                  tick={{ fill: '#C9C1B1', fontSize: 11 }}
                  width={42}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as {
                      name: string;
                      total: number;
                      popular: number;
                    };
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="bg-[#121212] border border-[#D4AF37] px-3.5 py-2.5 text-xs shadow-xl space-y-1"
                      >
                        <div className="font-bold text-[#D4AF37]">{row.name}</div>
                        <div className="text-[#F7F3E9] font-mono">
                          {lang === 'ar' ? 'إجمالي الأصناف:' : 'Total Dishes:'} {row.total}
                        </div>
                        <div className="text-[#10B981] font-mono">
                          {lang === 'ar' ? 'الأكثر طلباً/المميزة:' : 'Popular / Featured:'}{' '}
                          {row.popular}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="total"
                  name={lang === 'ar' ? 'إجمالي الأصناف' : 'Total Dishes'}
                  fill="#D4AF37"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                />
                <Bar
                  dataKey="popular"
                  name={lang === 'ar' ? 'الأكثر طلباً' : 'Popular'}
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
