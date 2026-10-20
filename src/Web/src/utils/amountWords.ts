// An amount in riyals written out, as the payslip prints it under the net (4.12): «ثلاثة عشر ألفًا وثلاثمئة وستون ريالًا»
// and "Thirteen thousand three hundred sixty riyals"; the halalas, when there are any, as digits («و25 هللة»).

/** A word of a list (every index used is in range). */
const w = (list: readonly string[], i: number) => list[i] ?? '';

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundreds = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

/** 1–999 in words («ثلاثمئة وستون»). */
function arBelowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(w(hundreds, Math.floor(n / 100)));
  const r = n % 100;
  if (r >= 20) parts.push(r % 10 ? `${w(ones, r % 10)} و${w(tens, Math.floor(r / 10))}` : w(tens, Math.floor(r / 10)));
  else if (r >= 10) parts.push(w(teens, r - 10));
  else if (r > 0) parts.push(w(ones, r));
  return parts.join(' و');
}

/** A count of a scale word: «ألف، ألفان، ثلاثة آلاف، أحد عشر ألفًا، مئة ألف، مئة وألفان». */
function arScale(n: number, one: string, two: string, plural: string, accusative: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${arBelowThousand(n)} ${plural}`;
  if (r >= 11) return `${arBelowThousand(n)} ${accusative}`;
  if (n > 100 && (r === 1 || r === 2)) return `${arBelowThousand(n - r)} و${r === 1 ? one : two}`;
  return `${arBelowThousand(n)} ${one}`;
}

export function arabicNumber(n: number): string {
  if (n === 0) return 'صفر';
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1e3;
  if (billions) parts.push(arScale(billions, 'مليار', 'ملياران', 'مليارات', 'مليارًا'));
  if (millions) parts.push(arScale(millions, 'مليون', 'مليونان', 'ملايين', 'مليونًا'));
  if (thousands) parts.push(arScale(thousands, 'ألف', 'ألفان', 'آلاف', 'ألفًا'));
  if (rest) parts.push(arBelowThousand(rest));
  return parts.join(' و');
}

/** The riyal after its count: «ريال واحد، ريالان، ثلاثة ريالات، أحد عشر ريالًا، مئة ريال». */
function arRiyals(n: number): string {
  if (n === 1) return 'ريال واحد';
  if (n === 2) return 'ريالان';
  const r = n % 100;
  const noun = r >= 3 && r <= 10 ? 'ريالات' : r >= 11 ? 'ريالًا' : 'ريال';
  return `${arabicNumber(n)} ${noun}`;
}

const enOnes = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const enTens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enBelowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(`${w(enOnes, Math.floor(n / 100))} hundred`);
  const r = n % 100;
  if (r >= 20) parts.push(r % 10 ? `${w(enTens, Math.floor(r / 10))}-${w(enOnes, r % 10)}` : w(enTens, Math.floor(r / 10)));
  else if (r > 0) parts.push(w(enOnes, r));
  return parts.join(' ');
}

export function englishNumber(n: number): string {
  if (n === 0) return 'zero';
  const scales: [number, string][] = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  const parts: string[] = [];
  let rest = n;
  for (const [size, word] of scales) {
    const count = Math.floor(rest / size);
    if (count) parts.push(`${enBelowThousand(count)} ${word}`);
    rest %= size;
  }
  if (rest) parts.push(enBelowThousand(rest));
  return parts.join(' ');
}

/** Riyals and halalas of a (non-negative) amount; a negative amount is written as its size with «سالب» / "minus". */
function split(amount: number) {
  const halalas = Math.round(Math.abs(amount) * 100);
  return { negative: amount < 0, riyals: Math.floor(halalas / 100), halalas: halalas % 100 };
}

export function amountInArabic(amount: number): string {
  const { negative, riyals, halalas } = split(amount);
  const text = riyals === 0 && halalas > 0 ? `${halalas} هللة` : `${arRiyals(riyals)}${halalas ? ` و${halalas} هللة` : ''}`;
  return negative ? `سالب ${text}` : text;
}

export function amountInEnglish(amount: number): string {
  const { negative, riyals, halalas } = split(amount);
  const words = englishNumber(riyals);
  const text = `${words.charAt(0).toUpperCase()}${words.slice(1)} ${riyals === 1 ? 'riyal' : 'riyals'}${halalas ? ` and ${halalas} halalas` : ''}`;
  return negative ? `Minus ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}
