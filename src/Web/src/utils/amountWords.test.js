import { describe, expect, it } from 'vitest';
import { amountInArabic, amountInEnglish, arabicNumber } from './amountWords';
describe('the amount in words', () => {
    it('writes Arabic numbers with their scales', () => {
        expect(arabicNumber(13360)).toBe('ثلاثة عشر ألفًا وثلاثمئة وستون');
        expect(arabicNumber(2000)).toBe('ألفان');
        expect(arabicNumber(3500)).toBe('ثلاثة آلاف وخمسمئة');
        expect(arabicNumber(100000)).toBe('مئة ألف');
        expect(arabicNumber(102000)).toBe('مئة وألفان');
        expect(arabicNumber(1250000)).toBe('مليون ومئتان وخمسون ألفًا');
        expect(arabicNumber(21)).toBe('واحد وعشرون');
    });
    it('counts the riyals and keeps the halalas as digits', () => {
        expect(amountInArabic(13360)).toBe('ثلاثة عشر ألفًا وثلاثمئة وستون ريالًا');
        expect(amountInArabic(1)).toBe('ريال واحد');
        expect(amountInArabic(2)).toBe('ريالان');
        expect(amountInArabic(5)).toBe('خمسة ريالات');
        expect(amountInArabic(4000)).toBe('أربعة آلاف ريال');
        expect(amountInArabic(2563.34)).toBe('ألفان وخمسمئة وثلاثة وستون ريالًا و34 هللة');
        expect(amountInArabic(0.5)).toBe('50 هللة');
    });
    it('writes the English', () => {
        expect(amountInEnglish(13360)).toBe('Thirteen thousand three hundred sixty riyals');
        expect(amountInEnglish(2563.34)).toBe('Two thousand five hundred sixty-three riyals and 34 halalas');
        expect(amountInEnglish(1)).toBe('One riyal');
        expect(amountInEnglish(-20)).toBe('Minus twenty riyals');
    });
});
