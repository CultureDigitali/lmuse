// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSnapshot, getElement, registerElements } from './snapshot';

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
  it('attraversa shadow DOM aperti', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host') as HTMLElement;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button>ShadowBtn</button>';
    const tree = buildSnapshot(false);
    expect(tree).toContain('ShadowBtn');
  });
  it('5k nodi in < 2s', () => {
    document.body.innerHTML = Array.from({ length: 5000 }, (_, i) => `<button>B${i}</button>`).join('');
    const started = Date.now();
    buildSnapshot(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('ref separati tra pagina principale e iframe', () => {
  /** Crea un iframe same-origin con il contenuto indicato. */
  function makeIframe(html: string): Document {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const doc = frame.contentDocument as Document;
    doc.body.innerHTML = html;
    return doc;
  }

  it('uno snapshot di iframe non sovrascrive i ref della pagina principale', () => {
    // Difetto: refMap era unica e globale, quindi lo snapshot dell'iframe
    // azzerava contatore e mappa, e getElement(0) restituiva l'elemento
    // dell'iframe per un ref emesso dalla pagina principale.
    document.body.innerHTML = '<button>MAIN</button>';
    const mainTree = buildSnapshot(false);
    expect(mainTree).toContain('[0] button "MAIN"');

    const frameDoc = makeIframe('<button>FRAME</button>');
    buildSnapshot(false, frameDoc);

    expect(getElement(0)?.textContent).toBe('MAIN');
    expect(getElement(0, frameDoc)?.textContent).toBe('FRAME');
  });

  it('i ref dell’iframe non collidono con quelli della pagina', () => {
    // I due pulsanti devono essere gli unici elementi interattivi del
    // documento principale: l'iframe non deve essere raccolto come pulsante.
    const main = document.createElement('div');
    main.innerHTML = '<button>M1</button><button>M2</button>';
    document.body.append(main);
    buildSnapshot(false);
    const frameDoc = makeIframe('<button>F1</button><button>F2</button>');
    buildSnapshot(false, frameDoc);

    // Ref 0 e 1 esistono in entrambi i documenti ma devono restare distinti.
    expect(getElement(0)?.textContent).toBe('M1');
    expect(getElement(0, frameDoc)?.textContent).toBe('F1');
    expect(getElement(1)?.textContent).toBe('M2');
    expect(getElement(1, frameDoc)?.textContent).toBe('F2');
    // Un ref inesistente nel documento giusto resta null: nessuna fuga cross-doc.
    expect(getElement(7, frameDoc)).toBeNull();
  });

  it('registerElements registra nel documento dell’elemento', () => {
    document.body.innerHTML = '<p id="q">testo</p>';
    const frameDoc = makeIframe('<p id="w">altro</p>');
    const mainEl = document.getElementById('q') as Element;
    const frameEl = frameDoc.getElementById('w') as Element;
    const refs = registerElements([mainEl, frameEl]);
    expect(refs).toHaveLength(2);
    expect(getElement(refs[0])).toBe(mainEl);
    expect(getElement(refs[1], frameDoc)).toBe(frameEl);
  });
});
