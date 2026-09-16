import { describe, expect, it } from 'vitest';
import { containsStop, sanitizeTaskText } from './task';

describe('sanitizeTaskText', () => {
  it('rimuove controllo e zero-width', () => {
    expect(sanitizeTaskText('ciao\u200B mondo\u0007!')).toBe('ciao mondo!');
    expect(sanitizeTaskText('a\u202Eb\u202Cc')).toBe('abc');
    expect(sanitizeTaskText('no\uFEFFbom')).toBe('nobom');
  });
  it('preserva testo normale, a capo e tab', () => {
    expect(sanitizeTaskText('riga1\nriga2\tfine')).toBe('riga1\nriga2\tfine');
    expect(sanitizeTaskText('')).toBe('');
  });
});

describe('containsStop', () => {
  it('match case-insensitive, vuoto mai', () => {
    expect(containsStop('Prezzo totale: 42€', 'prezzo totale')).toBe(true);
    expect(containsStop('altro', 'prezzo')).toBe(false);
    expect(containsStop('qualcosa', '   ')).toBe(false);
  });
});
