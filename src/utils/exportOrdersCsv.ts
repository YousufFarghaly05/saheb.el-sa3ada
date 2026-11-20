import type { BranchConfig, Lang, OnlineOrder } from '../types.ts';

function formatCsvTextCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  let str = String(value).replace(/\r\n|\r|\n/g, ' ').trim();
  // Neutralize spreadsheet formula injection on text cells
  if (/^[=+\-@\t]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatCsvNumericCell(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return String(value);
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
        'المجموع الفرعي (ج.م)',
        'الإجمالي شامل الخدمة والضريبة (ج.م)',
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
        'Subtotal (EGP)',
        'Grand Total incl. Service & VAT (EGP)',
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
      return Number.isNaN(d.getTime())
        ? order.createdAt
        : d.toISOString().replace('T', ' ').slice(0, 19);
    })();

    const serviceLabel =
      order.serviceType === 'delivery'
        ? isAr
          ? 'توصيل للمنزل'
          : 'Delivery'
        : isAr
        ? 'استلام من الفرع'
        : 'Takeaway';

    const grandTotalWithTaxes = Math.round(order.totalAmount * 1.12 * 1.14);

    return [
      formatCsvTextCell(order.id),
      formatCsvTextCell(branchName),
      formatCsvTextCell(createdDate),
      formatCsvTextCell(order.customerName),
      formatCsvTextCell(order.phone),
      formatCsvTextCell(serviceLabel),
      formatCsvTextCell(order.address),
      formatCsvTextCell(order.requestedTime),
      formatCsvTextCell(itemsSummary),
      formatCsvNumericCell(order.totalAmount),
      formatCsvNumericCell(grandTotalWithTaxes),
      formatCsvTextCell(paymentMethodLabels[order.paymentMethod] || order.paymentMethod),
      formatCsvTextCell(paymentStatusLabels[order.paymentStatus] || order.paymentStatus),
      formatCsvTextCell(order.transferSender || ''),
      formatCsvTextCell(
        (isAr ? statusLabelsAr[order.status] : statusLabelsEn[order.status]) || order.status
      ),
      formatCsvTextCell(order.notes || ''),
      formatCsvTextCell(order.cancellationReason || ''),
      formatCsvTextCell(order.rating ? `${order.rating}/5` : ''),
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel renders Arabic text cleanly,
  // and separate every order strictly onto its own row using \r\n.
  const headerLine = headers.map(formatCsvTextCell).join(',');
  const csvContent = '\uFEFF' + [headerLine, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `saheb-elsaada-orders-${branchConfig.id}-${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}
