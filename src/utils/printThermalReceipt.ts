import type { BranchConfig, OnlineOrder } from '../types.ts';

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReceiptDateTime(iso: string): string {
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

function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe.toLocaleString('en-US')} ج.م`;
}

export function buildThermalReceiptHtml(order: OnlineOrder, branchConfig: BranchConfig): string {
  const restaurantName = 'مطعم وكافيه صاحب السعادة';
  const branchName = branchConfig.shortNameAr || branchConfig.nameAr || '';
  const branchPhone = branchConfig.phone || '';
  const formattedDate = formatReceiptDateTime(order.createdAt);
  const isDelivery = order.serviceType === 'delivery';
  const orderTypeLabel = isDelivery
    ? 'دليفري — توصيل للمنزل'
    : 'تيك أواي — استلام من الفرع';

  const paymentLabel =
    order.paymentMethod === 'instapay_vodafone'
      ? `تحويل فوري${order.transferSender ? ` (${order.transferSender})` : ''}`
      : 'الدفع عند الاستلام (كاش / فيزا)';

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );
  const finalTotal = Number.isFinite(Number(order.totalAmount))
    ? Number(order.totalAmount)
    : subtotal;

  const extraDeliveryFee =
    typeof (order as OnlineOrder & { deliveryFee?: number }).deliveryFee === 'number'
      ? Number((order as OnlineOrder & { deliveryFee?: number }).deliveryFee)
      : finalTotal > subtotal
        ? finalTotal - subtotal
        : 0;

  const itemRowsHtml = items
    .map((item) => {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price) || 0;
      const lineTotal = qty * unitPrice;
      const itemAny = item as typeof item & {
        size?: string;
        variant?: string;
        addons?: string[];
        extras?: string[];
        notes?: string;
      };
      const detailParts: string[] = [];
      if (itemAny.size) detailParts.push(`الحجم: ${itemAny.size}`);
      if (itemAny.variant) detailParts.push(itemAny.variant);
      if (Array.isArray(itemAny.addons) && itemAny.addons.length > 0) {
        detailParts.push(`إضافات: ${itemAny.addons.join('، ')}`);
      }
      if (Array.isArray(itemAny.extras) && itemAny.extras.length > 0) {
        detailParts.push(`إضافات: ${itemAny.extras.join('، ')}`);
      }
      if (itemAny.notes) detailParts.push(itemAny.notes);

      const detailsHtml =
        detailParts.length > 0
          ? `<div class="item-meta">${escapeHtml(detailParts.join(' | '))}</div>`
          : '';
      const unitHintHtml =
        qty > 1
          ? `<div class="item-unit">${escapeHtml(unitPrice.toLocaleString('en-US'))} × ${escapeHtml(qty)}</div>`
          : '';

      return `
        <tr>
          <td class="col-qty">${escapeHtml(qty)}×</td>
          <td class="col-name">
            <div class="item-title">${escapeHtml(item.titleAr || item.titleEn)}</div>
            ${detailsHtml}
          </td>
          <td class="col-price">
            <div>${escapeHtml(formatCurrency(lineTotal))}</div>
            ${unitHintHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>فاتورة طلب ${escapeHtml(order.id)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      background: #ffffff;
      color: #000000;
      direction: rtl;
      font-family: 'Cairo', 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 4mm;
      color: #000000;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.45;
    }
    .header {
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000000;
    }
    .restaurant-name {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0;
      line-height: 1.3;
      margin-bottom: 3px;
    }
    .branch-name {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .meta-row {
      font-size: 11px;
      font-weight: 700;
      margin-top: 2px;
    }
    .order-id {
      font-size: 14px;
      font-weight: 900;
      font-family: 'Courier New', monospace;
      margin-top: 4px;
      direction: ltr;
      display: inline-block;
    }
    .order-type-box {
      margin-top: 8px;
      padding: 5px 6px;
      border: 2px solid #000000;
      font-size: 13px;
      font-weight: 900;
      text-align: center;
    }
    .section {
      padding: 8px 0;
      border-bottom: 1px dashed #000000;
    }
    .section-title {
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 5px;
      text-decoration: underline;
    }
    .info-line {
      font-size: 12px;
      margin-bottom: 3px;
      word-break: break-word;
    }
    .info-label {
      font-weight: 900;
    }
    .ltr-value {
      direction: ltr;
      unicode-bidi: embed;
      font-family: 'Courier New', monospace;
      font-weight: 800;
    }
    .notes-box {
      margin-top: 5px;
      padding: 4px 6px;
      border: 1px solid #000000;
      font-size: 11px;
      font-weight: 700;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2px;
    }
    table.items-table th {
      font-size: 11px;
      font-weight: 900;
      text-align: right;
      padding: 4px 2px 6px;
      border-bottom: 1px dashed #000000;
    }
    table.items-table th.col-price,
    table.items-table td.col-price {
      text-align: left;
      white-space: nowrap;
    }
    table.items-table td {
      padding: 6px 2px;
      vertical-align: top;
      border-bottom: 1px dashed #000000;
      font-size: 12px;
    }
    table.items-table tr:last-child td {
      border-bottom: none;
    }
    .col-qty {
      width: 16%;
      font-weight: 900;
      white-space: nowrap;
    }
    .col-name {
      width: 56%;
      padding-left: 4px;
      padding-right: 4px;
    }
    .col-price {
      width: 28%;
      font-weight: 800;
    }
    .item-title {
      font-weight: 800;
      word-break: break-word;
    }
    .item-meta {
      font-size: 10px;
      font-weight: 700;
      margin-top: 2px;
    }
    .item-unit {
      font-size: 10px;
      font-weight: 600;
      margin-top: 1px;
    }
    .totals {
      padding: 8px 0;
      border-bottom: 1px dashed #000000;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .grand-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
      padding: 6px 0;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
      font-size: 17px;
      font-weight: 900;
    }
    .footer {
      text-align: center;
      padding-top: 10px;
      font-size: 12px;
      font-weight: 800;
    }
    .footer-sub {
      font-size: 11px;
      font-weight: 700;
      margin-top: 4px;
    }
    @media print {
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .receipt {
        max-width: 80mm;
        width: 100%;
        padding: 4mm;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="restaurant-name">${escapeHtml(restaurantName)}</div>
      <div class="branch-name">${escapeHtml(branchName)}</div>
      <div class="order-id">#${escapeHtml(order.id)}</div>
      <div class="meta-row">التاريخ والوقت: ${escapeHtml(formattedDate)}</div>
      <div class="order-type-box">${escapeHtml(orderTypeLabel)}</div>
    </div>

    <div class="section">
      <div class="section-title">بيانات العميل</div>
      <div class="info-line">
        <span class="info-label">الاسم:</span> ${escapeHtml(order.customerName)}
      </div>
      <div class="info-line">
        <span class="info-label">الموبايل:</span>
        <span class="ltr-value">${escapeHtml(order.phone)}</span>
      </div>
      ${
        isDelivery && order.address
          ? `<div class="info-line"><span class="info-label">العنوان:</span> ${escapeHtml(order.address)}</div>`
          : ''
      }
      <div class="info-line">
        <span class="info-label">طريقة الدفع:</span> ${escapeHtml(paymentLabel)}
      </div>
      ${
        order.notes && order.notes.trim()
          ? `<div class="notes-box">ملاحظات: ${escapeHtml(order.notes.trim())}</div>`
          : ''
      }
    </div>

    <div class="section">
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-qty">الكمية</th>
            <th class="col-name">الصنف</th>
            <th class="col-price">السعر</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <div class="total-row">
        <span>المجموع الفرعي:</span>
        <span>${escapeHtml(formatCurrency(subtotal))}</span>
      </div>
      ${
        extraDeliveryFee > 0
          ? `<div class="total-row">
              <span>رسوم التوصيل:</span>
              <span>${escapeHtml(formatCurrency(extraDeliveryFee))}</span>
            </div>`
          : ''
      }
      <div class="grand-total-row">
        <span>الإجمالي النهائي</span>
        <span>${escapeHtml(formatCurrency(finalTotal))}</span>
      </div>
    </div>

    <div class="footer">
      <div>شكراً لطلبكم من ${escapeHtml(restaurantName)}</div>
      ${
        branchPhone
          ? `<div class="footer-sub">للتواصل: <span class="ltr-value">${escapeHtml(branchPhone)}</span></div>`
          : ''
      }
    </div>
  </div>
</body>
</html>`;
}

const RECEIPT_IFRAME_ID = 'saheb-thermal-receipt-print-frame';

export function printThermalReceipt(order: OnlineOrder, branchConfig: BranchConfig): void {
  // Remove any leftover receipt iframe before creating a fresh one
  const existing = document.getElementById(RECEIPT_IFRAME_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const iframe = document.createElement('iframe');
  iframe.id = RECEIPT_IFRAME_ID;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const html = buildThermalReceiptHtml(order, branchConfig);
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  const iframeWin = iframe.contentWindow;

  if (!iframeDoc || !iframeWin) {
    iframe.remove();
    return;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 300);
  };

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const triggerPrint = () => {
    try {
      iframeWin.addEventListener('afterprint', cleanup, { once: true });
      iframeWin.focus();
      iframeWin.print();
    } catch {
      cleanup();
    }
    // Fallback cleanup in case a browser does not fire afterprint on iframes
    window.setTimeout(cleanup, 60000);
  };

  // Give the iframe layout engine a brief tick to settle before opening the print dialog
  window.setTimeout(triggerPrint, 150);
}
