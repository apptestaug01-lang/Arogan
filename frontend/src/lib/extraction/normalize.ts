export function normalizePan(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function normalizeAadhaar(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 12) return value;
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
}

export function normalizeGstin(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function normalizeCurrency(value: string): string {
  const num = parseFloat(value.replace(/,/g, ''));
  if (isNaN(num)) return value;
  return num.toFixed(2);
}

export function normalizeNumber(value: string): string {
  const num = parseFloat(value.replace(/,/g, ''));
  if (isNaN(num)) return value;
  return num.toString();
}

export function normalizeDate(value: string): string {
  const parts = value.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (parts) return `${parts[1]}-${parts[2]}-${parts[3]}`;
  return value;
}

export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 && !value.includes('+91')) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return value;
}

export function normalizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

export function normalizeField(key: string, value: string): string {
  switch (key) {
    case 'pan':
      return normalizePan(value);
    case 'aadhaar':
      return normalizeAadhaar(value);
    case 'gstin':
    case 'companyPan':
      return normalizeGstin(value);
    case 'email':
      return normalizeEmail(value);
    case 'mobile':
      return normalizeMobile(value);
    case 'avgMonthlyBalance':
    case 'existingMonthlyEmi':
    case 'avgMonthlyCredits':
    case 'netWorth':
    case 'debt':
    case 'turnoverY1':
    case 'turnoverY2':
    case 'profitY1':
    case 'profitY2':
      return normalizeCurrency(value);
    case 'loanAmount':
    case 'tenor':
    case 'chequeBounces':
      return normalizeNumber(value);
    case 'dateOfIncorporation':
      return normalizeDate(value);
    default:
      return value.trim();
  }
}
