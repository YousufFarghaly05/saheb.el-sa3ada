import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { BarChart3, ShoppingBag, Wallet, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import type { BookingStatus, Lang, OnlineOrder } from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';

interface CustomerOrderMiniDashboardProps {
  orders: OnlineOrder[];
  lang: Lang;
}

const STATUS_CHART_COLORS: Record<BookingStatus, string> = {
  pending: '#FBBF24',
  confirmed: '#818CF8',
  preparing: '#38BDF8',
  completed: '#10B981',
  cancelled: '#EF4444',
};

export const CustomerOrderMiniDashboard: React.FC<CustomerOrderMiniDashboardProps> = ({
  orders,
  lang,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const t = getTranslations(lang).auth;
  const currency = lang === 'ar' ? 'ج.م' : 'EGP';

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'cancelled');
    const totalSpent = activeOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const avgSpend = activeOrders.length > 0 ? Math.round(totalSpent / activeOrders.length) : 0;
    const cancelledCount = orders.length - activeOrders.length;

    return {
      totalCount: orders.length,
      activeCount: activeOrders.length,
      cancelledCount,
      totalSpent,
      avgSpend,
    };
  }, [orders]);

  const spendingChartData = useMemo(() => {
    // Chronological order (oldest -> newest) for up to 8 recent orders
    return [...orders]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-8)
      .map((o) => {
        const shortId = o.id.includes('-') ? `#${o.id.split('-').pop()}` : `#${o.id}`;
        let shortDate = '';
        try {
          shortDate = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
            month: 'short',
            day: 'numeric',
          }).format(new Date(o.createdAt));
        } catch {
          shortDate = '';
        }
        return {
          id: o.id,
          label: shortDate ? `${shortId}` : shortId,
          fullDate: shortDate,
          amount: Number(o.totalAmount) || 0,
          status: o.status,
          statusLabel: t.orderStatuses[o.status] || o.status,
          color: o.status === 'cancelled' ? '#EF4444' : o.status === 'completed' ? '#10B981' : '#D4AF37',
          isCancelled: o.status === 'cancelled',
        };
      });
  }, [orders, lang, t.orderStatuses]);

  const statusBreakdownData = useMemo(() => {
    const counts: Record<BookingStatus, number> = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });

    return (Object.keys(counts) as BookingStatus[])
      .filter((key) => counts[key] > 0)
      .map((key) => ({
        status: key,
        name: t.orderStatuses[key] || key,
        value: counts[key],
        color: STATUS_CHART_COLORS[key],
      }));
  }, [orders, t.orderStatuses]);

  if (orders.length === 0) return null;

  return (
    <div className="bg-[#121212] border border-[#D4AF37]/35 p-4 space-y-3.5">
      {/* Mini Dashboard Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#D4AF37]/15 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h5 className="text-xs sm:text-sm font-bold text-[#F7F3E9]">
              {lang === 'ar' ? 'ملخص طلباتك وإنفاقك' : 'Your Orders & Spending Summary'}
            </h5>
            <p className="text-[10px] text-[#9E9585]">
              {lang === 'ar'
                ? 'تحليل سريع لإجمالي الطلبات وتكلفة الإنفاق'
                : 'Quick overview of total order count & spending'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="px-2.5 py-1 bg-[#1E1E1E] border border-[#D4AF37]/30 hover:border-[#D4AF37] text-[#C9C1B1] hover:text-[#D4AF37] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>
            {collapsed
              ? lang === 'ar'
                ? 'عرض الإحصائيات'
                : 'Show Stats'
              : lang === 'ar'
                ? 'إخفاء'
                : 'Hide'}
          </span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#181818] border border-[#D4AF37]/25 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#C9C1B1] mb-1">
            <span className="truncate">
              {lang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}
            </span>
            <ShoppingBag className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#F7F3E9]">
            {stats.totalCount}
          </p>
          {stats.cancelledCount > 0 && (
            <p className="text-[10px] text-[#9E9585] mt-0.5 truncate">
              {lang === 'ar'
                ? `${stats.activeCount} نشط · ${stats.cancelledCount} ملغي`
                : `${stats.activeCount} active · ${stats.cancelledCount} cancelled`}
            </p>
          )}
        </div>

        <div className="bg-[#181818] border border-[#D4AF37]/25 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#C9C1B1] mb-1">
            <span className="truncate">
              {lang === 'ar' ? 'إجمالي الإنفاق' : 'Total Spent'}
            </span>
            <Wallet className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#D4AF37] truncate">
            {stats.totalSpent.toLocaleString()}{' '}
            <span className="text-[10px] sm:text-xs font-sans">{currency}</span>
          </p>
          <p className="text-[10px] text-[#9E9585] mt-0.5 truncate">
            {lang === 'ar' ? 'باستثناء الملغاة' : 'Excl. cancelled'}
          </p>
        </div>

        <div className="bg-[#181818] border border-[#D4AF37]/25 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#C9C1B1] mb-1">
            <span className="truncate">
              {lang === 'ar' ? 'متوسط الطلب' : 'Avg. Order'}
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#F7F3E9] truncate">
            {stats.avgSpend.toLocaleString()}{' '}
            <span className="text-[10px] sm:text-xs text-[#D4AF37] font-sans">{currency}</span>
          </p>
          <p className="text-[10px] text-[#9E9585] mt-0.5 truncate">
            {lang === 'ar' ? 'لكل طلب' : 'Per order'}
          </p>
        </div>
      </div>

      {/* Recharts Visualizations */}
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Bar Chart: Spending per Order */}
          <div className="sm:col-span-7 bg-[#181818] border border-[#D4AF37]/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#D4AF37]">
                {lang === 'ar' ? 'تكلفة كل طلب' : 'Spend per Order'}
              </span>
              <span className="text-[10px] text-[#9E9585]">
                {lang === 'ar'
                  ? `آخر ${spendingChartData.length} طلبات`
                  : `Last ${spendingChartData.length} orders`}
              </span>
            </div>
            <div className="h-36 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={spendingChartData}
                  margin={{ top: 6, right: 6, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke="#2E2A22" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#C9C1B1', fontSize: 10 }}
                    axisLine={{ stroke: '#3A3429' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9E9585', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(212, 175, 55, 0.08)' }}
                    contentStyle={{
                      backgroundColor: '#121212',
                      border: '1px solid #D4AF37',
                      color: '#F7F3E9',
                      fontSize: '11px',
                    }}
                    formatter={(value: unknown, _name: unknown, entry: { payload?: { statusLabel?: string } }) => [
                      `${Number(value || 0).toLocaleString()} ${currency} (${entry?.payload?.statusLabel || ''})`,
                      lang === 'ar' ? 'الإجمالي' : 'Total',
                    ]}
                    labelFormatter={(label: unknown, payload) => {
                      const item = payload?.[0]?.payload as { id?: string; fullDate?: string } | undefined;
                      return item?.fullDate ? `#${item.id} · ${item.fullDate}` : String(label || '');
                    }}
                  />
                  <Bar dataKey="amount" radius={[2, 2, 0, 0]} maxBarSize={32}>
                    {spendingChartData.map((entry) => (
                      <Cell
                        key={`spend-bar-${entry.id}`}
                        fill={entry.color}
                        fillOpacity={entry.isCancelled ? 0.45 : 0.92}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut PieChart: Orders Breakdown */}
          <div className="sm:col-span-5 bg-[#181818] border border-[#D4AF37]/20 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-[#D4AF37]">
                {lang === 'ar' ? 'توزيع حالات الطلبات' : 'Orders by Status'}
              </span>
            </div>

            <div className="relative h-28 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdownData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={44}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {statusBreakdownData.map((entry) => (
                      <Cell key={`pie-${entry.status}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#121212',
                      border: '1px solid #D4AF37',
                      color: '#F7F3E9',
                      fontSize: '11px',
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      `${value} ${lang === 'ar' ? 'طلب' : 'orders'}`,
                      String(name || ''),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold font-mono text-[#F7F3E9] leading-none">
                  {stats.totalCount}
                </span>
                <span className="text-[9px] text-[#9E9585] mt-0.5">
                  {lang === 'ar' ? 'طلب' : 'Orders'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 justify-center">
              {statusBreakdownData.map((entry) => (
                <div key={`legend-${entry.status}`} className="flex items-center gap-1 text-[10px]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[#C9C1B1]">{entry.name}</span>
                  <span className="font-mono font-bold text-[#F7F3E9]">({entry.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
