// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSnapshot, getElement } from './snapshot';

// jsdom non fa layout: i rect sono 0x0 e isVisible filtrerebbe tutto.
// Stub che simula elementi visibili (come in un browser reale).
beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  window.Element.prototype.getBoundingClientRect = () =>
    ({
      width: 100,
      height: 20,
      top: 0,
      left: 0,
      right: 100,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
});

describe('buildSnapshot', () => {
  it('ref sequenziali e getElement risolve', () => {
    document.body.innerHTML = '<button>A</button><button>B</button>';
    const tree = buildSnapshot(false);
    expect(tree).toContain('[0] button "A"');
    expect(tree).toContain('[1] button "B"');
    expect(getElement(0)?.textContent).toBe('A');
    expect(getElement(99)).toBeNull();
  });
  it('ricostruzione resetta i ref', () => {
    document.body.innerHTML = '<button>A</button>';
    buildSnapshot(false);
    document.body.innerHTML = '<button>B</button><button>C</button>';
    const tree = buildSnapshot(false);
    expect(tree).toContain('[0] button "B"');
    expect(tree).toContain('[1] button "C"');
    expect(getElement(5)).toBeNull();
  });
  it('password: solo marker, mai il valore (mask on e off)', () => {
    document.body.innerHTML = '<input type="password" value="supersecret123" aria-label="pwd" />';
    for (const mask of [true, false]) {
      const tree = buildSnapshot(mask);
      expect(tree).toContain('[password]');
      expect(tree).not.toContain('supersecret123');
    }
  });
  it('email redatta con mask on, intatta con mask off', () => {
    document.body.innerHTML = '<a href="https://x.test">mario@example.com</a>';
    expect(buildSnapshot(true)).toContain('[email]');
    expect(buildSnapshot(true)).not.toContain('mario@example.com');
    expect(buildSnapshot(false)).toContain('mario@example.com');
  });
  it('include URL pagina e heading', () => {
    document.body.innerHTML = '<h1>Titolo pagina</h1><button>Ok</button>';
    const tree = buildSnapshot(false);
    expect(tree).toContain('URL pagina corrente:');
    expect(tree).toContain('Titolo pagina');
  });
  it('limite 250 nodi con nota omessi', () => {
    document.body.innerHTML = Array.from({ length: 300 }, (_, i) => `<button>B${i}</button>`).join('');
    const tree = buildSnapshot(false);
    expect(tree).toContain('omessi');
    expect(tree).not.toContain('[250]');
  });
  it('valore input testo incluso (non password)', () => {
    document.body.innerHTML = '<input type="text" value="ciao mondo" />';
    expect(buildSnapshot(false)).toContain('ciao mondo');
  });
});
