// Marcatori interni di controllo del run.
//
// L'SDK ai@7 cattura OGNI eccezione lanciata da un tool e la trasforma in un
// tool-error per il modello: il loop continua e l'eccezione non arriva mai al
// chiamante. Per questo i freni del run (stop-text, circuit breaker, budget)
// non possono più affidarsi al throw: segnalano l'abort del controller e il
// messaggio viaggia nel `signal.reason`, che invece attraversa tutto.
// Questi prefissi servono a riconoscere quei motivi nei punti giusti.

/** Stop richiesto dall'utente via stop-text: esito previsto, chiude con ✅. */
export const STOP_TEXT_PREFIX = 'STOP_TEXT:';
/** Circuit breaker aperto: troppi errori consecutivi dei tool. */
export const CIRCUIT_PREFIX = 'CIRCUIT_BREAKER:';
/** Budget tool del run esaurito. */
export const TOOL_BUDGET_PREFIX = 'TOOL_BUDGET:';

/** I prefissi che un `signal.reason` può portare dal tool al chiamante. */
export const RUN_ABORT_PREFIXES = [STOP_TEXT_PREFIX, CIRCUIT_PREFIX, TOOL_BUDGET_PREFIX];
