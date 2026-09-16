// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isPressAllowed } from './keys';

describe('isPressAllowed', () => {
  it('consente navigazione/chiusura', () => {
    for (const k of ['Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(isPressAllowed(k)).toBe(true);
    }
  });
  it('nega Invio, Spazio e tasti liberi', () => {
    for (const k of ['Enter', ' ', 'a', 'F5', 'Control']) {
      expect(isPressAllowed(k)).toBe(false);
    }
  });
});
