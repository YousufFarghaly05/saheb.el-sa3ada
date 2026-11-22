import type { OnlineOrder } from '../types.ts';

export type PrintReceiptStatus = 'ready' | 'loading' | 'error';

export const DEFAULT_PRINT_ERROR_AR =
  'تعذر فتح نافذة الطباعة. يرجى التأكد من السماح بالطباعة في المتصفح أو التحقق من اتصال الطابعة ثم المحاولة مرة أخرى.';

export function formatReceiptDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || '';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatReceiptCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe.toLocaleString('en-US')} ج.م`;
}

export function computeOrderAmounts(order: OnlineOrder): {
  subtotal: number;
  deliveryFee: number;
  finalTotal: number;
} {
  const items = Array.isArray(order.items) ? order.items : [];
  const rawItemsSubtotal = items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );
  const finalTotal = Number.isFinite(Number(order.totalAmount))
    ? Number(order.totalAmount)
    : rawItemsSubtotal;

  const subtotal = items.length > 0 ? rawItemsSubtotal : finalTotal;

  const explicitDeliveryFee = (order as OnlineOrder & { deliveryFee?: number }).deliveryFee;
  const deliveryFee =
    typeof explicitDeliveryFee === 'number' && Number.isFinite(explicitDeliveryFee)
      ? Math.max(0, explicitDeliveryFee)
      : finalTotal > subtotal
        ? finalTotal - subtotal
        : 0;

  return { subtotal, deliveryFee, finalTotal };
}
