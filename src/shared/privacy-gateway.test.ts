import { describe, expect, it } from 'vitest';
import { PrivacyGateway } from './privacy-gateway';

const PAGE_A = 'https://crm.example.test/clienti';
const PAGE_B = 'https://mail.example.test/inbox';

describe('PrivacyGateway — isolamento dati verso LLM', () => {
  it('sostituisce email e mantiene lo stesso pseudonimo nello stesso sito', () => {
    const gateway = new PrivacyGateway('strict');
    const one = gateway.protectText('Scrivi a mario.rossi@example.it', PAGE_A);
    const two = gateway.protectText('mario.rossi@example.it', PAGE_A);
    expect(one).not.toContain('mario.rossi@example.it');
    expect(one).toContain(two);
    expect(two).toMatch(/^\[LMUSE_EMAIL_[a-p]{24}\]$/);
    expect(gateway.size).toBe(1);
    expect(gateway.restoreForUser(one)).toBe('Scrivi a mario.rossi@example.it');
  });

  it('non collega lo stesso valore fra siti diversi', () => {
    const gateway = new PrivacyGateway('pseudonymize');
    const a = gateway.protectText('mario@example.it', PAGE_A);
    const b = gateway.protectText('mario@example.it', PAGE_B);
    expect(a).not.toBe(b);
    expect(gateway.size).toBe(2);
    expect(gateway.restoreForUser(a)).toBe('mario@example.it');
  });

  it('pseudonimizza token di accesso, IBAN, carta, telefono e query string', () => {
    const gateway = new PrivacyGateway('strict');
    const values = [
      'sk-proj-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'IT60X0542811101000000123456',
      '4111 1111 1111 1111',
      '+39 333 1234567',
      'https://example.test/?access_token=SECRETVALUE987654321&view=1',
    ];
    const raw = values.join('\n');
    const protectedText = gateway.protectText(raw, PAGE_A);
    for (const value of values.slice(0, 4)) expect(protectedText).not.toContain(value);
    expect(protectedText).not.toContain('SECRETVALUE987654321');
    expect(protectedText).toContain('access_token=[LMUSE_QUERY_');
    expect(gateway.restoreForUser(protectedText)).toBe(raw);
  });

  it('ripristina una voce solo sullo stesso origin, non in un sito esterno', () => {
    const gateway = new PrivacyGateway('strict');
    const token = gateway.protectText('mario@example.it', PAGE_A);
    expect(gateway.restoreForPage(token, 'https://crm.example.test/modulo')).toBe('mario@example.it');
    expect(() => gateway.restoreForPage(token, PAGE_B)).toThrow(/tra siti diversi/);
  });

  it('non usa segreti di un prompt per compilare form in un sito', () => {
    const gateway = new PrivacyGateway('strict');
    const token = gateway.protectText('mario@example.it');
    expect(() => gateway.restoreForPage(token, PAGE_A)).toThrow(/tra siti diversi/);
    expect(gateway.restoreForUser(token)).toBe('mario@example.it');
  });

  it('rifiuta segnaposto inventati dal provider', () => {
    const gateway = new PrivacyGateway('strict');
    expect(() => gateway.restoreForPage('[LMUSE_EMAIL_aaaaaaaaaaaaaaaaaaaaaaaa]', PAGE_A)).toThrow(
      /non riconosciuto/,
    );
  });

  it('protegge anche array, oggetti e campi di nuovi tool', () => {
    const gateway = new PrivacyGateway('strict');
    const output = {
      observation: 'Contatto mario@example.it',
      links: [{ text: 'mario@example.it', url: '/pagina' }],
      ok: true,
    };
    const protectedOutput = gateway.protectUnknown(output, PAGE_A);
    expect(JSON.stringify(protectedOutput)).not.toContain('mario@example.it');
    expect(protectedOutput.ok).toBe(true);
    expect(protectedOutput.links[0].text).toEqual(
      protectedOutput.observation.replace('Contatto ', ''),
    );
  });

  it('svuota la mappa alla fine del run', () => {
    const gateway = new PrivacyGateway('strict');
    const token = gateway.protectText('mario@example.it', PAGE_A);
    gateway.clear();
    expect(gateway.size).toBe(0);
    expect(() => gateway.restoreForPage(token, PAGE_A)).toThrow(/non riconosciuto/);
    expect(gateway.restoreForUser(token)).toBe(token);
  });

  it('modalità off preserva il comportamento preesistente', () => {
    const gateway = new PrivacyGateway('off');
    expect(gateway.protectText('mario@example.it', PAGE_A)).toBe('mario@example.it');
    expect(gateway.restoreForUser('mario@example.it')).toBe('mario@example.it');
  });

  it('fallisce chiuso per contenuti enormi, senza inviare porzioni non protette', () => {
    const gateway = new PrivacyGateway('strict');
    expect(() => gateway.protectText('x'.repeat(200_001), PAGE_A)).toThrow(/invio bloccato/);
  });
});
