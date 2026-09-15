import { describe, expect, it } from 'vitest';
import { ToolBudget } from './budget';

describe('ToolBudget', () => {
  it('rifiuta max non validi', () => {
    expect(() => new ToolBudget(0)).toThrow();
    expect(() => new ToolBudget(-3)).toThrow();
    expect(() => new ToolBudget(NaN)).toThrow();
  });
  it('consuma fino a max poi si esaurisce', () => {
    const b = new ToolBudget(2);
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(true);
    expect(b.exhausted).toBe(true);
    expect(b.remaining).toBe(0);
    expect(b.tryConsume()).toBe(false);
    expect(b.usedCount).toBe(2);
  });
  it('reset ripristina', () => {
    const b = new ToolBudget(1);
    b.tryConsume();
    b.reset();
    expect(b.exhausted).toBe(false);
    expect(b.tryConsume()).toBe(true);
  });
});
