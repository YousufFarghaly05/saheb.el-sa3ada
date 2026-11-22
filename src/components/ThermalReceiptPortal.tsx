import React from 'react';
import { createPortal } from 'react-dom';
import type { BranchConfig, OnlineOrder } from '../types.ts';
import {
  computeOrderAmounts,
  formatReceiptCurrency,
  formatReceiptDateTime,
} from '../utils/printThermalReceipt.ts';

interface ThermalReceiptPortalProps {
  order: OnlineOrder;
  branchConfig: BranchConfig;
}

export const ThermalReceiptPortal: React.FC<ThermalReceiptPortalProps> = ({
  order,
  branchConfig,
}) => {
  if (typeof document === 'undefined' || !document.body) return null;

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
  const { subtotal, deliveryFee, finalTotal } = computeOrderAmounts(order);

  const receiptContent = (
    <div id="thermal-receipt-root" dir="rtl" lang="ar" aria-hidden="true">
      <div className="tr-header">
        <div className="tr-restaurant-name">{restaurantName}</div>
        <div className="tr-branch-name">{branchName}</div>
        <div className="tr-order-id">#{order.id}</div>
        <div className="tr-meta-row">التاريخ والوقت: {formattedDate}</div>
        <div className="tr-order-type-box">{orderTypeLabel}</div>
      </div>

      <div className="tr-section">
        <div className="tr-section-title">بيانات العميل</div>
        <div className="tr-info-line">
          <span className="tr-info-label">الاسم:</span> {order.customerName}
        </div>
        <div className="tr-info-line">
          <span className="tr-info-label">الموبايل:</span>{' '}
          <span className="tr-ltr-value">{order.phone}</span>
        </div>
        {isDelivery && order.address && (
          <div className="tr-info-line">
            <span className="tr-info-label">العنوان:</span> {order.address}
          </div>
        )}
        <div className="tr-info-line">
          <span className="tr-info-label">طريقة الدفع:</span> {paymentLabel}
        </div>
        {order.notes && order.notes.trim() && (
          <div className="tr-notes-box">ملاحظات: {order.notes.trim()}</div>
        )}
      </div>

      <div className="tr-section">
        <table className="tr-items-table">
          <thead>
            <tr>
              <th className="tr-col-qty">الكمية</th>
              <th className="tr-col-name">الصنف</th>
              <th className="tr-col-price">السعر</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
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

              return (
                <tr key={`${item.menuItemId || item.titleAr}-${idx}`}>
                  <td className="tr-col-qty">{qty}×</td>
                  <td className="tr-col-name">
                    <div className="tr-item-title">{item.titleAr || item.titleEn}</div>
                    {detailParts.length > 0 && (
                      <div className="tr-item-meta">{detailParts.join(' | ')}</div>
                    )}
                  </td>
                  <td className="tr-col-price">
                    <div>{formatReceiptCurrency(lineTotal)}</div>
                    {qty > 1 && (
                      <div className="tr-item-unit">
                        {unitPrice.toLocaleString('en-US')} × {qty}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="tr-totals">
        <div className="tr-total-row">
          <span>المجموع الفرعي:</span>
          <span>{formatReceiptCurrency(subtotal)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="tr-total-row">
            <span>رسوم التوصيل:</span>
            <span>{formatReceiptCurrency(deliveryFee)}</span>
          </div>
        )}
        <div className="tr-grand-total-row">
          <span>الإجمالي النهائي</span>
          <span>{formatReceiptCurrency(finalTotal)}</span>
        </div>
      </div>

      <div className="tr-footer">
        <div>شكراً لطلبكم من {restaurantName}</div>
        {branchPhone && (
          <div className="tr-footer-sub">
            للتواصل: <span className="tr-ltr-value">{branchPhone}</span>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(receiptContent, document.body);
};
