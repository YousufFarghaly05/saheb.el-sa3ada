import * as XLSX from 'xlsx';
import type { BranchConfig, Lang, OnlineOrder } from '../types.ts';

function sanitizeExcelText(value: string | undefined | null): string {
  if (!value) return '';
  const cleaned = String(value).replace(/\r\n|\r|\n/g, ' ').trim();
  // Neutralize spreadsheet formula injection on dynamic text cells
  if (/^[=+\-@\t]/.test(cleaned)) {
    return `'${cleaned}`;
  }
  return cleaned;
}

const STATUS_LABELS_AR: Record<OnlineOrder['status'], string> = {
  pending: 'جديد / قيد المراجعة',
  preparing: 'قيد التحضير',
  confirmed: 'تم التأكيد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

function formatOrderTimestamp(rawIso: string): string {
  const date = new Date(rawIso);
  if (Number.isNaN(date.getTime())) return rawIso || '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function exportOrdersToExcel(
  orders: OnlineOrder[],
  branchConfig: BranchConfig,
  _lang?: Lang,
  branchConfigs?: Record<string, BranchConfig>
): boolean {
  if (!orders.length) return false;

  const defaultBranchName = branchConfig.shortNameAr || branchConfig.nameAr || branchConfig.id;

  const rows = orders.map((order) => {
    const orderBranchCfg =
      order.branchId && branchConfigs?.[order.branchId]
        ? branchConfigs[order.branchId]
        : null;
    const branchName = orderBranchCfg
      ? orderBranchCfg.shortNameAr || orderBranchCfg.nameAr || orderBranchCfg.id
      : defaultBranchName;

    const itemsSummary = order.items
      .map((item) => {
        const title = item.titleAr || item.titleEn || '';
        return `${title} (x${item.quantity})`;
      })
      .join(' - ');

    const addressText =
      order.serviceType === 'takeaway' && !order.address?.trim()
        ? 'استلام من الفرع'
        : order.address || '';

    return {
      'رقم الطلب': sanitizeExcelText(order.id),
      'التاريخ والوقت': formatOrderTimestamp(order.createdAt),
      'الفرع': sanitizeExcelText(branchName),
      'اسم العميل': sanitizeExcelText(order.customerName),
      'رقم الهاتف': sanitizeExcelText(order.phone),
      'العنوان': sanitizeExcelText(addressText),
      'الأصناف': sanitizeExcelText(itemsSummary),
      'الإجمالي': typeof order.totalAmount === 'number' && Number.isFinite(order.totalAmount)
        ? order.totalAmount
        : 0,
      'الحالة': STATUS_LABELS_AR[order.status] || order.status,
      'ملاحظات': sanitizeExcelText(order.notes || ''),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 18 }, // رقم الطلب
    { wch: 20 }, // التاريخ والوقت
    { wch: 18 }, // الفرع
    { wch: 22 }, // اسم العميل
    { wch: 16 }, // رقم الهاتف
    { wch: 32 }, // العنوان
    { wch: 44 }, // الأصناف
    { wch: 14 }, // الإجمالي
    { wch: 18 }, // الحالة
    { wch: 28 }, // ملاحظات
  ];

  // Enable Right-to-Left layout for Arabic Excel display
  (ws as XLSX.WorkSheet & { '!views'?: Array<{ rightToLeft: boolean }> })['!views'] = [
    { rightToLeft: true },
  ];

  const wb = XLSX.utils.book_new();
  wb.Workbook = {
    Views: [{ RTL: true }],
  };
  XLSX.utils.book_append_sheet(wb, ws, 'الطلبات');
  XLSX.writeFile(wb, 'saheb-el-saada-orders.xlsx');

  return true;
}
