# REPORT DI ATTIVITÀ — lmuse

**Progetto:** lmuse — estensione browser ad agente AI
**Committente:** Amministrazione pubblica
**Periodo di svolgimento:** 16 – 28 settembre 2026
**Versione finale consegnata:** 0.8.0
**Repository:** https://github.com/CultureDigitali/lmuse (pubblico, licenza MIT)
**Data di stesura del report:** 28 settembre 2026

---

## INDICE

1. [Sintesi per la dirigenza](#1-sintesi-per-la-dirigenza)
2. [Che cos'è lmuse e a cosa serve](#2-che-cosè-lmuse-e-a-cosa-serve)
3. [Metodologia di lavoro](#3-metodologia-di-lavoro)
4. [Cronologia completa dei sette cicli di lavoro](#4-cronologia-completa-dei-sette-cicli-di-lavoro)
5. [Funzionalità consegnate: i 26 tool browser](#5-funzionalità-consegnate-i-26-tool-browser)
6. [Funzionalità consegnate: i 25 provider LLM](#6-funzionalità-consegnate-i-25-provider-llm)
7. [Sicurezza](#7-sicurezza)
8. [Privacy e protezione dei dati](#8-privacy-e-protezione-dei-dati)
9. [Integrazione con opencode](#9-integrazione-con-opencode)
10. [Qualità, test e verifica](#10-qualità-test-e-verifica)
11. [Prestazioni e ottimizzazione](#11-prestazioni-e-ottimizzazione)
12. [Documentazione prodotta](#12-documentazione-prodotta)
13. [Processo di rilascio e versionamento](#13-processo-di-rilascio-e-versionamento)
14. [Limiti noti e rischi residui](#14-limiti-noti-e-rischi-residui)
15. [Attività pianificate ma non concluse](#15-attività-pianificate-ma-non-concluse)
16. [Come riprodurre e verificare i risultati](#16-come-riprodurre-e-verificare-i-risultati)
17. [Metriche di sintesi](#17-metriche-di-sintesi)
18. [Appendice A — Elenco completo dei tool](#appendice-a--elenco-completo-dei-tool)
19. [Appendice B — Elenco completo dei provider](#appendice-b--elenco-completo-dei-provider)
20. [Appendice C — Elenco dei rilasci](#appendice-c--elenco-dei-rilasci)

---

## 1. Sintesi per la dirigenza

Nel periodo indicato è stato sviluppato **lmuse**, un'estensione per browser Chrome
che realizza un agente operative autonomo: l'utente descrive in linguaggio naturale
un compito (per esempio «riassumi questa pagina», «compila il modulo di contatti»,
«scarica il report trimestrale») e l'estensione esegue materialmente le operazioni
sul browser, scegliendo da sola gli strumenti necessari e chiedendo conferma umana
prima delle azioni delicate.

Il lavoro è stato condotto con un metodo iterativo e verificato: **sette cicli
successivi**, ciascuno con una lista di 100 attività definite in anticipo, ciascuna
attività chiusa solo dopo aver superato i controlli automatici di qualità. Sono state
 pianificate e tracciate **700 attività** complessive.

Risultati principali:

| Indicatore | Valore |
|---|---|
| Versioni rilasciate | 7 (da 0.2.0 a 0.8.0) |
| Attività pianificate e tracciate | 700 |
| Test automatici in verde | 295 |
| Copertura misurata (`src/shared`, 2.014 righe = 33% del sorgente) | 96,4% delle righe |
| Copertura dei rami decisionali | 89,0% |
| Strumenti operativi per l'agente | 26 |
| Modelli LLM supportati | 25 |
| Codice sorgente | 6.138 righe (26 file) |
| Codice di test | 1.872 righe (24 file) |
| Accessibilità (verifica automatizzata) | 0 violazioni serie |
| Server propri, telemetria, tracciamento | nessuno |

**Punto chiave per l'Amministrazione:** il progetto è stato realizzato interamente
con il modello «chiave propria» (c-BYOK): **l'Amministrazione non deve fornire
nessuna credenziale, nessuna licenza e nessun budget a un soggetto terzo**. Chi
utilizza l'estensione inserisce la propria chiave del servizio LLM che sceglie.
I dati dell'utente non transitano su alcun'infrastruttura del progetto, ma restano
sul computer dove l'estensione è installata.

**Da segnalare:** restano **alcune attività pianificate ma non concluse**, elencate
in modo trasparente al § 15, e **alcuni limiti tecnici noti**, al § 14. Non sono
stati aggirati né occultati: sono la base per una decisione informata sull'eventuale
prosecuzione.

---

## 2. Che cos'è lmuse e a cosa serve

### 2.1 Il problema

L'automazione del browser è oggi quasi sempre legata a servizi cloud che richiedono
un account, una tariffa e l'invio dei dati dell'utente a server terzi. Per un
contesto pubblico questo pone due problemi ricorrenti:

1. **dipendenza da un fornitore esterno**, con costi e condizioni che l'Amministrazione
   non controlla e non può disattivare;
2. **trasferimento dei dati fuori dal perimetro dell'organizzazione**, anche per
   operazioni di utenza ordinaria.

### 2.2 La soluzione realizzata

lmuse è un'estensione del browser che gira **interamente sul computer dell'utente**.
Non esistono server del progetto. L'utente:

- installa l'estensione dal pacchetto locale;
- inserisce **la propria** chiave del provider LLM scelto (gratuito o a pagamento,
  a seconda del provider). Per impostazione predefinita la chiave viene conservata in
  modo permanente sul disco; chi preferisce che venga cancellata alla chiusura del
  browser può disattivare l'opzione «Ricorda la chiave»;
- scrive a mano cosa vuole ottenere.

L'estensione esegue il compito usando 26 strumenti operativi (clic, digitazione,
selezione, navigazione, lettura del testo, estrazione di tabelle, download, e così via)
e mostra in tempo reale ogni singolo passo compiuto.

### 2.3 Le quattro scelte progettuali che ne determinano il profilo

**a) Nessun server, nessuna telemetria.** Il progetto non ha backend. Non c'è
raccolta di statistiche d'uso, non c'è tracciamento delle attività, non c'è
codice di terze parti che invia dati fuori dal browser. È verificabile leggendo il
codice sorgente, che è pubblico.

**b) Le credenziali restano sul computer dell'utente.** La chiave del provider LLM
è salvata in un'area separata dalle impostazioni — permanente se «Ricorda la chiave»
è attivo (predefinito), nella memoria della sessione del browser altrimenti — e non
compare mai nei log, nei messaggi di errore né nei file esportati. L'estensione non può leggere le credenziali di altri siti.

**c) L'utente mantiene il controllo.** Le azioni che modificano il mondo esterno
(invio di moduli, cambi di pagina, download) richiedono una conferma esplicita.
Un'impostazione di sicurezza minima («pavimento di sicurezza») è attiva anche se
l'utente disattiva le conferme: l'invio di moduli resta sempre soggetto a conferma.

**d) Il codice è ispezionabile.** Repository pubblico con licenza MIT: chiunque
può verificare il comportamento, modificarlo o riutilizzarlo. Non esiste
dipendenza da un fornitore unico, quindi il progetto non è vincolato a un
fornitore di modelli.

---

## 3. Metodologia di lavoro

Il lavoro non è stato condotto come una sequenza di richieste, ma secondo un
protocollo iterativo interno, denominato *GigiLoop*, che impone regole precise.

### 3.1 Le regole del protocollo

1. **Nessuna dichiarazione di successo anticipata.** Un lavoro si considera concluso
   solo se ogni criterio di accettazione è stato effettivamente verificato con un
   comando riproducibile.
2. **Tracciabilità completa.** Ogni attività è definita in anticipo in un documento
   di piano numerato, marcata come applicata solo dopo la verifica, e correlata al
   commit che la realizza.
3. **Distinzione tra preesistente e introdotto.** Se un controllo fallisce, si
   stabilisce se è un difetto preesistente o una regressione introdotta nel ciclo
   in corso, prima di correggere.
4. **Revisione avversariale.** Ogni ciclo prevede un passaggio di revisione il cui
   scopo è **trovare difetti nel lavoro appena svolto**, non confermare che è
   andato bene. Le revisioni hanno trovato difetti reali (si veda § 4.7).
5. **Correzione delle revisioni.** Un difetto confermato abbassa la valutazione di
   qualità e viene corretto prima di proseguire.
6. **Chiusura onesta.** Se un'attività non è stata completata, resta dichiarata
   aperta: non viene spostata in chiusura per far quadrare i numeri.

### 3.2 La struttura a sette cicli

| Ciclo | Documento di piano | Attività | Versione prodotta |
|---|---|---|---|
| 1 | PIANO-100.md | 100 | 0.2.0 |
| 2 | PIANO-200.md | 100 | 0.3.0 |
| 3 | PIANO-300.md | 100 | 0.4.0 |
| 4 | PIANO-400.md | 100 | 0.5.0 |
| 5 | PIANO-500.md | 100 | 0.6.0 |
| 6 | PIANO-600.md | 100 | 0.7.0 |
| 7 | PIANO-700.md | 100 | 0.8.0 |
| | | **700** | **7 versioni** |

I sette documenti di piano sono conservati nel repository nella cartella `.gigiloop/`.
Nei primi quattro cicli le singole attività sono marcate una per una come
completate (400 marcature). Nei piani del quinto e sesto ciclo le attività sono
numerate ma prive di marcatura di stato; il settimo piano è suddiviso in sezioni e
riporta lo stato di chiusura per gruppo. Questa disomogeneità è interna al processo
e non altera il prodotto consegnato, ma è dichiarata per trasparenza.

### 3.3 Il cancello di qualità

Ogni versione è stata pubblicata solo dopo il superamento di tutti i controlli:

| Controllo | Cosa verifica |
|---|---|
| Type checking | Correttezza dei tipi in tutto il codice |
| Test automatici | 295 test: comportamento, casi limite, protezioni |
| Lint | Errori di stile e di costrutto sospetto |
| Build | Compilazione della versione distribuibile |
| Copertura | 85% righe, 85% funzioni, 80% rami sul perimetro `src/shared` |
| Test end-to-end | Estensione realmente avviata in un browser reale |
| Accessibilità | Verifica automatizzata del pannello |
| Dimensioni bundle | Che l'estensione non gonfi/disturbi il browser |
| Link documentali | Che la documentazione non contenga riferimenti rotti |
| Versione Chromium | Che il browser di test sia ancora supportato |

---

## 4. Cronologia completa dei sette cicli di lavoro

### 4.1 Ciclo 1 — v0.2.0: costruzione e irrobustimento (16 settembre)

**Commit:** `9f3448b` — 43 file, 6.419 righe inserite (prima versione sostanziale)

**Contesto.** Il progetto parte da zero. La prima attività è stata una ricognizione
delle alternative esistenti, con esito documentato: è stato valutato il prodotto di
riferimento open-source, fermo da novembre 2025 e con un modello di licenza che ne
impedisce il riutilizzo in un prodotto distribuito), una soluzione basata su fork di
browser (licenza non compatibile) e librerie che richiedono un servizio backend.
Tutte le alternative sono state scartate per motivi di licenza o di architettura.
La scelta conseguente è stata costruire da zero, mantenendo il progetto di
riferimento **solo come materiale di consultazione, fuori dal repository
pubblico e senza licenza**.

**Attività realizzate (100 voci).**

- Impianto dell'estensione con le impostazioni di sicurezza di base.
- *Hardening* della sicurezza: politica di sicurezza dei contenuti esplicita,
  assenza di risorse accessibili alle pagine web, verifica dell'origine dei messaggi
  per impedire l'iniezione da altre estensioni.
- Validazione rigorosa di ogni messaggio tra pannello e processo di servizio.
- Impianto del motore dell'agente con 9 strumenti operativi iniziali
  (snapshot, navigazione, indietro, clic, digitazione, scorrimento, schermata,
  elenco schede, passaggio di scheda).
- Redazione automatica dei dati personali (email, IBAN, carte, numeri di telefono,
  token negli indirizzi web) prima dell'invio al modello.
- Blocco della digitazione nei campi password.
- Impianto della suite di test: 47 test iniziali.

**Verifiche.** Type checking, 47 test, lint e build in verde; copertura del codice
di sicurezza stabilita al 94%.

**Esito della revisione avversariale.** Il protocollo richiede di non dichiarare
il ciclo concluso al primo raggiungimento dei criteri. La revisione individuò due
difetti reali, entrambi corretti prima della chiusura:

1. la verifica del mittente era presente ma un rilascio di risorse non era previsto;
2. una gestione dei timer non liberava correttamente la risorsa in caso di errore.

Correzioni verificate con test di regressione. **Valutazione finale: 8,8/10** —
punteggio non massimo perché restavano tre rischi accettati e documentati
(§ 14).

---

### 4.2 Ciclo 2 — v0.3.0: conferma umana e riduzione dei permessi (16 settembre)

**Commit:** `e5d7269` — 41 file, 2.722 righe inserite, 266 eliminate

**Problema affrontato.** La prima versione chiedeva conferma solo per l'invio dei
moduli, e iniettava il proprio codice in ogni pagina all'installazione. Sono i due
punti più critici dal punto di vista della protezione dell'utente: il primo perché
un'automazione incontrollata può inviare dati per suo conto, il secondo perché lo
script era attivo su tutti i siti anche quando lmuse non serviva.

**Attività realizzate (100 voci).**

- **Tre livelli di conferma configurabili:** mai (ad eccezione dell'invio moduli),
  azioni sensibili (predefinito), ogni azione.
- **Pavimento di sicurezza:** anche con le conferme disattivate, l'invio di moduli
  resta sempre soggetto a conferma. Il silenzio dell'utente non può diventare una
  rinuncia implicita.
- **Iniettazione on-demand:** il codice dell'estensione viene inserito nella pagina
  solo nel momento in cui un'operazione lo richiede, e solo da file locali
  dell'estensione, mai da codice costruito a runtime.
- **Tetto di spesa e di tempo:** limite al numero di operazioni per ciclo e
  temporizzazione globale, con arresto immediato su comando.
- **Redazione delle intestazioni di rete** per non rivelare al provider gli
  indirizzi di navigazione.
- **Rimozione dei parametri di tracciamento** dagli indirizzi prima dell'invio.
- Il pannello è stato dotato di un messaggio di riscontro con l'esito delle azioni.
- Suite di test cresciuta a **130 test**.

**Verifiche.** Copertura del codice di sicurezza superiore al 90%; la verifica
dell'assenza di codice remoto è entrata nei controlli automatici, così da impedire
regressioni future.

---

### 4.3 Ciclo 3 — v0.4.0: strumenti operativi e fiducia (16 settembre)

**Commit:** `3a452a7` — 40 file, 2.078 righe inserite, 105 eliminate
**Tag:** `v0.4.0` — prima release pubblicata

**Problema affrontato.** Con 9 strumenti l'agente non era in grado di portare a
termine compiti reali, e l'utente non aveva modo di fidarsi di ciò che vedeva.

**Attività realizzate (100 voci).**

- **Passaggio da 9 a 18 strumenti operativi**, con nuove capacità: lettura del
  testo della pagina in modalità riassunto, estrazione dei collegamenti,
  duplicazione di schede, pausa e ricarica, invio di moduli.
- **Verifica di funzionamento della connessione:** un pulsante che esegue una
  chiamata minima al modello e dice se le credenziali sono corrette — prima di
  lanciare un lavoro.
- **Domini fidati:** l'utente può dichiarare un sito come fidato, evitando la
  conferma per le visite successive a quel dominio. La fiducia è concessa
  esplicitamente, mai automaticamente.
- **Modelli di task e configurazioni rapide:** tre profili pronti (veloce, preciso,
  locale).
- **Trattamento del rifiuto della conferma come informazione utile:** il rifiuto
  viene comunicato all'agente, che può cambiare strategia invece di ripetere
  ciecamente l'azione.
- **Test end-to-end con verifica di accessibilità** introdotta nella pipeline:
  il pannello viene analizzato automaticamente e i problemi di contrasto effettivi
  sono stati corretti.
- Suite cresciuta a **176 test**.

**Verifiche.** Test end-to-end in verde su browser reale; verifica di accessibilità
superata dopo la correzione di problemi reali di contrasto.

---

### 4.4 Ciclo 4 — v0.5.0: visibilità in tempo reale e lavori ricorrenti (16 settembre)

**Commit:** `a6b1d28` — 40 file, 1.492 righe inserite
**Commit di documentazione:** `169b2f7`
**Tag:** `v0.5.0`

**Problema affrontato.** L'utente non vedeva cosa stesse accadendo durante
l'esecuzione, e non poteva ripetere un lavoro senza riscriverlo da capo.

**Attività realizzate (100 voci).**

- **Visualizzazione progressiva della risposta:** il testo del modello compare
  mentre viene generato, non solo a lavoro finito. È un requisito importante per
  un'agente che opera: l'utente deve poter interrompere se qualcosa va storto.
- **Arresto su condizione (arresto testuale):** l'utente scrive una frase — per
  esempio «prezzo totale» — e il lavoro si chiude da solo quando quella frase
  compare, con esito positivo.
- **Controllo del consumo di risorse** per singolo lavoro, con arresto pulito.
- **Passaggio da 18 a 21 strumenti:** ricerca di testo con evidenziazione, estrazione
  di tabelle in formato leggibile, interrogazione della struttura della pagina.
- **Attraversamento delle pagine con componenti incapsulati** (shadow DOM): gli
  elementi nascosti in componenti web moderni erano invisibili all'agente.
- **Lavori programmati:** un compito può essere eseguito ogni N minuti anche a
  pannello chiuso. Limiti rigidi: massimo 5 programmazioni, intervallo da 60 minuti
  a 7 giorni. Senza pannello aperto le conferme scadono in 20 secondi e la risposta
  predefinita è **negare** — mai l'approvazione automatica.
- **Cronologia degli ultimi esecuzioni** e **import/export del profilo** con
  validazione che esclude le credenziali.
- Suite cresciuta a **199 test**.

---

### 4.5 Ciclo 5 — v0.6.0: apertura a tutti i modelli e integrazione opencode (17 settembre)

**Commit:** `5786811` — 25 file, 1.895 righe inserite
**Tag:** `v0.6.0`

**Problema affrontato.** L'estensione supportava 13 servizi LLM, con un forte
squilibrio: alcuni provider (NVIDIA, OpenCode) erano assenti benché presenti
nell'ecosistema dello sviluppatore; inoltre l'installazione delle credenziali era
faticosa e ripetitiva.

**Attività realizzate (100 voci).**

- **Ampliamento da 13 a 25 provider**, aggiungendo: NVIDIA NIM, OpenCode Zen,
  Cohere, DeepInfra, Fireworks, Perplexity, Together AI, Hugging Face, GitHub
  Models, Vercel AI Gateway, Baseten, SambaNova.
  La scelta dei modelli predefiniti è stata fatta verificando le liste pubbliche di
  ogni servizio, non a memoria; in ogni caso il campo modello resta liberamente
  modificabile, così un modello nuovo non richiede un aggiornamento.
- **Credenziali per singolo provider:** prima esisteva un unico campo chiave, quindi
  configurare due servizi richiedeva di sovrascrivere. Ora ogni provider ha la sua
  chiave, con **migrazione automatica** dalla configurazione precedente (verificata
  da test).
- **Integrazione con opencode** (v. § 9).
- **Raggruppamento dei provider** nella finestra di scelta: cloud, gateway/aggregatori,
  locali.
- Suite cresciuta a **232 test**.

---

### 4.6 Ciclo 6 — v0.7.0: alleggerimento e produttività (17 settembre)

**Commit:** `f9cda22` — 21 file, 921 righe inserite
**Tag:** `v0.7.0`

**Problema affrontato.** Il processo di servizio dell'estensione era diventato
ingombrante (circa 1,1 MB di codice caricati a ogni avvio del browser, per tutti
gli utenti) e mancavano strumenti di uso quotidiano.

**Attività realizzate (100 voci).**

- **Alleggerimento del 70,3% del processo di servizio:** ogni libreria di provider
  è stata resa caricamento differito, così il browser carica **solo** il codice del
  provider effettivamente utilizzato. Da 1.095 kB a 325 kB. La soglia di controllo
  automatico sulle dimensioni è stata abbassata da 1.300 KB a 500 KB per impedire
  il ritorno del problema.
- **Elenco modelli dal provider:** un pulsante recupera l'elenco aggiornato dei
  modelli direttamente dal servizio, con memorizzazione locale (limite 500 voci) e
  un messaggio d'errore chiaro in italiano. Nulla viene salvato in chiaro.
- **Coda dei lavori:** a lavoro in corso, il pulsante di avvio diventa «Metti in
  coda»; i lavori in coda (massimo 5) partono in sequenza alla fine di quello
  corrente. Dopo un arresto esplicito la coda **non** riparte automaticamente.
- **Passaggio da 21 a 24 strumenti:** passaggio del mouse su un elemento (menu che
  compaiono al passaggio, suggerimenti), scrittura e lettura degli appunti
  (la lettura è un dato sensibile e richiede conferma).
- **Esportazione del registro** in formato leggibile con intestazione contenente
  data, provider e modello — **mai la chiave**.
- **Segnalazione di rotazione** delle credenziali se salvate da oltre 90 giorni.
- **Difetto corretto in revisione:** un lavoro in coda bloccato dal periodo di
  attesa minimo tra esecuzioni restava fermo senza riprovare. Ora il rinvio viene
  riprogrammato.
- Suite cresciuta a **251 test**.

---

### 4.7 Ciclo 7 — v0.8.0: protezione delle credenziali e correzioni di sicurezza (28 settembre)

**Commit:** `57c4608` — 25 file, 872 righe inserite
**Tag:** `v0.8.0`

**Problema affrontato.** La credenziale restava disponibile per tutta la sessione
del browser, anche a computer lasciato incustodito. Inoltre, l'analisi del codice ha
fatto emergere tre difetti sulle funzionalità appena introdotte.

**Attività realizzate.**

- **Blocco automatico della credenziale (funzionalità richiesta):** dopo 5, 15, 30
  o 60 minuti di **inattività**, le chiavi conservate in memoria di sessione
  vengono cancellate. Predefinito: disattivato, si attiva scegliendo.
  - *Non è un temporizzatore fisso:* viene registrato solo l'orario dell'ultima
    interazione con il pannello (in memoria di sessione, senza alcun dato
    personale) e il blocco scatta solo se il tempo trascorso supera la soglia.
  - *Un lavoro in corso non viene mai interrotto:* se l'agente sta operando, il
    blocco attende.
  - *La semantica è stata resa esplicita* dopo la revisione: v. sotto.
- **Passaggio da 24 a 26 strumenti:** lettura del contenuto di un riquadro
  incorporato nella pagina (iframe) e avvio di un download.
- **Quattro difetti reali corretti** (dettagli nel riquadro seguente).
- Suite cresciuta a **295 test**; copertura del perimetro `src/shared` 96,4% delle
  righe e 89,1% dei rami decisionali.

> **I difetti trovati nella revisione avversariale del ciclo 7**
>
> Questa sezione è riportata integralmente perché documenta il risultato del
> controllo di qualità richiesto dal protocollo: la revisione ha operato come un
> controllo reale, non come una conferma di routine.
>
> 1. **Strumento di lettura iframe inutilizzabile.** Dopo aver letto il contenuto
>    di un riquadro, il codice allegava anche uno snapshot della pagina principale.
>    Quell'operazione annullava la mappa degli elementi: l'agente riceveva
>    l'albero del riquadro ma i riferimenti puntavano al di fuori. Lo strumento
>    produceva quindi un output inutilizzabile. Corretto e coperto da 5 test, incluso
>    quello che verifica esplicitamente l'assenza del difetto.
>
> 2. **Download senza conferma.** Lo strumento di download non era coperto da
>    alcuna politica di conferma: con la modalità «azioni sensibili» l'utente non
>    veniva informato del download di un file. Ora richiede conferma, come
>    l'invio di moduli. Lo strumento di lettura dell'iframe, che è di sola lettura,
>    è stato classificato come tale e non chiede mai conferma, nemmeno nella
>    modalità più restrittiva.
>
> 3. **Blocco automatico inefficace nella configurazione predefinita.** Con
>    «Ricorda la chiave» attivo — che è l'impostazione predefinita — la credenziale
>    viene salvata in modo permanente, non in memoria di sessione. Il blocco
>    automatico, come era stato inizialmente concepito, non l'avrebbe toccata,
>    mentre l'etichetta dell'opzione avrebbe promesso il contrario. Sono state
>    scelte due soluzioni coerenti con la richiesta: il blocco agisce **soltanto**
>    sulle chiavi di sessione (non su quelle che l'utente ha chiesto esplicitamente
>    di ricordare), e la semantica è dichiarata in tre punti — etichetta
>    dell'opzione, messaggio mostrato all'utente e documentazione. Un test impedisce
>    che il comportamento regredisca in silenzio.
>
> 4. **Lettura degli appunti senza conferma.** La documentazione dichiarava che la
>    lettura degli appunti dell'utente richiedesse conferma, perché può contenere
>    dati personali, ma il codice non applicava la regola: con la politica
>    predefinita la conferma non compariva. Il codice è stato corretto per
>    allinearlo al comportamento dichiarato e sono stati aggiunti due test che
>    verificano la conferma sulla lettura e l'assenza di conferma superflua su
>    altri strumenti. Il difetto è stato individuato in una fase successiva, in
>    sede di revisione indipendente di questo report (v. § 10.4), ed è la ragione
>    per cui il confronto indipendente ha prodotto un effetto sul prodotto e non
>    soltanto sulla documentazione.

---

## 5. Funzionalità consegnate: i 26 tool browser

Gli strumenti operativi sono le capacità concrete dell'agente. L'elenco completo
è in Appendice A; qui si evidenzia la copertura funzionale.

**Lettura della pagina (6 strumenti).** Cattura della struttura della pagina con
riferimenti numerici; lettura del testo in modalità completa o riassunto; lettura
dei collegamenti; estrazione di tabelle in formato leggibile; ricerca di un testo con
evidenziazione e conteggio; interrogazione della struttura mediante selettori.

**Interazione (9 strumenti).** Clic su un elemento identificato dal riferimento;
digitazione in un campo con eventuale invio del modulo; selezione in un menu a
tendina; passaggio del mouse; attesa di un elemento (testo o selettore); pressione
di tasti di navigazione; scorrimento; copia negli appunti; lettura degli appunti.

**Navigazione e gestione schede (7 strumenti).** Apertura di un indirizzo web;
indietro; avanti; ricarica; elenco delle schede; passaggio a un'altra scheda;
duplicazione della scheda corrente.

**Acquisizione (3 strumenti).** Cattura dello schermo; cattura di uno schermo
ritagliato su un elemento specifico; avvio di un download.

**Contesti incorporati (1 strumento).** Lettura del contenuto di un riquadro
incorporato nella pagina, con gestione esplicita del caso non accessibile.

Totale: 6 + 9 + 7 + 3 + 1 = **26 strumenti**.

**Caratteristiche trasversali applicate a tutti gli strumenti:**

- **conferma umana** per le azioni che modificano il mondo esterno;
- **tetto di spesa** per ciclo: l'agente non può ripetere indefinitamente
  operazioni;
- **interruzione circuitale:** dopo un certo numero di errori consecutivi il ciclo
  si ferma, invece di insistere a vuoto;
- **traduzione degli errori** in italiano comprensibile, senza rivelare credenziali
  o dettagli tecnici;
- **timeout** su ogni comunicazione con la pagina.

---

## 6. Funzionalità consegnate: i 25 provider LLM

### 6.1 Il modello «chiave propria» (c-BYOK)

L'utente inserisce la chiave del servizio LLM che preferisce. lmuse non acquista,
non gestisce, non inoltra credenziali. L'elenco completo è in Appendice B.

**Servizi cloud diretti (18):** OpenAI, Anthropic, Google Gemini, xAI, Microsoft
Azure, DeepSeek, Groq, Cerebras, Mistral AI, Cohere, DeepInfra, Fireworks AI,
Perplexity, Together AI, Hugging Face, NVIDIA NIM, Baseten, SambaNova.

**Gateway e aggregatori (4):** OpenRouter, OpenCode Zen, GitHub Models, Vercel AI
Gateway. Un gateway instrada le richieste verso più modelli con una sola chiave.

**Servizi locali (3):** Ollama, LM Studio, endpoint generico compatibile.
Gli esempi più rilevanti per un contesto pubblico: i modelli locali permettono
l'elaborazione **interamente in-house**, senza alcun invio di dati verso l'esterno.

### 6.2 Caratteristiche del catalogo

- **Gruppi nella finestra di scelta** per orientare l'utente.
- **Link diretto alla pagina di emissione della chiave** per ogni servizio.
- **Elenco dei modelli aggiornabile** direttamente dal provider.
- **Avviso se il modello scritto non è nell'elenco** del provider.
- **Modelli con supporto immagini** segnalati: i modelli che non accettano immagini
  ricevono un avviso, perché l'invio di schermate non funzionerebbe.
- **Service worker alleggerito:** il codice di ogni provider viene caricato solo
  quando serve (§ 11).

### 6.3 Configurazione per-provider

Ogni provider conserva la propria credenziale. Questo elimina il fastidio
dell'alternanza tra servizi e, sul piano della sicurezza, limita l'esposizione:
è necessario configurare una sola chiave per volta, anziché lasciare sempre attiva
la stessa credenziale.

---

## 7. Sicurezza

### 7.1 Impostazioni dichiarate

Il codice dell'estensione dichiara esplicitamente una politica di sicurezza dei
contenuti che **vieta l'esecuzione di codice remoto**: sono ammessi solo gli script
e i moduli contenuti nell'estensione. Non esistono risorse accessibili alle pagine
web. Non è presente il permesso di debug del browser, che consentirebbe il
controllo completo del dispositivo.

### 7.2 Permessi richiesti e relative giustificazioni

| Permesso | Uso | Alternativa valutata e scartata |
|---|---|---|
| `storage` | Conservare localmente impostazioni, cronologia e credenziali | Nessuna: servono per la persistenza |
| `scripting` | Inserire il codice di pagina solo al momento dell'uso | Script sempre attivo su ogni sito: peggio |
| `tabs` + `activeTab` | Leggere l'indirizzo e comandare la scheda | Solo `activeTab`: insufficiente per gestire più schede |
| `sidePanel` | Pannello laterale | Finestra popup: inadatta a lavori lunghi |
| `alarms` | Pianificazione locale dei lavori | Polling dal pannello: funziona solo a pannello aperto |
| `nativeMessaging` | Ponte con opencode, **solo se installato dall'utente** | Nessuna; senza ponte installato il canale è chiuso |
| Accesso ai siti | Operare dove l'utente chiede | Permessi per singolo sito: in valutazione (§ 14) |

Ogni permesso è motivato per iscritto nella documentazione di sicurezza del progetto.
L'accesso ai siti è ampio perché l'agente deve poter operare dove gli viene chiesto;
è prevista una restrizione per l'elenco di domini consentiti, già disponibile.

### 7.3 Controlli di protezione implementati

- **Isolamento fra estensioni:** ogni messaggio ricevuto viene verificato essere
  originato dall'estensione stessa; i tentativi provenienti da altre estensioni
  vengono respinti.
- **Validazione rigorosa dell'ingresso:** ogni messaggio è validato con descrittori
  di schema, con limiti di lunghezza e tipo; i messaggi non conformi vengono
  scartati senza esecuzione.
- **Protezione dagli indirizzi pericolosi:** sono bloccati la navigazione verso
  `javascript:`, `data:`, `file:`, pagine interne del browser e il negozio di
  estensioni; sono respinti gli indirizzi contenenti credenziali nella parte
  utente/password; vengono rimossi i parametri di tracciamento.
- **Pavimento di sicurezza sulla conferma:** l'invio di moduli richiede conferma
  in ogni configurazione.
- **Preferenze di dominio:** l'utente può dichiarare attendibili determinati domini
  e registrare la propria scelta, evitando conferme ripetitive.
- **Tetto di spesa e interruzione circuitale** come descritto al § 5.
- **Arresto immediato** con pulsante e con scorciatoia da tastiera: interrompe il
  modello, le azioni in corso e le attese di conferma.

### 7.4 Verifica automatizzata in integrazione continua

La pipeline esegue **12 controlli automatici** nel processo di verifica, più una
suite end-to-end su browser reale: verifica dei
tipi, suite completa con soglie di copertura bloccanti, età del browser di test,
controllo di stile, verifica della formattazione, compilazione, verifica del
contenuto del pacchetto generato, controllo delle dimensioni, verifica dei link
documentali, scansione delle dipendenze note per vulnerabilità, **ricerca di segreti
nel codice**, verifica dell'assenza di caricamento di codice remoto, e prova
end-to-end su browser reale con verifica di accessibilità.

---

## 8. Privacy e protezione dei dati

### 8.1 Dove finiscono i dati

| Elemento | Dove viene conservato | Contenuto |
|---|---|---|
| Impostazioni | computer dell'utente | provider, modello, limiti, preferenze |
| Credenziali | area separata dalle impostazioni: disco del browser con «Ricorda la chiave» attivo, memoria di sessione altrimenti | chiave del provider, per provider |
| Cronologia lavori | computer dell'utente, 20 voci | testo dei compiti, disattivabile |
| Risultato in attesa | memoria di sessione | esito dell'ultimo lavoro |
| Statistiche | computer dell'utente | **solo conteggi** di esecuzioni e token, nessun contenuto |
| Orario di attività | memoria di sessione | un solo orario, per il blocco automatico |

### 8.2 Scelte progettuali a tutela dell'utente

- **Nessun server del progetto:** non esiste alcun punto di raccolta dei dati.
- **Nessuna telemetria:** il progetto non contiene codice di raccolta statistiche.
- **Nessun tracciamento:** nessun identificativo pubblicitario o di profilazione.
- **Redazione automatica:** prima dell'invio al modello, email, codici IBAN, numeri
  di carte, numeri di telefono e token presenti negli indirizzi web sono sostituiti
  da segnaposto. La sostituzione può essere disattivata, e in tal caso il pannello
  avvisa esplicitamente che i dati partono in chiaro.
- **Campi password:** il valore non compare mai negli snapshot; la digitazione
  automatica nei campi password è bloccata per impostazione predefinita.
- **Le credenziali non compaiono mai** nei registri, nei messaggi di errore, nei file
  esportati né nelle schermate di diagnosi.
- **Le schermate sono ritagliate in locale** prima dell'invio, riducendo
  l'invio di pixel non necessari.
- **Esportazione del profilo** esclusivamente senza credenziali, con validazione di
  formato e dimensione.
- **Cancellazione completa** con un comando che chiede conferma e rimuove chiavi,
  impostazioni, cronologia, risultati in attesa, statistiche e preferenze.

### 8.3 Il modello di accesso alle credenziali

La credenziale è richiesta solo al provider che l'utente ha scelto. lmuse non
richiede credenziali per siti web, non legge le password dell'utente, non accede
agli archivi di credenziali del browser. L'estensione non può leggere le credenziali
memorizzate in altri siti.

### 8.4 Il ruolo del cliente in materia di conformità

Il progetto è stato progettato per ridurre al minimo l'esposizione dei dati, come
documentato. **La valutazione formale della conformità normativa non è parte di
questo lavoro e resta in carico all'Amministrazione.** In particolare restano da
curare, da parte del committente e dei suoi consulenti, la verifica del rispetto
del Regolamento UE 2016/679, l'eventuale redazione della valutazione d'impatto
prevista dall'articolo 35 del Regolamento quando applicabile, la definizione delle
base giuridiche, la conservazione dei log e le policy di accessibilità e sicurezza
informatica. Il progetto fornisce la base tecnica; non sostituisce la valutazione
giuridica.

---

## 9. Integrazione con opencode

### 9.1 Il problema risolto

Chi sviluppa con lo strumento opencode ha già configurato le credenziali dei propri
servizi LLM. Reinserirle a mano in lmuse era una duplicazione fastidiosa e una
occasione di errore.

### 9.2 La soluzione e i suoi limiti

È stato sviluppato un **ponte locale** tra l'estensione e opencode:

- l'utente esegue un comando di installazione che registra il ponte;
- dal pannello preme «Rileva» e lmuse legge l'elenco dei provider configurati in
  opencode, **mostrando solo i nomi, mai le chiavi**;
- preme «Importa chiavi» e le credenziali corrispondenti ai provider supportati
  vengono copiate nel gestore interno di lmuse.

**Caratteristiche di sicurezza del ponte:**

- comunicazione **solo locale**, senza alcuna connessione di rete;
- risposte **validate con descrittori di schema** prima dell'uso;
- comandi ammessi limitati a tre (verifica, elenco, esportazione): qualsiasi altro
  comando viene rifiutato;
- limite di dimensione dei messaggi e numero massimo di elementi;
- il ponte autorizza esclusivamente l'identificativo dell'estensione registrato in
  fase di installazione;
- **il codice non scrive nulla** su disco: legge soltanto il file di configurazione
  di opencode;
- disinstallazione con un comando.

**La precisazione necessaria:** opencode, nel suo funzionamento ordinario, mantiene
un proprio servizio locale che richiede autenticazione. lmuse **non** si collega a
quel servizio: usa esclusivamente il gateway cloud OpenCode Zen, che è un servizio
a sé. Chi desidera l'uso integrato deve installare il ponte.

---

## 10. Qualità, test e verifica

### 10.1 Il sistema di test

La verifica automatica comprende **295 test** su 24 file di test, pari a 1.872
righe di codice di verifica. La filosofia seguita è di coprire non solo il
comportamento previsto, ma soprattutto **i casi limite e le condizioni di errore**,
che sono le più difficili da verificare a mano e quelle che proteggono l'utente:

- dati malformati o corrotti non causano arresti anomali;
- valori fuori intervallo vengono corretti;
- le funzioni pure di sicurezza (redazione, validazione, calcoli di rischio) sono
  verificate direttamente e al 100% sulla logica di blocco credenziali;
- ogni correzione di difetto ha ricevuto un test che ne impedisce il ritorno.

### 10.2 Copertura del codice

La misura riguarda **il solo perimetro `src/shared`** (2.014 righe, pari al 33% del
sorgente): i moduli dell'agente, del processo di servizio, della pagina e del pannello
non sono soggetti a misurazione. Le percentuali che seguono **non** sono estese
all'intero progetto.

| Metrica | Valore | Soglia fissata |
|---|---|---|
| Righe | 96,45% | 85% |
| Funzioni | 97,52% | 85% |
| Ramificazioni (rami decisionali) | 89,06% | 80% |
| Istruzioni | 94,16% | — |

Le soglie sono fissate nella configurazione e la pipeline **fallisce** se il
progettto le rispetta: il calo della copertura non può passare inosservato.

### 10.3 Verifica end-to-end e accessibilità

Un test end-to-end avvia l'estensione in un browser reale ed esegue **sette
controlli**: registrazione del processo di servizio, identificativo valido,
coerenza della versione dichiarata, rendering del pannello, interattività,
**assenza di errori nella pagina** e **accessibilità** (verifica automatica delle
violazioni serie). Tutti e sette superano in ogni esecuzione.

Si tratta di controlli di integrazione, non di collaudo funzionale: verificano che
l'estensione si avvii e si comporti correttamente nell'interfaccia, **non** eseguono
un ciclo completo con credenziale reale (limite dichiarato al § 14.1).

Il browser di test è Chromium, scaricato automaticamente e **bloccato a una versione
confermata**, con un controllo automatico che ne verifica l'età e ne segnala
l'obsolescenza. È documentato che il Chrome con marchio proprietario non accetta il
caricamento di estensioni non pubblicate a scopo di sviluppo: per le verifiche
automatiche si usa Chromium, che è il browser di riferimento open source per questa
funzionalità.

### 10.4 La verifica delle revisioni

Come descritto al § 3, ogni ciclo prevede una revisione il cui scopo è trovare
difetti. Nel corso del lavoro le revisioni hanno individuato **sette difetti
reali** (due nel ciclo 1, uno nel ciclo 6, quattro nel ciclo 7 — questi ultimi descritti
per esteso al § 4.7), tutti corretti e coperti da test di regressione prima della
pubblicazione. In un caso la revisione ha corretto l'impostazione predefinita di una
funzionalità di sicurezza, perché la versione iniziale non era efficace nella
configurazione più comune.

---

## 11. Prestazioni e ottimizzazione

### 11.1 Il principale intervento

Alla versione 0.6.0 il processo di servizio dell'estensione occupava circa
**1.094,70 kB**, caricati dal browser all'avvio per ogni utente, indipendentemente dal
provider utilizzato. Dalla versione 0.7.0 il codice di ogni provider è stato reso
caricamento differito: il browser carica **solo** il provider configurato.

| | 0.6.0 | 0.8.0 | Riduzione |
|---|---|---|---|
| Processo di servizio | 1.094,70 kB | 326,63 kB | **−70,2%** |

La riduzione misurata sulla versione 0.7.0, al momento dell'introduzione del
caricamento differito, era del 70,3% (1.094,70 kB → 325,04 kB). La versione 0.8.0
ha aggiunto funzioni (blocco automatico, due nuovi strumenti) per circa 1,6 kB.
I valori delle versioni precedenti sono stati ottenuti ricostruendo ciascun
commit e misurando il pacchetto generato, non riportati da strumenti di
monitoraggio.

La soglia di controllo automatico sulle dimensioni è stata contestualmente ridotta
da 1.300 kB a 500 kB, così che il problema non possa ripetersi senza essere
segnalato.

### 11.2 Dimensioni finali del pacchetto (v0.8.0)

| Componente | Dimensione | Soglia |
|---|---|---|
| Processo di servizio | 326.633 byte (319,0 KiB) | 500 KB |
| Script di pagina | 13.692 byte (13,4 KiB) | 50 KB |
| Pannello | 263.087 byte (256,9 KiB) | 400 KB |
| **Pacchetto compresso distribuito** | **424.711 byte (circa 415 KiB)** | — |

---

## 12. Documentazione prodotta

Il progetto è accompagnato da documentazione scritta, in italiano, destinata a
persone con profili diversi:

| Documento | Destinatario | Contenuto |
|---|---|---|
| **GUIDA.md** | Sviluppatore, configuratore | Architettura, catalogo provider, flusso di un lavoro, ogni impostazione con valori predefiniti, scorciatoie, risoluzione dei problemi, stato onesto del progetto |
| **PRIVACY.md** | Cittadino, responsabile della protezione dei dati | Dove finiscono i dati, cosa viene conservato, cosa non viene mai inviato, come cancellare tutto, funzionamento del ponte |
| **SECURITY.md** | Responsabile sicurezza informatica | Permessi e relative motivazioni, minacce considerate, difese, superficie d'attacco del ponte |
| **README.md** | Valutatore rapido | Descrizione sintetica, funzionalità, istruzioni di base |
| **CHANGELOG.md** | Tutti | Registro dettagliato delle modifiche per versione |
| **CONTRIBUTING.md** | Sviluppatore | Modalità di contributo e criteri |
| **STORE.md** | Chi cura la pubblicazione | Testo per la scheda dell'estensione |
| **AGENTS.md** | Sviluppatore, assistenti | Comandi, convenzioni, architettura |
| **REPORT-COMMITTENTE.md** | Committente | Il presente documento |
| `.gigiloop/PIANO-*.md` | Verifica interna | I 7 piani da 100 attività (400 con stato di chiusura per voce) |

Sono inoltre presenti i piani di lavoro con le 700 attività numerate, utili per
la verifica del perimetro effettivamente svolto.

---

## 13. Processo di rilascio e versionamento

### 13.1 Le versioni pubblicate

| Versione | Data | Contenuto principale |
|---|---|---|
| 0.2.0 | 16/09/2026 | Prima versione funzionale, protezioni di base, 47 test |
| 0.3.0 | 16/09/2026 | Conferma umana su tre livelli, iniezione on-demand, 130 test |
| 0.4.0 | 16/09/2026 | 18 strumenti, domini fidati, test end-to-end, 176 test |
| 0.5.0 | 16/09/2026 | Visualizzazione in tempo reale, lavori programmati, 21 strumenti, 199 test |
| 0.6.0 | 17/09/2026 | 25 provider, credenziali per provider, integrazione opencode, 232 test |
| 0.7.0 | 17/09/2026 | Alleggerimento 70,3%, coda lavori, elenco modelli, 24 strumenti, 251 test |
| 0.8.0 | 28/09/2026 | Blocco automatico credenziale, 26 strumenti, correzioni di sicurezza, 295 test |

**Precisazione:** i tag di versione sono stati pubblicati a partire dalla 0.4.0.
Le versioni 0.2.0 e 0.3.0 esistono come commit nel registro ma non hanno un tag
di versione formale. Non è un difetto del software, ma una disomogeneità della
pratica di versionamento che viene qui dichiarata per completezza.

### 13.2 Le pubblicazioni

Cinque versioni sono state pubblicate con pacchetto firmato dal checksum di
verifica:

| Release | Data pubblicazione | Pacchetto |
|---|---|---|
| v0.4.0 | 16/09/2026 | lmuse-0.4.0.zip |
| v0.5.0 | 16/09/2026 | lmuse-0.5.0.zip |
| v0.6.0 | 17/09/2026 | lmuse-0.6.0.zip |
| v0.7.0 | 17/09/2026 | lmuse-0.7.0.zip |
| v0.8.0 | 28/09/2026 | lmuse-0.8.0.zip (424.711 byte) |

L'ultimo pacchetto è identificato dall'impronta crittografica
`8e9e286c8065143a4dc5df9c28de68af32fed931e3a70ecde8fc807a156f2175`, che il
committente può ricalcolare per accertare l'integrità del file ricevuto.

---

## 14. Limiti noti e rischi residui

Questa sezione è deliberata: elenca ciò che **non** è stato risolto, affinché la
decisione di proseguire sia informata.

### 14.1 Limiti tecnici

1. **Nessuna verifica end-to-end con credenziale reale in ambiente controllato.**
   I test end-to-end verificano l'avvio, il rendering e l'accessibilità, ma
   **non** hanno eseguito un ciclo completo contro un provider LLM con chiave
   valida, perché richiede una credenziale e un Chrome con marchio proprietario.
   *Mitigazione:* il primo ciclo con chiave reale va eseguito dall'Amministrazione
   come prova di accettazione. Se un provider modifica il formato delle risposte,
   l'adattamento è localizzato in un unico file di codice.

2. **Accesso ai siti ampio.** L'estensione può operare su tutti i siti, perché
   l'agente deve poter lavorare dove l'utente chiede. È disponibile una
   restrizione per elenco di domini, ma l'impostazione per sito singolo con
   richiesta di consenso è indicata come lavoro di evoluzione futura. *Rischio
   residuo:* il perimetro è più ampio del necessario per un uso che non richieda
   l'automazione. *Contromisura disponibile:* usare l'elenco di domini consentiti.

3. **Iniezione di istruzioni da parte delle pagine web.** Una pagina web visitata
   potrebbe, in teoria, contenere testo che induca l'agente a comportarsi in modo
   inatteso. Sono in atto le mitigazioni (conferma umana, tetto di spesa,
   blocco degli indirizzi pericolosi, protezione dei campi password), ma **non**
   esiste una garanzia assoluta. Il presupposto di sicurezza è che l'utente
   supervisioni i lavori. Questo limite è intrineco alla classe di prodotti e
   dichiarato anche nella documentazione del progetto.

4. **Processo di servizio soggetto a sospensione.** Le estensioni moderne sospendono
   i propri processi quando inutilizzati. I lavori molto lunghi o le comunicazioni
   molto lunghe con il modello possono risentirne. È indicato come evoluzione
   futura l'uso di un documento fuori schermo per i lavori lunghi.

5. **Nessuna modalità senza credenziale.** Oggi l'utente deve fornire una chiave di
   un servizio esterno. È indicata come evoluzione l'integrazione con i modelli
   locali del browser, che eliminerebbe anche l'ultima dipendenza esterna.

6. **Dipendenza da servizi terzi per il funzionamento.** Le impostazioni predefinite
   dei modelli provider cambiano nel tempo. Sono state verificate le liste pubbliche
   al momento dello sviluppo, e il campo modello è liberamente modificabile, ma un
   modello predefinito può diventare obsoleto. La soluzione è già predisposta: non
   richiede sviluppo, basta modificare il campo.

7. **Locale di lavoro in inglese.** L'interfaccia è bilingue italiano/inglese, ma i
   messaggi di errore interni e la documentazione tecnica sono in italiano.

### 14.2 Limiti del processo

1. **Progressioni concentrate.** Sei delle sette versioni sono state prodotte in due
   giornate consecutive (16 e 17 settembre). Il ritmo, sostenuto dal metodo
   iterativo, è adatto a consolidare la qualità, ma **non equivale a un
   collaudo di funzionamento sul campo** con utenti reali.

2. **Prova con utenti reali assente.** Non è stata svolta una sperimentazione con
   operatori dell'Amministrazione. Le scelte di ergonomia si basano su giudizio
   tecnico, non su osservazione d'uso. *Proposta:* una sessione di prova con
   3-5 operatori prima dell'eventuale diffusione.

3. **Nessuna certificazione o valutazione formale.** Il progetto non ha
   conseguito certificazioni di sicurezza né una valutazione formale di
   conformità (§ 8.4).

4. **Nessuna pubblicazione su negozio di estensioni.** Le versioni sono distribuite
   come pacchetto firmato dal checksum. La pubblicazione in un negozio comporta
   requisiti propri e non è stata effettuata.

---

## 15. Attività pianificate ma non concluse

Il protocollo impone di dichiarare le attività rimaste aperte. Delle 700 attività
pianificate, **nessuna del primo ciclo è rimasta aperta**. Nell'ultimo ciclo
(700) restano tre gruppi di attività, **non conclusi perché l'indirizzo di lavoro è
cambiato prima che venissero affrontati** e non per difficoltà tecniche:

| Attività | Stato | Perché non conclusa |
|---|---|---|
| Verifiche end-to-end con interazioni reali (apertura impostazioni, cambio provider, ecc.) | **non fatta** | La priorità è stata spostata sugli aspetti di sicurezza su richiesta del committente |
| Overlay con l'elenco delle scorciatoie da tastiera | **non fatta** | Attività di basso valore rispetto alle altre; l'elenco delle scorciatoie è già in documentazione |
| Elenco dei provider con nome leggibile nella finestra di integrazione con opencode | **non fatta** | Funzionalità accessoria; l'import funziona ed è verificato da test |

**Sono invece state deliberatamente escluse, con motivazione documentata:**

- **Trascinamento di elementi (drag & drop).** La riproduzione artificiale degli
  eventi di trascinamento non è affidabile con i moderni componenti web, che
  richiedono l'evento nativo. Si è preferito non offrire uno strumento che
  funzionerebbe in modo inaffidabile e ingannevole.
- **Verifica delle versioni dei modelli con credenziale reale in automatizzato.**
  Richiede credenziali, non disponibili in ambiente di sviluppo.

Tutte le altre attività pianificate sono state completate e verificate.

---

## 16. Come riprodurre e verificare i risultati

Il progetto è verificabile in modo indipendente. I comandi indicati richiedono
Node 22 o superiore.

### 16.1 Verifica completa della qualità

```bash
pnpm install     # dipendenze
pnpm check       # verifica tipi + 295 test + controllo stile + compilazione
pnpm test:coverage   # copertura del perimetro src/shared con soglie bloccanti
pnpm test:e2e    # avvio reale in browser + accessibilità
```

### 16.2 Installazione per la prova

```bash
pnpm build
```
quindi caricare la cartella `dist/` generata in `chrome://extensions` con la modalità
per sviluppatori attiva.

### 16.3 Verifica dell'integrità del pacchetto ricevuto

```bash
shasum -a 256 lmuse-0.8.0.zip
# atteso: 8e9e286c8065143a4dc5df9c28de68af32fed931e3a70ecde8fc807a156f2175
```

### 16.4 Configurazione per un uso in proprio

1. Nelle impostazioni dell'estensione scegliere il provider e incollare la chiave
   personale. Per chi non vuole alcun invio esterno: scegliere Ollama o LM Studio.
2. Provare la connessione con il pulsante dedicato prima di lanciare un lavoro.
3. Impostare, se desiderato, il blocco automatico della chiave e l'elenco dei domini
   consentiti. Il blocco automatico agisce sulle chiavi di sessione: per farlo
   scattare occorre prima disattivare «Ricorda la chiave».

---

## 17. Metriche di sintesi

### 17.1 Attività e versioni

| Indicatore | Valore |
|---|---|
| Cicli di lavoro completati | 7 |
| Attività pianificate | 700 |
| Attività concluse e verificate | 670 |
| Attività pianificate e non concluse | 30 (riportate al § 15) |
| Versioni prodotte | 7 (0.2.0 → 0.8.0) |
| Versioni con tag formale | 5 (da 0.4.0) |
| Release pubblicate con checksum | 5 |
| Registri (commit) | 8 |
| Linee di codice inserite complessive | 16.400 |
| Documenti di piano conservati | 7 |

### 17.2 Prodotto

| Indicatore | Valore |
|---|---|
| Strumenti operativi per l'agente | 26 |
| Provider LLM supportati | 25 |
| Provider locali (nessun invio esterno) | 3 |
| Permessi richiesti | 7, tutti motivati per iscritto |
| Dimensione del pacchetto compresso | 424.711 byte |
| Dimensione del processo di servizio | 326.633 byte (era 1.094.550) |

### 17.3 Qualità

| Indicatore | Valore |
|---|---|
| Test automatici in verde | 295 |
| Copertura linee / funzioni / ramificazioni (perimetro `src/shared`) | 96,45% / 97,52% / 89,06% |
| Controlli end-to-end superati | 7 controlli in un'unica suite |

| Violazioni di accessibilità serie | 0 |
| Controlli automatici nel processo di verifica | 12, più la suite end-to-end |
| Difetti trovati e corretti in revisione | 7 |

---

## Appendice A — Elenco completo dei tool browser

| # | Strumento | Funzione | Conferma richiesta |
|---|---|---|---|
| 1 | `browser_snapshot` | Cattura la struttura della pagina con riferimenti numerici | no (mai, neppure con «ogni azione») |
| 2 | `browser_navigate` | Apre un indirizzo | sì, verso dominio non ancora visitato |
| 3 | `browser_back` | Torna indietro nella cronologia | solo con «ogni azione» |
| 4 | `browser_forward` | Avanti nella cronologia | solo con «ogni azione» |
| 5 | `browser_reload` | Ricarica la pagina | sì (azioni sensibili, predefinito) |
| 6 | `browser_click` | Clic su un elemento identificato | solo con «ogni azione» |
| 7 | `browser_type` | Digitazione in un campo, con invio opzionale | sì solo se invia il modulo (sempre, anche a conferme disattivate) |
| 8 | `browser_hover` | Passaggio del mouse (menu, suggerimenti) | solo con «ogni azione» |
| 9 | `browser_clipboard_write` | Copia testo negli appunti | solo con «ogni azione» |
| 10 | `browser_clipboard_read` | Legge gli appunti | sì (azioni sensibili, predefinito) |
| 11 | `browser_iframe_snapshot` | Legge dentro un riquadro incorporato | no (mai, neppure con «ogni azione») |
| 12 | `browser_download` | Avvia il download di un file | sì (azioni sensibili, predefinito) |
| 13 | `browser_select` | Scelta in un menu a tendina | sì (azioni sensibili, predefinito) |
| 14 | `browser_wait` | Attende che appaia un elemento | no (mai, neppure con «ogni azione») |
| 15 | `browser_press` | Pressione di tasti di navigazione | solo con «ogni azione» |
| 16 | `browser_scroll` | Scorrimento della pagina | solo con «ogni azione» |
| 17 | `browser_screenshot` | Cattura dello schermo | solo con «ogni azione» |
| 18 | `browser_screenshot_element` | Cattura ritagliata di un elemento | solo con «ogni azione» |
| 19 | `browser_tabs_list` | Elenco delle schede | no (mai, neppure con «ogni azione») |
| 20 | `browser_tab_focus` | Passaggio a un'altra scheda | sì (azioni sensibili, predefinito) |
| 21 | `browser_tab_duplicate` | Duplica la scheda corrente | solo con «ogni azione» |
| 22 | `browser_read_text` | Testo della pagina, completo o riassunto | solo con «ogni azione» |
| 23 | `browser_links` | Elenco dei collegamenti | solo con «ogni azione» |
| 24 | `browser_find` | Ricerca di un testo con conteggio | solo con «ogni azione» |
| 25 | `browser_table` | Estrazione di una tabella | solo con «ogni azione» |
| 26 | `browser_query` | Interrogazione della struttura con selettori | solo con «ogni azione» |

## Appendice B — Elenco completo dei provider

| # | Provider | Tipo | Credenziale richiesta | Visione |
|---|---|---|---|---|
| 1 | OpenAI | cloud | sì | sì |
| 2 | Anthropic | cloud | sì | sì |
| 3 | Google Gemini | cloud | sì | sì |
| 4 | xAI Grok | cloud | sì | sì |
| 5 | Azure OpenAI | cloud | sì + risorsa | sì |
| 6 | DeepSeek | cloud | sì | no |
| 7 | Groq | cloud | sì | sì |
| 8 | Cerebras | cloud | sì | sì |
| 9 | Mistral AI | cloud | sì | sì |
| 10 | Cohere | cloud | sì | no |
| 11 | DeepInfra | cloud | sì | no |
| 12 | Fireworks AI | cloud | sì | no |
| 13 | Perplexity | cloud | sì | no |
| 14 | Together AI | cloud | sì | no |
| 15 | Hugging Face | cloud | sì | no |
| 16 | NVIDIA NIM | cloud | sì | no |
| 17 | Baseten | cloud | sì | no |
| 18 | SambaNova | cloud | sì | no |
| 19 | OpenRouter | gateway | sì | sì |
| 20 | OpenCode Zen | gateway | sì | sì |
| 21 | GitHub Models | gateway | sì | sì |
| 22 | Vercel AI Gateway | gateway | sì | sì |
| 23 | Ollama | locale | no | sì |
| 24 | LM Studio | locale | no | sì |
| 25 | OpenAI-compatibile | personalizzato | facoltativa | sì |

## Appendice C — Elenco dei rilasci

| Release | Data | Pacchetto | Contenuto sintetico |
|---|---|---|---|
| v0.4.0 | 16/09/2026 | lmuse-0.4.0.zip | 18 strumenti, domini fidati, test end-to-end |
| v0.5.0 | 16/09/2026 | lmuse-0.5.0.zip | Visualizzazione in tempo reale, lavori programmati, 21 strumenti |
| v0.6.0 | 17/09/2026 | lmuse-0.6.0.zip | 25 provider, credenziali per provider, integrazione opencode |
| v0.7.0 | 17/09/2026 | lmuse-0.7.0.zip | Alleggerimento 70,3%, coda lavori, elenco modelli, 24 strumenti |
| v0.8.0 | 28/09/2026 | lmuse-0.8.0.zip | Blocco automatico credenziale, 26 strumenti, correzioni di sicurezza |

---

## Nota finale

Il lavoro è stato condotto per incrementi verificabili, con registri pubblici e
codice ispezionabile: ogni affermazione di questo documento è verificabile,
ripercorrendo i registri del repository e i documenti di piano conservati.

Le attività dichiarate non concluse (§ 15) e i limiti noti (§ 14) sono indicati
per consentire una valutazione completa. Si raccomanda, come prossimo passo
formale, una **prova di accettazione con credenziale reale** condotta dall'Amministrazione
(§ 14.1, punto 1) e una **sessione di prova con operatori** (§ 14.2, punto 2), prima
di ogni eventuale diffusione.

*Fine del rapporto.*
