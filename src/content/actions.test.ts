// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MAX_WAIT_MS, describeFocused, hoverElement, selectOption, waitFor } from './actions';

describe('selectOption', () => {
  it('seleziona per valore e conferma selectedIndex + change', () => {
    document.body.innerHTML =
      '<select id="s"><option value="a">Alpha</option><option value="b">Beta</option></select>';
    const el = document.getElementById('s') as HTMLSelectElement;
    const onChange = vi.fn();
    el.addEventListener('change', onChange);
    const label = selectOption(el, 'b');
    expect(label).toBe('Beta');
    expect(el.selectedIndex).toBe(1);
    expect(el.value).toBe('b');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('match per testo visibile, case-insensitive', () => {
    document.body.innerHTML = '<select><option value="x1">Roma</option></select>';
    const el = document.querySelector('select') as HTMLSelectElement;
    expect(selectOption(el, 'roma')).toBe('Roma');
  });
  it('errori: non-select, disabilitato, opzione assente', () => {
    document.body.innerHTML =
      '<button>B</button><select disabled><option value="a">A</option></select><select id="ok"><option value="a">A</option></select>';
    expect(() => selectOption(document.querySelector('button') as Element, 'a')).toThrow(/tendina/);
    expect(() => selectOption(document.querySelector('select') as Element, 'a')).toThrow(/isabilitato/);
    expect(() => selectOption(document.getElementById('ok') as Element, 'zzz')).toThrow(/non trovata/);
  });
});

describe('waitFor', () => {
  it('risolve subito se già presente', async () => {
    document.body.innerHTML = '<p>atteso</p>';
    const ms = await waitFor('text', 'atteso', 2000);
    expect(ms).toBeLessThan(500);
  });
  it('risolve quando il selettore appare', async () => {
    document.body.innerHTML = '';
    setTimeout(() => {
      document.body.innerHTML = '<div class="late">x</div>';
    }, 300);
    const ms = await waitFor('selector', '.late', 3000);
    expect(ms).toBeGreaterThanOrEqual(250);
  });
  it('rigetta al timeout con messaggio chiaro', async () => {
    document.body.innerHTML = '';
    await expect(waitFor('text', 'mai', 600)).rejects.toThrow(/Timeout 600ms/);
  });
  it('cap a MAX_WAIT_MS', () => {
    expect(MAX_WAIT_MS).toBe(30_000);
  });
});

describe('describeFocused', () => {
  it('body → nessuno, bottone → tag+label', () => {
    document.body.innerHTML = '<button aria-label="Vai">x</button>';
    expect(describeFocused()).toBe('nessuno (body)');
    (document.querySelector('button') as HTMLButtonElement).focus();
    expect(describeFocused()).toBe('button "Vai"');
  });
});

describe('hoverElement', () => {
  it('dispatcha mouseover/pointermove con coordinate centrali', () => {
    document.body.innerHTML = '<button id="h">menu</button>';
    const el = document.getElementById('h') as HTMLElement;
    const over = vi.fn();
    const move = vi.fn();
    el.addEventListener('mouseover', over);
    el.addEventListener('pointermove', move);
    hoverElement(el);
    expect(over).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledTimes(1);
    expect(over.mock.calls[0][0].clientX).toBeTypeOf('number');
  });
  it('bubbles: il listener su document riceve mouseover', () => {
    document.body.innerHTML = '<div id="wrap"><span id="inner">x</span></div>';
    const onDoc = vi.fn();
    document.addEventListener('mouseover', onDoc);
    hoverElement(document.getElementById('inner') as HTMLElement);
    expect(onDoc).toHaveBeenCalledTimes(1);
  });
});
