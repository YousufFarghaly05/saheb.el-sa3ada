export const EGYPTIAN_PHONE_REGEX = /^01[0125]\d{8}$/;

export const EGYPTIAN_PHONE_ERROR_AR =
  'يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015';

export const BLOCKED_PHONE_ERROR_AR =
  'عذراً، لا يمكن إتمام الطلب بهذا الرقم حالياً. يرجى التواصل مع إدارة المطعم.';

/**
 * Converts Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to English digits (0-9),
 * strips all non-digit characters, and limits length to 11 digits.
 */
export function normalizeEgyptianPhoneInput(raw: string): string {
  const western = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  return western.replace(/\D/g, '').slice(0, 11);
}

/**
 * Validates that a normalized phone number is a strict 11-digit Egyptian mobile number
 * starting with 010, 011, 012, or 015.
 */
export function isValidEgyptianPhone(phone: string): boolean {
  return EGYPTIAN_PHONE_REGEX.test(phone);
}
