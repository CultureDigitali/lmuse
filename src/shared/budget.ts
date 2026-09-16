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

/**
 * Circuit breaker: dopo N errori consecutivi il run si ferma invece di
 * insistere a vuoto. Si resetta al primo successo.
 */
export class FailureCircuit {
  private consecutive = 0;

  constructor(readonly maxConsecutive = 5) {
    if (!Number.isFinite(maxConsecutive) || maxConsecutive < 1) {
      throw new Error('Circuit breaker non valido.');
    }
  }

  get failures(): number {
    return this.consecutive;
  }

  get open(): boolean {
    return this.consecutive >= this.maxConsecutive;
  }

  recordSuccess(): void {
    this.consecutive = 0;
  }

  recordFailure(): void {
    this.consecutive += 1;
  }
}
