import { describe, expect, it } from 'vitest';
import { maskCards, maskEmails, maskIbans, maskPhones, maskPii, maskUrlTokens } from './pii';

describe('maskEmails', () => {
  it('redige le email', () => {
    expect(maskEmails('scrivi a mario.rossi+tag@example.com grazie')).toBe('scrivi a [email] grazie');
  });
  it('lascia intatto il testo senza email', () => {
    expect(maskEmails('nessun contatto qui')).toBe('nessun contatto qui');
  });
});

describe('maskIbans', () => {
  it('redige gli IBAN', () => {
    expect(maskIbans('iban IT60X0542811101000000123456 fine')).toBe('iban [iban] fine');
  });
});

describe('maskCards', () => {
  it('redige i numeri carta', () => {
    expect(maskCards('carta 4111 1111 1111 1111 ok')).toBe('carta [carta] ok');
  });
});

describe('maskPhones', () => {
  it('redige i numeri di telefono', () => {
    expect(maskPhones('tel +39 333 123 4567 ora')).toBe('tel [numero] ora');
  });
});

describe('maskUrlTokens', () => {
  it('redige token e segreti nei query param', () => {
    const url = 'https://x.test/cb?code=abc123&state=ok&token=zzz';
    expect(maskUrlTokens(url)).toBe('https://x.test/cb?code=[redatto]&state=ok&token=[redatto]');
  });
  it('non tocca gli altri parametri', () => {
    expect(maskUrlTokens('https://x.test/?q=ciao&page=2')).toBe('https://x.test/?q=ciao&page=2');
  });
});

describe('maskPii', () => {
  it('applica tutte le redazioni insieme', () => {
    const text = 'mario@example.com carta 4111-1111-1111-1111 tel 3331234567 ?session=abc';
    const masked = maskPii(text);
    expect(masked).toContain('[email]');
    expect(masked).toContain('[carta]');
    expect(masked).toContain('[numero]');
    expect(masked).toContain('[redatto]');
    expect(masked).not.toContain('mario@example.com');
    expect(masked).not.toContain('session=abc');
  });
});
