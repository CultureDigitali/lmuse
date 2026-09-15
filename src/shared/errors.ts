// Mappa errori provider/AI SDK → messaggi chiari in italiano.

export function mapProviderError(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'Task fermato.';
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'Task interrotto: superato il timeout massimo. Aumenta il timeout nelle impostazioni o semplifica il task.';
  }

  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const msg = raw.toLowerCase();

  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('invalid api key') ||
    msg.includes('unauthorized')
  ) {
    return 'Chiave API non valida o non autorizzata. Controllala nelle impostazioni ⚙.';
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
    return 'Rate limit o quota esaurita sul provider. Riprova tra poco o cambia modello.';
  }
  if (msg.includes('insufficient') || msg.includes('billing')) {
    return 'Credito/billing insufficiente sul provider. Verifica il tuo account.';
  }
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  ) {
    return 'Errore di rete o timeout verso il provider. Riprova.';
  }
  if (/\b5\d\d\b|internal server error|bad gateway|service unavailable/.test(msg)) {
    return 'Il provider ha risposto con un errore del server. Riprova o cambia modello.';
  }
  if (msg.includes('no such model') || msg.includes('model_not_found') || msg.includes('does not exist')) {
    return 'Modello non trovato sul provider. Controlla il nome del modello nelle impostazioni ⚙.';
  }
  if (msg.includes('failed to parse') || msg.includes('invalid json') || msg.includes('empty response')) {
    return 'Risposta non valida dal provider (formato inatteso). Riprova; se persiste, cambia modello.';
  }
  if (msg.includes('noobjectgenerated') || msg.includes('content filter')) {
    return 'Il modello non ha prodotto contenuto (possibile filtro). Riformula il task.';
  }
  return error instanceof Error ? error.message : String(error);
}
