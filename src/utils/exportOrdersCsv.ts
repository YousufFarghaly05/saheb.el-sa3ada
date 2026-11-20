import type { BranchConfig, Lang, OnlineOrder } from '../types.ts';

function sanitizeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  let str = String(value).replace(/\r?\n/g, ' ').trim();
  // Prevent spreadsheet formula injection while preserving pure numeric values
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportOrdersToCsv(
  orders: OnlineOrder[],
  branchConfig: BranchConfig,
  lang: Lang
): boolean {
  if (!orders.length) return false;

  const isAr = lang === 'ar';
  const headers = isAr
    ? [
        'رقم الطلب',
        'الفرع',
        'تاريخ ووقت الإنشاء',
        'اسم العميل',
        'رقم الهاتف',
        'نوع الخدمة',
        'العنوان',
        'الموعد المطلوب',
        'الأصناف',
        'الإجمالي (ج.م)',
        'طريقة الدفع',
        'حالة الدفع',
        'رقم/حساب التحويل',
        'حالة الطلب',
        'ملاحظات',
        'سبب الإلغاء',
        'التقييم',
      ]
    : [
        'Order ID',
        'Branch',
        'Created At',
        'Customer Name',
        'Phone',
        'Service Type',
        'Address',
        'Requested Time',
        'Items',
        'Total (EGP)',
        'Payment Method',
        'Payment Status',
        'Transfer Sender',
        'Order Status',
        'Notes',
        'Cancellation Reason',
        'Rating',
      ];

  const statusLabelsAr: Record<OnlineOrder['status'], string> = {
    pending: 'قيد المراجعة',
    preparing: 'قيد التجهيز',
    confirmed: 'تم التأكيد',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };

  const statusLabelsEn: Record<OnlineOrder['status'], string> = {
    pending: 'Pending',
    preparing: 'Preparing',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  const paymentMethodLabels = isAr
    ? {
        cash_on_delivery: 'الدفع عند الاستلام',
        instapay_vodafone: 'تحويل فوري (فودافون كاش / إنستاباي)',
      }
    : {
        cash_on_delivery: 'Cash / POS on Delivery',
        instapay_vodafone: 'Instant Transfer (Vodafone Cash / InstaPay)',
      };

  const paymentStatusLabels = isAr
    ? {
        pending_cod: 'عند الاستلام',
        transfer_submitted: 'تم إرسال التحويل',
        paid: 'مدفوع',
      }
    : {
        pending_cod: 'Pending COD',
        transfer_submitted: 'Transfer Submitted',
        paid: 'Paid',
      };

  const branchName = isAr ? branchConfig.shortNameAr : branchConfig.shortNameEn;

  const rows = orders.map((order) => {
    const itemsSummary = order.items
      .map((item) => {
        const title = isAr ? item.titleAr : item.titleEn || item.titleAr;
        return `${title} x${item.quantity} (${item.price * item.quantity})`;
      })
      .join(' | ');

    const createdDate = (() => {
      const d = new Date(order.createdAt);
      return Number.isNaN(d.getTime()) ? order.createdAt : d.toISOString().replace('T', ' ').slice(0, 19);
    })();

    const serviceLabel =
      order.serviceType === 'delivery'
        ? isAr
          ? 'توصيل للمنزل'
          : 'Delivery'
        : isAr
        ? 'استلام من الفرع'
        : 'Takeaway';

    const cells: Array<string | number | undefined> = [
      order.id,
      branchName,
      createdDate,
      order.customerName,
      order.phone,
      serviceLabel,
      order.address,
      order.requestedTime,
      itemsSummary,
      order.totalAmount,
      paymentMethodLabels[order.paymentMethod] || order.paymentMethod,
      paymentStatusLabels[order.paymentStatus] || order.paymentStatus,
      order.transferSender || '',
      (isAr ? statusLabelsAr[order.status] : statusLabelsEn[order.status]) || order.status,
      order.notes || '',
      order.cancellationReason || '',
      order.rating ? `${order.rating}/5` : '',
    ];

    return cells.map(sanitizeCsvCell).join(',');
  });

  // Prepend UTF-8 BOM so Excel renders Arabic text cleanly
  const csvContent = '\uFEFF' + [headers.map(sanitizeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders-${branchConfig.id}-${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}
