// Budget di tool-call per run: limita i loop folli dell'agente.

export class ToolBudget {
  private used = 0;

  constructor(readonly max: number) {
    if (!Number.isFinite(max) || max < 1) throw new Error('Budget tool non valido.');
  }

  get usedCount(): number {
    return this.used;
  }

  get remaining(): number {
    return Math.max(0, this.max - this.used);
  }

  get exhausted(): boolean {
    return this.used >= this.max;
  }

  /** true se c'è ancora budget e consuma una unità. */
  tryConsume(): boolean {
    if (this.exhausted) return false;
    this.used += 1;
    return true;
  }

  reset(): void {
    this.used = 0;
  }
}
