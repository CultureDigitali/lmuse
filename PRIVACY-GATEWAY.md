# LMuse Privacy Gateway — v0.9.0 (beta, non pubblicata)

## Scopo e modello di minaccia

Limitare l'esposizione di dati personali quando un agente LMuse usa il browser tramite un LLM cloud, incluso un provider poco affidabile. Questa funzione è **pseudonimizzazione**, non anonimizzazione irreversibile: non rende sicuro un provider compromesso.

**Flusso di protezione:**

1. Il content script legge localmente la pagina autorizzata.
2. Il service worker sostituisce i valori strutturati riconosciuti con segnaposto casuali non significativi, prima di restituire i tool al modello.
3. La mappa originale ↔ segnaposto vive esclusivamente **in memoria nel singolo run**, senza salvataggio nello storage, senza export e senza rete.
4. Il modello riceve solo le stringhe pseudonimizzate per i valori coperti.
5. Per la scrittura nel browser, il worker risolve un token **solo sullo stesso origin HTTP(S) nel quale è stato rilevato**, dopo conferma dell'utente.
6. Il testo finale dell'LLM viene ripristinato localmente per la visualizzazione nel pannello; la mappa viene cancellata al termine del run.

Il gateway protegge tutte le stringhe delle risposte dei tool, non solo lo snapshot iniziale. Il contenuto della richiesta dell'utente è trattato separatamente: un token ottenuto dalla richiesta non può essere riutilizzato automaticamente per compilare una pagina.

## Modalità

| Modalità               | Comportamento                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rigorosa** (default) | Domini consentiti obbligatori, consenso per origin prima di leggere e trasmettere, conferma delle azioni operative, screenshot bloccati, task non presidiati vietati |
| Pseudonimizzazione     | Sostituzione reversibile, screenshot bloccati, click e digitazione con conferma, allowlist facoltativa (sconsigliata)                                                |
| Disattivata            | Comportamento legacy: solo redazione configurata, possibile trasmissione in chiaro; compatibilità, non raccomandata                                                  |

Le **chiavi API** non vengono pseudonimizzate nel canale di autenticazione al provider scelto: quel provider deve conoscerle. Usare chiavi dedicate, con quota e privilegi limitati. Per privacy elevata, preferire un provider locale con Ollama o LM Studio.

## Cosa riconosce

- Email, telefoni, IBAN e numeri di carta nel formato comune.
- Alcune famiglie di chiavi API/token note e intestazioni Bearer.
- Valori di parametri URL come token, access_token, api_key, password e simili.
- Segnaposto casuali e distinti per sito e per esecuzione.

## Limiti sostanziali

- **Nomi, indirizzi postali, ragioni sociali, riferimenti commerciali, testo libero, immagini contenenti testo e dati non conformi a un pattern** non sono garantiti anonimi. La ricostruzione dal contesto resta possibile.
- Le relazioni fra segnaposto e contesto possono permettere reidentificazione. Un modello malevolo può tentare prompt injection e richiedere azioni scorrette.
- LMuse **non invia file binari direttamente all'LLM** nella versione attuale: usa snapshot DOM, estrazione di testo e screenshot. Screenshot e click su input-file e relative label sono bloccati nelle modalità protette. Non esiste ancora un parser universale per PDF/DOCX/XLSX/OCR.
- L'allowlist limita l'agente, **non riduce** di per sé il permesso Chrome su tutti i siti richiesto dal manifest. Una futura revisione deve prevedere permessi host opzionali concessi per sito.
- Non protegge informazioni già note al provider o inserite al di fuori del gateway.
- La redazione legacy non equivale alla protezione reversibile del gateway.

## Test per una beta privata

Eseguire su un clone del branch in un profilo Chrome senza account reali:

1. Eseguire pnpm install --frozen-lockfile.
2. Eseguire pnpm check e pnpm test:e2e.
3. Verificare una lettura su sito consentito dopo approvazione: il mock provider riceve un segnaposto e **non** l'email originale.
4. Provare rifiuto di lettura, click sensibile, cambio tab/URL durante approvazione, ripristino su altro origin e screenshot: devono essere bloccati.
5. Provare STOP, restart del service worker, errori del provider e verificare i log e il traffico di rete.
6. Provare un modello locale e uno cloud **esclusivamente con dati sintetici**.
7. Non distribuire sul profilo principale fino a un collaudo umano.

## Evoluzione futura: allegati sensibili

Per supportare PDF, DOCX, XLSX, CSV e immagini serve un parser **locale** specifico per formato, classificazione PII e regole configurabili, anonimizzazione di tabelle e metadati, mappe temporanee isolate per job, copertura misurabile e test su immagini incorporate, scansioni, note, commenti e formule. Documenti e porzioni non verificabili devono essere **bloccati**, non trasmessi in chiaro. Non usare OCR o conversione cloud prima della protezione.
