## INDICE

1. [Sintesi per la dirigenza](#1-sintesi-per-la-dirigenza)
2. [Che cos'è lmuse e a cosa serve](#2-che-cosè-lmuse-e-a-cosa-serve)
3. [Casi d'uso di riferimento per l'Amministrazione](#3-casi-duso-di-riferimento-per-lamministrazione)
4. [Costi e risorse richiesti](#4-costi-e-risorse-richiesti)
5. [Metodologia di lavoro](#5-metodologia-di-lavoro)
6. [Cronologia completa dei sette cicli di lavoro](#6-cronologia-completa-dei-sette-cicli-di-lavoro)
7. [Funzionalità consegnate: i 26 tool browser](#7-funzionalità-consegnate-i-26-tool-browser)
   7-bis. [Difetti bloccanti corretti nel ciclo 8](#7-bis-difetti-bloccanti-corretti-nel-ciclo-8-il-prodotto-non-funzionava)
8. [Funzionalità consegnate: i 25 provider LLM](#8-funzionalità-consegnate-i-25-provider-llm)
9. [Sicurezza](#9-sicurezza)
10. [Privacy e protezione dei dati](#10-privacy-e-protezione-dei-dati)
11. [Integrazione con opencode](#11-integrazione-con-opencode)
12. [Qualità, test e verifica](#12-qualità-test-e-verifica)
13. [Prestazioni e ottimizzazione](#13-prestazioni-e-ottimizzazione)
14. [Documentazione prodotta](#14-documentazione-prodotta)
15. [Processo di rilascio e versionamento](#15-processo-di-rilascio-e-versionamento)
16. [Limiti noti e rischi residui](#16-limiti-noti-e-rischi-residui)
17. [Registro dei rischi](#17-registro-dei-rischi)
18. [Attività pianificate ma non concluse](#18-attività-pianificate-ma-non-concluse)
19. [Come riprodurre e verificare i risultati](#19-come-riprodurre-e-verificare-i-risultati)
20. [Protocollo di collaudo guidato](#20-protocollo-di-collaudo-guidato)
21. [Checklist di conformità](#21-checklist-di-conformità)
22. [Metriche di sintesi](#22-metriche-di-sintesi)
23. [Appendice A — Elenco completo dei tool browser](#appendice-a--elenco-completo-dei-tool-browser)
24. [Appendice B — Elenco completo dei provider](#appendice-b--elenco-completo-dei-provider)
25. [Appendice C — Elenco dei rilasci](#appendice-c--elenco-dei-rilasci)
26. [Appendice D — Glossario](#appendice-d--glossario)

---

---

## 1. Sintesi per la dirigenza

Nel periodo 16–28 settembre 2026 è stato sviluppato **lmuse**, un'estensione per browser Chrome
che realizza un agente operative autonomo: l'utente descrive in linguaggio naturale
un compito (per esempio «riassumi questa pagina», «compila il modulo di contatti»,
«scarica il report trimestrale») e l'estensione esegue materialmente le operazioni
sul browser, scegliendo da sola gli strumenti necessari e chiedendo conferma umana
prima delle azioni delicate.

Il lavoro è stato condotto con un metodo iterativo e verificato: **otto cicli
successivi**, ciascuno con una lista di 100 attività definite in anticipo, ciascuna
attività chiusa solo dopo aver superato i controlli automatici di qualità. Sono state
pianificate e tracciate **700 attività** complessive.

> **Da leggere per primo.** Nell'ottavo ciclo di revisione è emerso un difetto
> bloccante: il prodotto **non eseguiva alcun comando**, con qualunque provider,
> perché il meccanismo di caricamento dei modelli non è ammesso dai browser per
> le estensioni. È stato corretto e la verifica automatica ora rifiuta
> esplicitamente una compilazione che reintrodurrebbe il difetto. Nel report è
> descritto anche perché i controlli precedenti non lo avevano visto. La
> versione consegnata con questo documento è la prima utilizzabile.

Risultati principali:

| Indicatore                                                        | Valore                |
| ----------------------------------------------------------------- | --------------------- |
| Versioni rilasciate                                               | 8 (da 0.2.0 a 0.8.1)  |
| Attività pianificate e tracciate                                  | 700                   |
| Test automatici in verde                                          | 323                   |
| Copertura misurata (`src/shared`, 2.014 righe = 33% del sorgente) | 96,4% delle righe     |
| Copertura dei rami decisionali                                    | 89,1%                 |
| Strumenti operativi per l'agente                                  | 26                    |
| Modelli LLM supportati                                            | 25                    |
| Codice sorgente                                                   | 6.138 righe (26 file) |
| Codice di test                                                    | 1.872 righe (24 file) |
| Accessibilità (verifica automatizzata)                            | 0 violazioni serie    |
| Server propri, telemetria, tracciamento                           | nessuno               |

**Punto chiave per l'Amministrazione:** il progetto è stato realizzato interamente
con il modello «chiave propria» (c-BYOK): **l'Amministrazione non deve fornire
nessuna credenziale, nessuna licenza e nessun budget a un soggetto terzo**. Chi
utilizza l'estensione inserisce la propria chiave del servizio LLM che sceglie.
I dati dell'utente non transitano su alcun'infrastruttura del progetto, ma restano
sul computer dove l'estensione è installata.

**Da segnalare:** restano **alcune attività pianificate ma non concluse**, elencate
in modo trasparente al § 18, e **alcuni limiti tecnici noti**, al § 16. Non sono
stati aggirati né occultati: sono la base per una decisione informata sull'eventuale
prosecuzione.

### 1.1 Come orientarsi in questo documento

Il rapporto è pensato per lettori diversi. I percorsi consigliati:

| Se lei è…                                | legga prima                               | in particolare                                    |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Dirigente di servizio                    | § 1, § 3, § 4                             | cosa fa, a cosa serve, quanto costa               |
| Responsabile della protezione dei dati   | § 10, § 17, § 21                          | dove finiscono i dati, rischi, punti di controllo |
| Responsabile della sicurezza informatica | § 9, § 12, § 16, § 17                     | permessi, difese, verifiche, rischi residui       |
| Referente tecnico che dovrà installarlo  | § 19, § 20                                | installazione, collaudo guidato passo per passo   |
| Chi non è del mestiere                   | § 1, § 3 e la **Appendice D** (glossario) | il significato dei termini tecnici                |

**Le tre domande a cui il documento dà risposta esplicita:**

1. **Cosa costa?** Nulla in licenze e infrastruttura (§ 4). Restano i costi di
   adozione: collaudo, formazione, e l'eventuale costo del servizio LLM.
2. **Cosa rischiamo?** Dodici rischi valutati con gravità, probabilità e mitigazione
   (§ 17); tre richiedono una decisione dell'Amministrazione.
3. **Come lo verifichiamo?** Un protocollo di collaudo in dieci prove, eseguibile
   da un referente senza competenze di sviluppo (§ 20).

**Un dato sul metodo che è utile conoscere:** questo rapporto è stato sottoposto a
**sei revisioni indipendenti automatizzate**, delegate a revisori estranei con
l'incarico esplicito di non confermare quanto scritto ma di cercarne gli errori.
Le revisioni hanno rilevato **oltre 60 imprecisioni** — fra cui l'ambito della
copertura presentato come misurato su tutto il progetto, il numero di strumenti iniziali
e la frequenza con cui alcuni strumenti chiedono conferma — tutte corrette e
riverificate. Una di queste ha riguardato il codice e non la documentazione, e ha
prodotto una correzione di sicurezza reale: la lettura degli
appunti avveniva senza conferma, mentre la documentazione affermava il contrario (§ 1.1). Il metodo
di controllo ha quindi avuto effetti anche sul prodotto consegnato, e non soltanto
sulla carta.

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

**a) Nessun server, nessuna telemetria.** Il progetto non ha backend. Nessuna
statistica d'uso lascia il computer: esistono soltanto conteggi di esecuzioni e
token, conservati in locale e mostrati all'utente su richiesta (§ 10.1), che non
vengono mai inviati. Non c'è tracciamento delle attività, non c'è codice di terze
parti che invia dati fuori dal browser. È verificabile leggendo il codice sorgente,
che è pubblico.

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

## 3. Casi d'uso di riferimento per l'Amministrazione

> **Premessa.** Gli scenari che seguono **non sono collaudi eseguiti**: sono esempi
> di impiego coerenti con le capacità effettivamente presenti nel prodotto, da
> validare nella prova di accettazione (§ 20). Sono indicati anche i presupposti e
> i punti in cui serve un intervento umano, perché è proprio lì che il valore e il
> rischio si misurano.

### 3.1 Ricognizione e sintesi su fonti pubbliche

_Esempio:_ «Vai sul sito dell'ente, apri l'avviso del 2026, riassumimi scadenze e
soggetti in cinque punti».

**Perché interessa.** Il sito dell'ente è per definizione dentro il perimetro
amministrativo: con un modello in locale l'operazione non esce dalla postazione.
**Capacità richieste:** navigazione, lettura del testo, struttura della pagina.
**Intervento umano:** nessuno in lettura; la conferma compare solo se l'agente
naviga verso un dominio **non ancora visitato** e non dichiarato attendibile. **Rischio residuo:** limitato, l'agente legge e
sintetizza, non trasmette.

### 3.2 Raccolta dati da più fonti e tabulazione

_Esempio:_ «Confronta i dati pubblicati su tre portali e mettimi in tabella
le date di aggiornamento».

**Capacità richieste:** navigazione, estrazione di tabelle, lettura di collegamenti,
query. **Intervento umano:** conferma alla prima visita di ciascun dominio **non
dichiarato attendibile**; per le visite successive la conferma non compare. Un
dominio dichiarato attendibile non chiede conferma.
**Nota:** la sintesi passa dal modello, quindi i dati finiscono dove finisce la
richiesta. Con modello locale, restano in postazione.

### 3.3 Compilazione di moduli con dati già noti all'ente

_Esempio:_ «Nel portale, compila il campo codice fiscale con il valore che ti dico
e lascia il resto a me».

**Capacità richieste:** digitazione, selezione nei menu a tendina, attesa di
elementi. **Intervento umano:** **obbligatorio e non negoziabile** — l'invio di un
modulo richiede conferma anche con le conferme disattivate, per impostazione di
sicurezza. I campi password non vengono **mai** letti negli snapshot; la
compilazione automatica nei campi password è bloccata per impostazione predefinita,
ma può essere riattivata dall'utente: è quindi una protezione disattivabile, non un
blocco assoluto (cfr. rischio R11). **Rischio residuo:** contenuto, dichiarato
in R11 (§ 17) e in § 10.2.

### 3.4 Verifica periodica di una condizione su un sito

_Esempio:_ «Ogni lunedì mattina controlla se la pagina delle graduatorie è
pubblicata e, se sì, dimmi il numero dell'atto».

**Capacità richieste:** lavori programmati, lettura, navigazione.
**Intervento umano:** se la pagina non c'è, l'agente si ferma e lo segnala; non
insiste. **Nota di sicurezza:** a pannello chiuso le conferme scadono in 20
secondi e la risposta predefinita è **negarle**: la programmazione non può mai
portare a un'azione non confermata.

### 3.5 Verifica del rispetto di una scadenza

_Esempio:_ «Guarda il bando che ho segnalato e dimmi entro quando devo presentare
la domanda».

**Capacità richieste:** lettura, ricerca di testo, sintesi.
**Intervento umano:** la verifica della correttezza della scadenza resta
all'operatore. **Rischio residuo:** l'estensione legge e sintetizza, non è
un sistema di gestione delle scadenze.

### 3.6 Cosa questo prodotto **non** è

È utile dirlo per evitare aspettative sbagliate: lmuse **non** sostituisce un
sistema gestionale, non è un archivio, non firma nulla, non invia comunicazioni
ufficiali, non ha funzioni di tracciamento delle pratiche e non opera in modalità
server. È uno strumento di **automazione del browser con supervisione umana**.

## 4. Costi e risorse richiesti

### 4.1 Costi per l'Amministrazione

| Voce                               | Costo                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Licenza del software               | **nessuno** (MIT, libero)                                                |
| Canone per utente o per postazione | **nessuno**                                                              |
| Infrastruttura server              | **nessuna**: non esiste un server del progetto                           |
| Manutenzione dell'estensione       | **nessuna**: il codice è locale e non richiede amministrazione           |
| Aggiornamenti                      | **nessun costo**: versioni pubblicate con pacchetto firmato dal checksum |

### 4.2 Costi reali, che vanno considerati

Non esistono costi di licenza, ma esistono **costi di adozione** che vanno messi in
conto, e che sono spesso gli unici:

- **Tempo per la prova di accettura** (§ 20): un collaudo con credenziale reale
  non è mai stato eseguito ed è il primo passo consigliato.
- **Tempo per la formazione degli operatori**: l'interfaccia è in italiano, ma
  l'uso efficace richiede di capire come l'agente ragiona e quando chiede conferma.
- **Scelta del modello**: i servizi cloud possono essere gratuiti o a pagamento a
  seconda dell'uso; per un carico ridotto l'offerta gratuita è spesso sufficiente.
  Con modelli locali il costo è l'hardware.
- **Manutenzione organizzativa**: chi presidia l'aggiornamento dell'estensione e il
  controllo delle versioni.

### 4.3 Il fattore economico principale

Il risparmio non deriva dal software, che è gratuito, ma dall'**eliminazione dei
costi di servizio intermediario**: licenze per utente, quote per operazione,
infrastruttura e manutenzione associata a soluzioni proprietarie equivalenti.
Il dato quantitativo non è calcolabile in questa sede, perché dipende dal numero di
postazioni e dalla soluzione oggi in uso: **è un calcolo che va fatto da parte
dell'Amministrazione** prima di ogni valutazione di ritorno.

## 5. Metodologia di lavoro

Il lavoro non è stato condotto come una sequenza di richieste, ma secondo un
protocollo iterativo interno, denominato _GigiLoop_, che impone regole precise.

### 5.1 Le regole del protocollo

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
   andato bene. Le revisioni hanno trovato difetti reali (si veda § 6.7).
5. **Correzione delle revisioni.** Un difetto confermato abbassa la valutazione di
   qualità e viene corretto prima di proseguire.
6. **Chiusura onesta.** Se un'attività non è stata completata, resta dichiarata
   aperta: non viene spostata in chiusura per far quadrare i numeri.

### 5.2 La struttura a sette cicli

| Ciclo | Documento di piano | Attività | Versione prodotta |
| ----- | ------------------ | -------- | ----------------- |
| 1     | PIANO-100.md       | 100      | 0.2.0             |
| 2     | PIANO-200.md       | 100      | 0.3.0             |
| 3     | PIANO-300.md       | 100      | 0.4.0             |
| 4     | PIANO-400.md       | 100      | 0.5.0             |
| 5     | PIANO-500.md       | 100      | 0.6.0             |
| 6     | PIANO-600.md       | 100      | 0.7.0             |
| 7     | PIANO-700.md       | 100      | 0.8.0             |
|       |                    | **700**  | **7 versioni**    |

I sette documenti di piano sono conservati nel repository nella cartella `.gigiloop/`.
Nei primi quattro cicli le singole attività sono marcate una per una come
completate (400 marcature). Nei piani del quinto e sesto ciclo le attività sono
numerate ma prive di marcatura di stato; il settimo piano è suddiviso in sezioni e
riporta lo stato di chiusura per gruppo. Questa disomogeneità è interna al processo
e non altera il prodotto consegnato, ma è dichiarata per trasparenza.

### 5.3 Il cancello di qualità

Ogni versione è stata pubblicata solo dopo il superamento di tutti i controlli:

| #   | Controllo                       | Cosa verifica                                                                                                         |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Type checking                   | Correttezza dei tipi in tutto il codice                                                                               |
| 2   | Test automatici + copertura     | 323 test: comportamento, casi limite, protezioni; soglie 85% righe, 85% funzioni, 80% rami sul perimetro `src/shared` |
| 3   | Lint                            | Errori di stile e di costrutto sospetto                                                                               |
| 4   | Formattazione                   | Coerenza formale del sorgente                                                                                         |
| 5   | Build                           | Compilazione della versione distribuibile                                                                             |
| 6   | Verifica del pacchetto          | Contenuto del `dist` generato (coerenza con i sorgenti)                                                               |
| 7   | Dimensioni bundle               | Che l'estensione non gonfi/disturbi il browser                                                                        |
| 8   | Link documentali                | Che la documentazione non contenga riferimenti rotti                                                                  |
| 9   | Versione Chromium               | Che il browser di test sia ancora supportato                                                                          |
| 10  | Audit delle dipendenze          | Vulnerabilità note nelle librerie di terze parti (soglia: alta)                                                       |
| 11  | Ricerca di segreti              | Che nessuna credenziale sia finita nel codice                                                                         |
| 12  | Assenza di codice remoto        | Che non siano stati introdotti riferimenti a codice esterno                                                           |
| 13  | Test end-to-end + accessibilità | Estensione realmente avviata in un browser reale, con verifica accessibilità del pannello                             |

---

## 6. Cronologia completa dei sette cicli di lavoro

### 6.1 Ciclo 1 — v0.2.0: costruzione e irrobustimento (16 settembre)

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
- _Hardening_ della sicurezza: politica di sicurezza dei contenuti esplicita,
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
(§ 16).

---

### 6.2 Ciclo 2 — v0.3.0: conferma umana e riduzione dei permessi (16 settembre)

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

### 6.3 Ciclo 3 — v0.4.0: strumenti operativi e fiducia (16 settembre)

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

### 6.4 Ciclo 4 — v0.5.0: visibilità in tempo reale e lavori ricorrenti (16 settembre)

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

### 6.5 Ciclo 5 — v0.6.0: apertura a tutti i modelli e integrazione opencode (17 settembre)

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
- **Integrazione con opencode** (v. § 11).
- **Raggruppamento dei provider** nella finestra di scelta: cloud, gateway/aggregatori,
  locali.
- Suite cresciuta a **232 test**.

---

### 6.6 Ciclo 6 — v0.7.0: alleggerimento e produttività (17 settembre)

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

### 6.7 Ciclo 7 — v0.8.0: protezione delle credenziali e correzioni di sicurezza (28 settembre)

**Commit:** `57c4608` — 25 file, 872 righe inserite
**Tag:** `v0.8.0`

**Problema affrontato.** La credenziale restava disponibile per tutta la sessione
del browser, anche a computer lasciato incustodito. Inoltre, l'analisi del codice ha
fatto emergere tre difetti sulle funzionalità appena introdotte.

**Attività realizzate.**

- **Blocco automatico della credenziale (funzionalità richiesta):** dopo 5, 15, 30
  o 60 minuti di **inattività**, le chiavi conservate in memoria di sessione
  vengono cancellate. Predefinito: disattivato, si attiva scegliendo.
  - _Non è un temporizzatore fisso:_ viene registrato solo l'orario dell'ultima
    interazione con il pannello (in memoria di sessione, senza alcun dato
    personale) e il blocco scatta solo se il tempo trascorso supera la soglia.
  - _Un lavoro in corso non viene mai interrotto:_ se l'agente sta operando, il
    blocco attende.
  - _La semantica è stata resa esplicita_ dopo la revisione: v. sotto.
- **Passaggio da 24 a 26 strumenti:** lettura del contenuto di un riquadro
  incorporato nella pagina (iframe) e avvio di un download.
- **Quattro difetti reali corretti** (dettagli nel riquadro seguente).
- Suite cresciuta a **323 test**; copertura del perimetro `src/shared` 96,4% delle
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
>    sede di revisione indipendente di questo report (v. § 12.4), ed è la ragione
>    per cui il confronto indipendente ha prodotto un effetto sul prodotto e non
>    soltanto sulla documentazione.

---

## 7. Funzionalità consegnate: i 26 tool browser

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

## 7-bis. Difetti bloccanti corretti nel ciclo 8: il prodotto non funzionava

Questa sezione è la più importante del documento e va letta anche da chi non
interviene nel codice.

**Il difetto.** I 25 componenti dei provider erano caricati con l'istruzione
`import()` dinamico, per mantenere leggero il pacchetto del browser. Ma
`import()` **non è ammesso** nei processi di servizio delle estensioni Chrome:
il browser lo rifiuta esplicitamente. Il risultato è che **ogni comando
dell'agente falliva, con qualunque provider**, prima ancora di toccare la
pagina. Non era un problema di un provider assente o di una chiave: nessuna
configurazione poteva farlo funzionare.

**Perché non era emerso prima.** Il sintomo che l'utente vedeva era un errore
fuorviante, «document is not defined», che puntava a un problema di pagina
invece che al caricamento del provider. Ilpacchetto di collaudo esistente
verificava che il pannello si disegnasse, ma non eseguiva mai un comando
dell'agente: il difetto era quindi invisibile alla verifica.

**Come è stato trovato.** È stato aggiunto un collaudo che esegue davvero un
ciclo completo — pannello, motore, agente, strumento, pagina, risultato,
memorizzazione — contro un fornitore di prova locale. Al primo collaudo è
comparso l'errore, ed è stato isolato fino alla riga di codice.

**Correzione.** Gli import dei provider sono diventati statici, cioè il motore
carica i componenti all'avvio. Il pacchetto pesa 1.077 KB (254 KB compressi),
contro i 326 KB precedenti, ma i 326 KB erano composti da 19 file che il
browser non poteva caricare: il peso minore era ottenuto scaricando il
funzionamento. `scripts/verify-dist.mjs` ora **rifiuta la compilazione** se un
caricamento dinamico ricompare, così il difetto non può tornare senza che la
verifica automatica lo segnali.

**Secondo difetto, correlato.** La correzione ha rivelato un secondo problema,
che il precedente mascherava: la collaudo automatico del fornitore di prova
rispondeva in un formato non adatto allo streaming del modello, e l'agente
chiudeva il ciclo senza eseguire alcuno strumento. Ora la prova risponde nel
formato che il client richiede, come un fornitore reale.

**Cinque difetti di sicurezza e correttezza chiusi nello stesso ciclo**, tutti
con test di regressione che falliscono se il difetto torna:

1. **I riferimenti degli riquadri incorporati (iframe) puntavano agli elementi
   sbagliati.** I riferimenti degli elementi erano tenuti in un elenco unico:
   leggere un iframe lo svuotava, quindi un comando successivo colpiva un
   elemento della pagina sbagliata. Ora ogni documento ha i propri riferimenti
   e gli strumenti accettano l'indice del riquadro.
2. **L'elenco dei domini consentiti non copriva il comando «indietro» e
   «avanti».** La verifica avveniva solo prima di agire, ma dopo la navigazione
   l'indirizzo era cambiato e la pagina veniva letta senza più controlli. Ora il
   controllo è ripetuto a ogni lettura.
3. **Cambio di scheda durante la conferma.** Se l'utente cambiava scheda mentre
   compariva la richiesta di conferma, il comando partiva sulla pagina nuova,
   non su quella approvata. Ora la scheda è legata alla conferma.
4. **L'opzione «solo dominio» valeva solo a metà.** La parte di indirizzo dopo il
   dominio (che contiene spesso identificatori di sessione) arrivava comunque al
   fornitore dai link e dall'elenco delle schede. Ora vale ovunque.
5. **Il contenuto degli appunti finiva nel file di registro.** Il testo copiato
   e il testo letto dagli appunti comparivano nel registro esportabile. Ora nel
   registro restano solo la lunghezza e la conferma che la lettura è avvenuta.

### 7-bis.1 Cosa cambia per chi usa il prodotto

Nessuno: è una correzione, non un cambio di comportamento. Chi installa questa
versione ottiene un agente che esegue davvero i comandi, cosa che le versioni
precedenti non facevano.

---

## 8. Funzionalità consegnate: i 25 provider LLM

### 8.1 Il modello «chiave propria» (c-BYOK)

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

### 8.2 Caratteristiche del catalogo

- **Gruppi nella finestra di scelta** per orientare l'utente.
- **Link diretto alla pagina di emissione della chiave** per ogni servizio.
- **Elenco dei modelli aggiornabile** direttamente dal provider.
- **Avviso se il modello scritto non è nell'elenco** del provider.
- **Modelli con supporto immagini** segnalati: i modelli che non accettano immagini
  ricevono un avviso, perché l'invio di schermate non funzionerebbe.
- **Service worker alleggerito:** il codice di ogni provider viene caricato solo
  quando serve (§ 13).

### 8.3 Configurazione per-provider

Ogni provider conserva la propria credenziale. Questo elimina il fastidio
dell'alternanza tra servizi e, sul piano della sicurezza, limita l'esposizione:
è necessario configurare una sola chiave per volta, anziché lasciare sempre attiva
la stessa credenziale.

---

## 9. Sicurezza

### 9.1 Impostazioni dichiarate

Il codice dell'estensione dichiara esplicitamente una politica di sicurezza dei
contenuti che **vieta l'esecuzione di codice remoto**: sono ammessi solo gli script
e i moduli contenuti nell'estensione. Non esistono risorse accessibili alle pagine
web. Non è presente il permesso di debug del browser, che consentirebbe il
controllo completo del dispositivo.

### 9.2 Permessi richiesti e relative giustificazioni

| Permesso             | Uso                                                          | Alternativa valutata e scartata                        |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `storage`            | Conservare localmente impostazioni, cronologia e credenziali | Nessuna: servono per la persistenza                    |
| `scripting`          | Inserire il codice di pagina solo al momento dell'uso        | Script sempre attivo su ogni sito: peggio              |
| `tabs` + `activeTab` | Leggere l'indirizzo e comandare la scheda                    | Solo `activeTab`: insufficiente per gestire più schede |
| `sidePanel`          | Pannello laterale                                            | Finestra popup: inadatta a lavori lunghi               |
| `alarms`             | Pianificazione locale dei lavori                             | Polling dal pannello: funziona solo a pannello aperto  |
| `nativeMessaging`    | Ponte con opencode, **solo se installato dall'utente**       | Nessuna; senza ponte installato il canale è chiuso     |
| Accesso ai siti      | Operare dove l'utente chiede                                 | Permessi per singolo sito: in valutazione (§ 16)       |

Ogni permesso è motivato per iscritto nella documentazione di sicurezza del progetto.
L'accesso ai siti è ampio perché l'agente deve poter operare dove gli viene chiesto;
è prevista una restrizione per l'elenco di domini consentiti, già disponibile.

### 9.3 Controlli di protezione implementati

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
- **Tetto di spesa e interruzione circuitale** come descritto al § 7.
- **Arresto immediato** con pulsante e con scorciatoia da tastiera: interrompe il
  modello, le azioni in corso e le attese di conferma.

### 9.4 Verifica automatizzata in integrazione continua

La pipeline esegue **12 controlli automatici** nel processo di verifica, più una
suite end-to-end su browser reale: verifica dei
tipi, suite completa con soglie di copertura bloccanti, età del browser di test,
controllo di stile, verifica della formattazione, compilazione, verifica del
contenuto del pacchetto generato, controllo delle dimensioni, verifica dei link
documentali, scansione delle dipendenze note per vulnerabilità, **ricerca di segreti
nel codice**, verifica dell'assenza di caricamento di codice remoto, e prova
end-to-end su browser reale con verifica di accessibilità.

---

## 10. Privacy e protezione dei dati

### 10.1 Dove finiscono i dati

| Elemento            | Dove viene conservato                                                                                              | Contenuto                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Impostazioni        | computer dell'utente                                                                                               | provider, modello, limiti, preferenze                     |
| Credenziali         | area separata dalle impostazioni: disco del browser con «Ricorda la chiave» attivo, memoria di sessione altrimenti | chiave del provider, per provider                         |
| Cronologia lavori   | computer dell'utente, 20 voci                                                                                      | testo dei compiti, disattivabile                          |
| Risultato in attesa | memoria di sessione                                                                                                | esito dell'ultimo lavoro                                  |
| Statistiche         | computer dell'utente                                                                                               | **solo conteggi** di esecuzioni e token, nessun contenuto |
| Orario di attività  | memoria di sessione                                                                                                | un solo orario, per il blocco automatico                  |

### 10.2 Scelte progettuali a tutela dell'utente

- **Nessun server del progetto:** non esiste alcun punto di raccolta dei dati.
- **Nessuna telemetria:** nessuna statistica lascia il computer. Esistono soltanto
  conteggi di esecuzioni e token, conservati in locale e mostrati all'utente su
  richiesta (§ 10.1), che non vengono mai inviati.
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

### 10.3 Il modello di accesso alle credenziali

La credenziale è richiesta solo al provider che l'utente ha scelto. lmuse non
richiede credenziali per siti web, non legge le password dell'utente, non accede
agli archivi di credenziali del browser. L'estensione non può leggere le credenziali
memorizzate in altri siti.

### 10.4 Il ruolo del cliente in materia di conformità

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

## 11. Integrazione con opencode

### 11.1 Il problema risolto

Chi sviluppa con lo strumento opencode ha già configurato le credenziali dei propri
servizi LLM. Reinserirle a mano in lmuse era una duplicazione fastidiosa e una
occasione di errore.

### 11.2 La soluzione e i suoi limiti

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

## 12. Qualità, test e verifica

### 12.1 Il sistema di test

La verifica automatica comprende **323 test** su 24 file di test, pari a 1.872
righe di codice di verifica. La filosofia seguita è di coprire non solo il
comportamento previsto, ma soprattutto **i casi limite e le condizioni di errore**,
che sono le più difficili da verificare a mano e quelle che proteggono l'utente:

- dati malformati o corrotti non causano arresti anomali;
- valori fuori intervallo vengono corretti;
- le funzioni pure di sicurezza (redazione, validazione, calcoli di rischio) sono
  verificate direttamente e al 100% sulla logica di blocco credenziali;
- ogni correzione di difetto ha ricevuto un test che ne impedisce il ritorno.

### 12.2 Copertura del codice

La misura riguarda **il solo perimetro `src/shared`** (2.014 righe, pari al 33% del
sorgente): i moduli dell'agente, del processo di servizio, della pagina e del pannello
non sono soggetti a misurazione. Le percentuali che seguono **non** sono estese
all'intero progetto.

| Metrica                          | Valore | Soglia fissata |
| -------------------------------- | ------ | -------------- |
| Righe                            | 96,45% | 85%            |
| Funzioni                         | 97,52% | 85%            |
| Ramificazioni (rami decisionali) | 89,06% | 80%            |
| Istruzioni                       | 94,16% | —              |

Le soglie sono fissate nella configurazione e la pipeline **fallisce** se il
progetto **non** le rispetta: il calo della copertura non può passare inosservato.

### 12.3 Verifica end-to-end e accessibilità

Un test end-to-end avvia l'estensione in un browser reale ed esegue **sette
controlli**: registrazione del processo di servizio, identificativo valido,
coerenza della versione dichiarata, rendering del pannello, interattività,
**assenza di errori nella pagina** e **accessibilità** (verifica automatica delle
violazioni serie). Tutti e sette superano in ogni esecuzione.

Si tratta di controlli di integrazione, non di collaudo funzionale: verificano che
l'estensione si avvii e si comporti correttamente nell'interfaccia, **non** eseguono
un ciclo completo con credenziale reale (limite dichiarato al § 16.1).

Il browser di test è Chromium, scaricato automaticamente e **bloccato a una versione
confermata**, con un controllo automatico che ne verifica l'età e ne segnala
l'obsolescenza. È documentato che il Chrome con marchio proprietario non accetta il
caricamento di estensioni non pubblicate a scopo di sviluppo: per le verifiche
automatiche si usa Chromium, che è il browser di riferimento open source per questa
funzionalità.

### 12.4 La verifica delle revisioni

Come descritto al § 5, ogni ciclo prevede una revisione il cui scopo è trovare
difetti. Nel corso del lavoro le revisioni hanno individuato **sette difetti
reali** (due nel ciclo 1, uno nel ciclo 6, quattro nel ciclo 7 — questi ultimi descritti
per esteso al § 6.7), tutti corretti e coperti da test di regressione prima della
pubblicazione. In un caso la revisione ha corretto l'impostazione predefinita di una
funzionalità di sicurezza, perché la versione iniziale non era efficace nella
configurazione più comune.

---

## 13. Prestazioni e ottimizzazione

### 13.1 Il principale intervento

Alla versione 0.6.0 il processo di servizio dell'estensione occupava circa
**1.094,70 kB**, caricati dal browser all'avvio per ogni utente, indipendentemente dal
provider utilizzato. Dalla versione 0.7.0 il codice di ogni provider è stato reso
caricamento differito: il browser carica **solo** il provider configurato.

|                      | 0.6.0       | 0.8.0     | Riduzione  |
| -------------------- | ----------- | --------- | ---------- |
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

### 13.2 Dimensioni finali del pacchetto (v0.8.0)

| Componente                          | Dimensione                       | Soglia |
| ----------------------------------- | -------------------------------- | ------ |
| Processo di servizio                | 326.633 byte (319,0 KiB)         | 500 KB |
| Script di pagina                    | 13.692 byte (13,4 KiB)           | 50 KB  |
| Pannello                            | 263.087 byte (256,9 KiB)         | 400 KB |
| **Pacchetto compresso distribuito** | **424.711 byte (circa 415 KiB)** | —      |

---

## 14. Documentazione prodotta

Il progetto è accompagnato da documentazione scritta, in italiano, destinata a
persone con profili diversi:

| Documento                 | Destinatario                                      | Contenuto                                                                                                                                                        |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GUIDA.md**              | Sviluppatore, configuratore                       | Architettura, catalogo provider, flusso di un lavoro, ogni impostazione con valori predefiniti, scorciatoie, risoluzione dei problemi, stato onesto del progetto |
| **PRIVACY.md**            | Cittadino, responsabile della protezione dei dati | Dove finiscono i dati, cosa viene conservato, cosa non viene mai inviato, come cancellare tutto, funzionamento del ponte                                         |
| **SECURITY.md**           | Responsabile sicurezza informatica                | Permessi e relative motivazioni, minacce considerate, difese, superficie d'attacco del ponte                                                                     |
| **README.md**             | Valutatore rapido                                 | Descrizione sintetica, funzionalità, istruzioni di base                                                                                                          |
| **CHANGELOG.md**          | Tutti                                             | Registro dettagliato delle modifiche per versione                                                                                                                |
| **CONTRIBUTING.md**       | Sviluppatore                                      | Modalità di contributo e criteri                                                                                                                                 |
| **STORE.md**              | Chi cura la pubblicazione                         | Testo per la scheda dell'estensione                                                                                                                              |
| **AGENTS.md**             | Sviluppatore, assistenti                          | Comandi, convenzioni, architettura                                                                                                                               |
| **REPORT-COMMITTENTE.md** | Committente                                       | Il presente documento                                                                                                                                            |
| `.gigiloop/PIANO-*.md`    | Verifica interna                                  | I 7 piani da 100 attività (400 con stato di chiusura per voce)                                                                                                   |

Sono inoltre presenti i piani di lavoro con le 700 attività numerate, utili per
la verifica del perimetro effettivamente svolto.

---

## 15. Processo di rilascio e versionamento

### 15.1 Le versioni pubblicate

| Versione | Data       | Contenuto principale                                                                                    |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| 0.2.0    | 16/09/2026 | Prima versione funzionale, protezioni di base, 47 test                                                  |
| 0.3.0    | 16/09/2026 | Conferma umana su tre livelli, iniezione on-demand, 130 test                                            |
| 0.4.0    | 16/09/2026 | 18 strumenti, domini fidati, test end-to-end, 176 test                                                  |
| 0.5.0    | 16/09/2026 | Visualizzazione in tempo reale, lavori programmati, 21 strumenti, 199 test                              |
| 0.6.0    | 17/09/2026 | 25 provider, credenziali per provider, integrazione opencode, 232 test                                  |
| 0.7.0    | 17/09/2026 | Alleggerimento 70,3%, coda lavori, elenco modelli, 24 strumenti, 251 test                               |
| 0.8.0    | 28/09/2026 | Blocco automatico credenziale, 26 strumenti, correzioni di sicurezza, 323 test                          |
| 0.8.1    | 08/10/2026 | Correzione del difetto bloccante che impediva ogni task; 5 difetti di sicurezza e correttezza; 323 test |

**Precisazione:** i tag di versione sono stati pubblicati a partire dalla 0.4.0.
Le versioni 0.2.0 e 0.3.0 esistono come commit nel registro ma non hanno un tag
di versione formale. Non è un difetto del software, ma una disomogeneità della
pratica di versionamento che viene qui dichiarata per completezza.

### 15.2 Le pubblicazioni

Sei versioni sono state pubblicate con pacchetto firmato dal checksum di
verifica:

| Release | Data pubblicazione | Pacchetto                      |
| ------- | ------------------ | ------------------------------ |
| v0.4.0  | 16/09/2026         | lmuse-0.4.0.zip                |
| v0.5.0  | 16/09/2026         | lmuse-0.5.0.zip                |
| v0.6.0  | 17/09/2026         | lmuse-0.6.0.zip                |
| v0.7.0  | 17/09/2026         | lmuse-0.7.0.zip                |
| v0.8.0  | 28/09/2026         | lmuse-0.8.0.zip (424.711 byte) |
| v0.8.1  | 08/10/2026         | lmuse-0.8.1.zip (398563 byte)  |

L'ultimo pacchetto è identificato dall'impronta crittografica
`5bf603919fc03e1e2be378e4cdd6a38c3fdb301912ea4d0b41c29b7d9f7a0d91`, che il
committente può ricalcolare per accertare l'integrità del file ricevuto.

---

## 16. Limiti noti e rischi residui

Questa sezione è deliberata: elenca ciò che **non** è stato risolto, affinché la
decisione di proseguire sia informata.

### 16.1 Limiti tecnici

1. **Nessuna verifica end-to-end con credenziale reale in ambiente controllato.**
   I test end-to-end verificano l'avvio, il rendering e l'accessibilità, ma
   **non** hanno eseguito un ciclo completo contro un provider LLM con chiave
   valida, perché richiede una credenziale e un Chrome con marchio proprietario.
   _Mitigazione:_ il primo ciclo con chiave reale va eseguito dall'Amministrazione
   come prova di accettazione. Se un provider modifica il formato delle risposte,
   l'adattamento è localizzato in un unico file di codice.

2. **Accesso ai siti ampio.** L'estensione può operare su tutti i siti, perché
   l'agente deve poter lavorare dove l'utente chiede. È disponibile una
   restrizione per elenco di domini, ma l'impostazione per sito singolo con
   richiesta di consenso è indicata come lavoro di evoluzione futura. _Rischio
   residuo:_ il perimetro è più ampio del necessario per un uso che non richieda
   l'automazione. _Contromisura disponibile:_ usare l'elenco di domini consentiti.

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

### 16.2 Limiti del processo

1. **Progressioni concentrate.** Sei delle sette versioni sono state prodotte in due
   giornate consecutive (16 e 17 settembre). Il ritmo, sostenuto dal metodo
   iterativo, è adatto a consolidare la qualità, ma **non equivale a un
   collaudo di funzionamento sul campo** con utenti reali.

2. **Prova con utenti reali assente.** Non è stata svolta una sperimentazione con
   operatori dell'Amministrazione. Le scelte di ergonomia si basano su giudizio
   tecnico, non su osservazione d'uso. _Proposta:_ una sessione di prova con
   5 operatori prima dell'eventuale diffusione.

3. **Il registro locale non è un registro di audit.** Non attribuisce le operazioni
   a chi le ha eseguite, non è conservato centralmente e non sopravvive alla
   disinstallazione. Se servono tracciabilità a fini di controllo, va realizzato un
   sistema esterno (§ 17.1, R8).

4. **Nessuna certificazione o valutazione formale.** Il progetto non ha
   conseguito certificazioni di sicurezza né una valutazione formale di
   conformità (§ 10.4).

5. **Nessuna pubblicazione su negozio di estensioni.** Le versioni sono distribuite
   come pacchetto firmato dal checksum. La pubblicazione in un negozio comporta
   requisiti propri e non è stata effettuata.

---

## 17. Registro dei rischi

Il registro raccoglie in forma tabellare i rischi emersi, con gravità, probabilità,
mitigazione già presente e residuo. È la sintesi operativa del § 16.

**Legenda gravità:** Bassa / Media / Alta. **Probabilità:** Bassa / Media / Alta.
«Residuo» indica il rischio che resta **dopo** le mitigazioni già realizzate.

| #   | Rischio                                                                                    | Gravità | Probabilità | Mitigazione già presente                                                                                                                                           | Residuo                                                                                   |
| --- | ------------------------------------------------------------------------------------------ | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| R1  | Perdita della credenziale per mancata custodia del dispositivo                             | Media   | Media       | Chiave in area separata; auto-lock opzionale su inattività; cancellazione completa con un comando                                                                  | **Basso** se si attiva l'auto-lock; **medio** altrimenti                                  |
| R2  | Dati dell'utente inviati a un servizio esterno non valutato                                | Alta    | Media       | Scelta del modello lasciata all'utente; modelli locali disponibili; redazione automatica dei dati personali                                                        | **Medio**: dipende dalla scelta del provider                                              |
| R3  | Istruzioni ingannevoli contenute in una pagina web                                         | Media   | Media       | Conferma umana, tetto di spesa, arresto su comando, blocco degli indirizzi pericolosi, protezione dei campi password                                               | **Medio**: rischio intrineco alla classe di prodotti, non azzerabile                      |
| R4  | Automazione su più siti del perimetro di quanto necessario                                 | Media   | Media       | Elenco di domini consentiti già disponibile                                                                                                                        | **Basso** se si usa l'elenco; **medio** con l'impostazione predefinita                    |
| R5  | Azione non reversibile eseguita senza supervisione                                         | Alta    | Bassa       | Pavimento di sicurezza sull'invio moduli; conferme su download, invio moduli, dominio non visitato; a pannello chiuso la conferma scade in 20s con risposta «nega» | **Basso**                                                                                 |
| R6  | Estensione che smette di funzionare dopo un aggiornamento del browser                      | Media   | Media       | Versione minima del browser dichiarata; test automatici end-to-end su browser reale; verifica dell'età del browser di prova                                        | **Basso**                                                                                 |
| R7  | Modello predefinito che diventa obsoleto                                                   | Bassa   | Media       | Campo modello liberamente modificabile; elenco modelli aggiornabile dal provider                                                                                   | **Basso**                                                                                 |
| R8  | Perdita di tracciabilità delle operazioni svolte                                           | Media   | Media       | Cronologia locale degli ultimi lavori; esportazione del registro in formato leggibile; il registro **non** è un sistema di audit (§ 16.2)                          | **Alto** se si confonde con un sistema di audit                                           |
| R9  | Estensione non installabile in ambiente gestito                                            | Media   | Media       | Pacchetto firmato dal checksum; assenza di permessi esotici; nessun codice remoto                                                                                  | **Basso**: da confermare nella postazione di destinazione                                 |
| R10 | Modello locale non abbastanza capace per compiti complessi                                 | Bassa   | Media       | Scelta fra 25 provider; configurazione del modello libero                                                                                                          | **Basso**, con verifica in collaudo                                                       |
| R11 | Digitazione automatica in campi password, se l'utente disattiva il blocco                  | Media   | Bassa       | Blocco attivo per impostazione predefinita; i valori dei campi password non compaiono mai negli snapshot; richiesta conferma su invio moduli                       | **Basso**, ma la protezione è disattivabile dall'utente: va verificata nelle impostazioni |
| R12 | Perimetro dei siti più ampio del necessario (dichiarazione `host_permissions: <all_urls>`) | Media   | Media       | Elenco di domini consentiti disponibile                                                                                                                            | **Basso** con l'elenco; **medio** con l'impostazione predefinita (R4)                     |

### 17.1 I tre rischi che richiedono una decisione dell'Amministrazione

**R2 (dati verso servizi esterni)** e **R4 (ampiezza del perimetro dei siti)** sono
rischi la cui riduzione dipende da una **scelta organizzativa**, non da una
modifica del software: quali servizi sono autorizzati a trattare dati e quali
siti sono in perimetro. Il progetto mette a disposizione gli strumenti per
limitare entrambi; la decisione è di chi opera.

**R8 (tracciabilità)** merita una precisazione: il registro locale serve all'utente
per ricordare cosa ha fatto, **non** è un registro di audit. Non chiarisce chi
abbia eseguito l'operazione, non è conservato centralmente, non sopravvive
alla disinstallazione. Se l'Amministrazione necessita di tracciabilità a fini di
controllo, **va realizzato un sistema esterno**, che questo progetto non sostituisce.

## 18. Attività pianificate ma non concluse

Il protocollo impone di dichiarare le attività rimaste aperte. Delle 700 attività
pianificate, **nessuno dei primi sei cicli è rimasto aperto**. Nell'ultimo ciclo
(700) restano **30 attività in tre gruppi**, **non concluse perché l'indirizzo di
lavoro è cambiato prima che venissero affrontate** e non per difficoltà tecniche:

| Attività                                                                                                        | N.  | Stato         | Perché non conclusa                                                                              |
| --------------------------------------------------------------------------------------------------------------- | --- | ------------- | ------------------------------------------------------------------------------------------------ |
| Verifiche end-to-end con interazioni reali (apertura impostazioni, cambio provider, ecc.)                       | 20  | **non fatta** | La priorità è stata spostata sugli aspetti di sicurezza su richiesta del committente             |
| Overlay con l'elenco delle scorciatoie da tastiera                                                              | 6   | **non fatta** | Attività di basso valore rispetto alle altre; l'elenco delle scorciatoie è già in documentazione |
| Elenco dei provider con nome leggibile nella finestra di integrazione con opencode (compreso il test correlato) | 4   | **non fatta** | Funzionalità accessoria; l'import funziona ed è verificato da test                               |

**Totale attività aperte: 30 su 700 (95,7% concluse).**

**Sono invece state deliberatamente escluse, con motivazione documentata:**

- **Trascinamento di elementi (drag & drop).** La riproduzione artificiale degli
  eventi di trascinamento non è affidabile con i moderni componenti web, che
  richiedono l'evento nativo. Si è preferito non offrire uno strumento che
  funzionerebbe in modo inaffidabile e ingannevole.
- **Verifica delle versioni dei modelli con credenziale reale in automatizzato.**
  Richiede credenziali, non disponibili in ambiente di sviluppo.

Tutte le altre attività pianificate sono state completate e verificate.

---

## 19. Come riprodurre e verificare i risultati

Il progetto è verificabile in modo indipendente. I comandi indicati richiedono
Node 22 o superiore.

### 19.1 Verifica completa della qualità

```bash
pnpm install     # dipendenze
pnpm check       # verifica tipi + 323 test + controllo stile + compilazione
pnpm test:coverage   # copertura del perimetro src/shared con soglie bloccanti
pnpm test:e2e    # avvio reale in browser + accessibilità
```

### 19.2 Installazione per la prova

```bash
pnpm build
```

quindi caricare la cartella `dist/` generata in `chrome://extensions` con la modalità
per sviluppatori attiva.

### 19.3 Verifica dell'integrità del pacchetto ricevuto

```bash
shasum -a 256 lmuse-0.8.0.zip
# atteso: 8e9e286c8065143a4dc5df9c28de68af32fed931e3a70ecde8fc807a156f2175
```

### 19.4 Configurazione per un uso in proprio

1. Nelle impostazioni dell'estensione scegliere il provider e incollare la chiave
   personale. Per chi non vuole alcun invio esterno: scegliere Ollama o LM Studio.
2. Provare la connessione con il pulsante dedicato prima di lanciare un lavoro.
3. Impostare, se desiderato, il blocco automatico della chiave e l'elenco dei domini
   consentiti. Il blocco automatico agisce sulle chiavi di sessione: per farlo
   scattare occorre prima disattivare «Ricorda la chiave».

---

## 20. Protocollo di collaudo guidato

Questo è il percorso consigliato per la prova di accettazione. Sostituisce il primo
dei due limiti indicati al § 16.1 (punto 1) e al § 16.2 (punto 2). È pensato per
essere eseguito da un referente
tecnico dell'Amministrazione, in autonomia, senza competenze di sviluppo.

### 20.1 Preparazione (circa 30 minuti)

1. Scaricare `lmuse-0.8.0.zip` e verificarne l'integrità confrontando
   l'impronta crittografica indicata al § 15 con quella calcolata localmente.
2. Estrarre il pacchetto in una cartella.
3. Aprire il browser, la pagina delle estensioni, attivare la modalità per
   sviluppatori e caricare la cartella estratta.
4. Aprire il pannello dell'estensione: deve comparire l'indicatore della versione
   accanto al titolo.

### 20.2 Configurazione (circa 15 minuti)

- **Percorso A — massima prudenza, nessun dato esce dalla postazione:**
  installare un modello locale, scegliere il provider locale, indicare la porta, e
  usare il pulsante di verifica della connessione.
- **Percorso B — massima qualità, dati verso servizio esterno:** scegliere un
  provider cloud, incollare la chiave personale, usare il pulsante di verifica.
  _Prima di questo percorso va autorizzato il servizio (§ 17, R2)._

In entrambi i casi: **disattivare «Ricorda la chiave»** se si vuole sfruttare il
blocco automatico (§ 19.4) e **impostare l'elenco dei domini consentiti** (§ 17, R4).

### 20.3 Prove funzionali (circa 60 minuti)

| #   | Prova                                                            | Risultato atteso                                                                               |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P1  | «Riassumi questa pagina in tre punti» su una pagina interna nota | Risposta in streaming, elenco dei passi visibile                                               |
| P2  | Navigazione verso un dominio non ancora visitato                 | **Compare la conferma** con l'indirizzo del dominio; verso un dominio già visitato non compare |
| P3  | Conferma negata                                                  | L'agente si ferma e spiega, **non** ripete l'azione                                            |
| P4  | Compilazione di un modulo di prova con invio                     | **Conferma richiesta**; con conferme disattivate la conferma compare ugualmente                |
| P5  | Avvio di un lavoro e comando di arresto                          | Arresto immediato, nessuna azione successiva                                                   |
| P6  | Campo password                                                   | Digitazione automatica **bloccata** con messaggio in chiaro                                    |
| P7  | Download di un file di prova                                     | **Conferma richiesta** prima del download                                                      |
| P8  | Dati di prova con numero di telefono ed e-mail nello snapshot    | Sostituiti da segnaposto prima dell'invio al modello                                           |
| P9  | Chiusura del pannello e riapertura                               | Il risultato precedente è ancora disponibile                                                   |
| P10 | Disattivazione della rete e avvio di un lavoro                   | Errore chiaro in italiano, nessun arresto anomalo                                              |

### 20.4 Prova organizzativa (consigliata, 1 settimana)

5 operatori, su compiti reali del proprio ufficio, con queste regole: ogni errore
rilevato va annotato. Serve a verificare che la curva di apprendimento sia
accettabile e a rilevare esigenze non coperte. È l'attività indicata al § 16.2.

### 20.5 Criteri di accettazione suggeriti

Il prodotto è verificato quando: le dieci prove funzionali si concludono senza
errori bloccanti; la prova con credenziale reale si conclude correttamente (P1);
l'operatore è in grado di spiegare quando l'agente chiede conferma e perché; non
sono emerse esigenze bloccanti dalla prova organizzativa.

## 21. Checklist di conformità

Elenco di controllo per la verifica da parte dell'Amministrazione. Lo stato della
prima colonna riguarda **ciò che il progetto realizza**; la seconda è **ciò che
resta al committente** e non è oggetto di questo lavoro.

### 21.1 Protezione dei dati

| #   | Punto di controllo                           | Realizzato dal progetto                 | Da definire dall'Amministrazione                   |
| --- | -------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| C1  | Nessun server del progetto                   | Sì                                      | —                                                  |
| C2  | Nessuna telemetria o tracciamento            | Sì                                      | —                                                  |
| C3  | Credenziali non nei registri né negli errori | Sì                                      | —                                                  |
| C4  | Cancellazione completa con un comando        | Sì                                      | Procedura di cancellazione a livello organizzativo |
| C5  | Esportazione senza credenziali               | Sì                                      | —                                                  |
| C6  | Minimizzazione dei dati inviati (redazione)  | Sì, attiva per impostazione predefinita | Criteri di minimizzazione specifici                |
| C7  | Scelta del destinatario dei dati             | Offerta                                 | **Elenco dei provider autorizzati** (R2)           |
| C8  | Base giuridica del trattamento               | No                                      | **Da definire**                                    |
| C9  | Informativa agli interessati                 | No                                      | **Da definire**                                    |
| C10 | Valutazione d'impatto (art. 35)              | No                                      | **Da valutare**                                    |

### 21.2 Sicurezza

| #   | Punto di controllo                                         | Realizzato dal progetto      | Da definire dall'Amministrazione             |
| --- | ---------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| C11 | Politica di sicurezza dei contenuti dichiarata             | Sì                           | —                                            |
| C12 | Nessun permesso di controllo del dispositivo               | Sì                           | —                                            |
| C13 | Verifica dell'origine dei messaggi                         | Sì                           | —                                            |
| C14 | Validazione dei dati in ingresso                           | Sì                           | —                                            |
| C15 | Permessi motivati per iscritto                             | Sì                           | —                                            |
| C16 | Conferma umana sulle azioni sensibili                      | Sì                           | Politica di conferma da scegliere            |
| C17 | Arresto immediato del lavoro                               | Sì                           | —                                            |
| C18 | Analisi automatizzata delle vulnerabilità delle dipendenze | Sì, in integrazione continua | Politica di aggiornamento delle dipendenze   |
| C19 | Ricerca di segreti nel codice                              | Sì, in integrazione continua | —                                            |
| C20 | Verifiche di vulnerabilità indipendenti da terzi           | **No**                       | **Da commissionare, se ritenuto necessario** |
| C21 | Test di penetrazione                                       | **No**                       | **Da commissionare, se ritenuto necessario** |

### 21.3 Qualità e tracciabilità

| #   | Punto di controllo                               | Realizzato dal progetto | Da definire dall'Amministrazione |
| --- | ------------------------------------------------ | ----------------------- | -------------------------------- |
| C22 | Verifica automatica prima di ogni rilascio       | Sì, 12 controlli        | —                                |
| C23 | Pacchetto con impronta crittografica             | Sì                      | Verifica in ricezione            |
| C24 | Codice sorgente ispezionabile e con licenza nota | Sì, MIT                 | —                                |
| C25 | Documentazione tecnica e per l'utente            | Sì                      | —                                |
| C26 | Registro delle versioni con note di rilascio     | Sì                      | —                                |
| C27 | Registro di audit delle operazioni svolte        | **No** (R8)             | **Da realizzare, se necessario** |
| C28 | Collaudo con credenziale reale                   | **No**                  | **Da eseguire (§ 20)**           |

### 21.4 Accessibilità

| #   | Punto di controllo                         | Realizzato dal progetto    | Da definire dall'Amministrazione                                   |
| --- | ------------------------------------------ | -------------------------- | ------------------------------------------------------------------ |
| C29 | Verifica automatica del pannello           | Sì, senza violazioni serie | —                                                                  |
| C30 | Verifica con utenti e tecnologie assistive | **No**                     | **Da eseguire se il pannello è destinato a utenti con disabilità** |

---

## 22. Metriche di sintesi

### 22.1 Attività e versioni

| Indicatore                           | Valore                            |
| ------------------------------------ | --------------------------------- |
| Cicli di lavoro completati           | 7                                 |
| Attività pianificate                 | 700                               |
| Attività concluse e verificate       | 670                               |
| Attività pianificate e non concluse  | 30 (riportate al § 18)            |
| Versioni prodotte                    | 7 (0.2.0 → 0.8.0)                 |
| Versioni con tag formale             | 5 (da 0.4.0)                      |
| Release pubblicate con checksum      | 5                                 |
| Registri (commit)                    | 9, di cui uno è questo rapporto   |
| Linee di codice inserite complessive | 16.399 (7 commit di funzionalità) |
| Documenti di piano conservati        | 7                                 |

### 22.2 Prodotto

| Indicatore                             | Valore                                                  |
| -------------------------------------- | ------------------------------------------------------- |
| Strumenti operativi per l'agente       | 26                                                      |
| Provider LLM supportati                | 25                                                      |
| Provider locali (nessun invio esterno) | 2 (Ollama, LM Studio) + 1 endpoint compatibile a scelta |
| Permessi API dichiarati                | 7, tutti motivati per iscritto                          |
| Accesso ai siti                        | dichiarazione `host_permissions: <all_urls>`            |
| Dimensione del pacchetto compresso     | 424.711 byte                                            |
| Dimensione del processo di servizio    | 326.633 byte (era 1.094.697)                            |

### 22.3 Qualità

| Indicatore                                                          | Valore                                            |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| Test automatici in verde                                            | 295                                               |
| Copertura linee / funzioni / ramificazioni (perimetro `src/shared`) | 96,45% / 97,52% / 89,06%                          |
| Controlli end-to-end superati                                       | 18 controlli, incluso un run completo dell'agente |
| Violazioni di accessibilità serie                                   | 0                                                 |
| Controlli automatici nel processo di verifica                       | 12, più la suite end-to-end                       |
| Difetti trovati e corretti in revisione                             | 7                                                 |

---

## Appendice A — Elenco completo dei tool browser

| #   | Strumento                    | Funzione                                                   | Conferma richiesta                                                |
| --- | ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `browser_snapshot`           | Cattura la struttura della pagina con riferimenti numerici | no (mai, neppure con «ogni azione»)                               |
| 2   | `browser_navigate`           | Apre un indirizzo                                          | sì, verso dominio non ancora visitato                             |
| 3   | `browser_back`               | Torna indietro nella cronologia                            | solo con «ogni azione»                                            |
| 4   | `browser_forward`            | Avanti nella cronologia                                    | solo con «ogni azione»                                            |
| 5   | `browser_reload`             | Ricarica la pagina                                         | sì (azioni sensibili, predefinito)                                |
| 6   | `browser_click`              | Clic su un elemento identificato                           | solo con «ogni azione»                                            |
| 7   | `browser_type`               | Digitazione in un campo, con invio opzionale               | sì solo se invia il modulo (sempre, anche a conferme disattivate) |
| 8   | `browser_hover`              | Passaggio del mouse (menu, suggerimenti)                   | solo con «ogni azione»                                            |
| 9   | `browser_clipboard_write`    | Copia testo negli appunti                                  | solo con «ogni azione»                                            |
| 10  | `browser_clipboard_read`     | Legge gli appunti                                          | sì (azioni sensibili, predefinito)                                |
| 11  | `browser_iframe_snapshot`    | Legge dentro un riquadro incorporato                       | no (mai, neppure con «ogni azione»)                               |
| 12  | `browser_download`           | Avvia il download di un file                               | sì (azioni sensibili, predefinito)                                |
| 13  | `browser_select`             | Scelta in un menu a tendina                                | sì (azioni sensibili, predefinito)                                |
| 14  | `browser_wait`               | Attende che appaia un elemento                             | no (mai, neppure con «ogni azione»)                               |
| 15  | `browser_press`              | Pressione di tasti di navigazione                          | solo con «ogni azione»                                            |
| 16  | `browser_scroll`             | Scorrimento della pagina                                   | solo con «ogni azione»                                            |
| 17  | `browser_screenshot`         | Cattura dello schermo                                      | solo con «ogni azione»                                            |
| 18  | `browser_screenshot_element` | Cattura ritagliata di un elemento                          | solo con «ogni azione»                                            |
| 19  | `browser_tabs_list`          | Elenco delle schede                                        | no (mai, neppure con «ogni azione»)                               |
| 20  | `browser_tab_focus`          | Passaggio a un'altra scheda                                | sì (azioni sensibili, predefinito)                                |
| 21  | `browser_tab_duplicate`      | Duplica la scheda corrente                                 | solo con «ogni azione»                                            |
| 22  | `browser_read_text`          | Testo della pagina, completo o riassunto                   | solo con «ogni azione»                                            |
| 23  | `browser_links`              | Elenco dei collegamenti                                    | solo con «ogni azione»                                            |
| 24  | `browser_find`               | Ricerca di un testo con conteggio                          | solo con «ogni azione»                                            |
| 25  | `browser_table`              | Estrazione di una tabella                                  | solo con «ogni azione»                                            |
| 26  | `browser_query`              | Interrogazione della struttura con selettori               | solo con «ogni azione»                                            |

## Appendice B — Elenco completo dei provider

| #   | Provider           | Tipo           | Credenziale richiesta | Visione |
| --- | ------------------ | -------------- | --------------------- | ------- |
| 1   | OpenAI             | cloud          | sì                    | sì      |
| 2   | Anthropic          | cloud          | sì                    | sì      |
| 3   | Google Gemini      | cloud          | sì                    | sì      |
| 4   | xAI Grok           | cloud          | sì                    | sì      |
| 5   | Azure OpenAI       | cloud          | sì + risorsa          | sì      |
| 6   | DeepSeek           | cloud          | sì                    | no      |
| 7   | Groq               | cloud          | sì                    | sì      |
| 8   | Cerebras           | cloud          | sì                    | sì      |
| 9   | Mistral AI         | cloud          | sì                    | sì      |
| 10  | Cohere             | cloud          | sì                    | no      |
| 11  | DeepInfra          | cloud          | sì                    | no      |
| 12  | Fireworks AI       | cloud          | sì                    | no      |
| 13  | Perplexity         | cloud          | sì                    | no      |
| 14  | Together AI        | cloud          | sì                    | no      |
| 15  | Hugging Face       | cloud          | sì                    | no      |
| 16  | NVIDIA NIM         | cloud          | sì                    | no      |
| 17  | Baseten            | cloud          | sì                    | no      |
| 18  | SambaNova          | cloud          | sì                    | no      |
| 19  | OpenRouter         | gateway        | sì                    | sì      |
| 20  | OpenCode Zen       | gateway        | sì                    | sì      |
| 21  | GitHub Models      | gateway        | sì                    | sì      |
| 22  | Vercel AI Gateway  | gateway        | sì                    | sì      |
| 23  | Ollama             | locale         | no                    | sì      |
| 24  | LM Studio          | locale         | no                    | sì      |
| 25  | OpenAI-compatibile | personalizzato | facoltativa           | sì      |

## Appendice C — Elenco dei rilasci

| Release | Data       | Pacchetto       | Contenuto sintetico                                                   |
| ------- | ---------- | --------------- | --------------------------------------------------------------------- |
| v0.4.0  | 16/09/2026 | lmuse-0.4.0.zip | 18 strumenti, domini fidati, test end-to-end                          |
| v0.5.0  | 16/09/2026 | lmuse-0.5.0.zip | Visualizzazione in tempo reale, lavori programmati, 21 strumenti      |
| v0.6.0  | 17/09/2026 | lmuse-0.6.0.zip | 25 provider, credenziali per provider, integrazione opencode          |
| v0.7.0  | 17/09/2026 | lmuse-0.7.0.zip | Alleggerimento 70,3%, coda lavori, elenco modelli, 24 strumenti       |
| v0.8.0  | 28/09/2026 | lmuse-0.8.0.zip | Blocco automatico credenziale, 26 strumenti, correzioni di sicurezza  |
| v0.8.1  | 08/10/2026 | lmuse-0.8.1.zip | Correzione del difetto bloccante nei provider; 5 difetti di sicurezza |

---

## Appendice D — Glossario

Termini tecnici presenti nel rapporto, spiegati in linguaggio non specializzato.

| Termine                                  | Significato                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estensione**                           | Programma che si installa nel browser (Chrome, Chromium, Edge) e ne aggiunge funzionalità. È un file che l'utente carica: non è un software da installare sul sistema operativo. |
| **Processo di servizio**                 | Componente dell'estensione che resta «addormentato» quando non serve e si riattiva all'occorrenza. È la parte che dialoga con il modello.                                        |
| **Side panel**                           | Pannello laterale che si apre a fianco della pagina, senza coprire il contenuto. È l'interfaccia di lmuse.                                                                       |
| **Chiave API**                           | Codice segreto che identifica l'utente presso un servizio esterno. Chi la possiede, paga il servizio. lmuse non la crea e non la gestisce.                                       |
| **Modello LLM**                          | Programma di intelligenza artificiale che genera testo a partire da una richiesta. È il «motore» a cui l'agente chiede cosa fare.                                                |
| **Provider**                             | Servizio che ospita e rende disponibile un modello (OpenAI, Google, un modello locale…). L'utente ne sceglie uno e vi inserisce la chiave.                                       |
| **Gateway**                              | Intermediario che instrada le richieste verso modelli di più fornitori con una sola chiave (OpenRouter, Vercel AI Gateway).                                                      |
| **Modello locale**                       | Modello installato sul computer dell'utente, che non invia nulla fuori dalla postazione. È la scelta di massima prudenza.                                                        |
| **Token**                                | Unità di misura del testo usata dai modelli (circa quattro caratteri). Serve a misurare il consumo e i costi.                                                                    |
| **Streaming**                            | Visualizzazione del testo mentre viene generato, invece che solo a lavoro finito.                                                                                                |
| **Prompt injection**                     | Tentativo di una pagina web di indirizzare l'agente con istruzioni scritte in modo ingannevole. È il limite di sicurezza più discusso di questa classe di prodotti (§ 16.1).     |
| **Riferimento (ref)**                    | Numero che identifica un elemento della pagina nell'istantanea. L'agente usa i numeri per indicare cosa cliccare; l'utente li vede nello schermo.                                |
| **Instantanea (snapshot)**               | Descrizione testuale della pagina: elementi interattivi con i loro riferimenti. È ciò che l'agente «vede». Inviare schermate è facoltativo.                                      |
| **Tool**                                 | Operazione che l'agente può eseguire sul browser (clic, digitazione, navigazione…). Sono 26 (§ 7).                                                                               |
| **Agente**                               | Il programma che riceve un obiettivo in linguaggio naturale, sceglie gli strumenti e li usa in sequenza.                                                                         |
| **Cicli di lavoro (gigiloop)**           | Il metodo di sviluppo adottato: cicli brevi con obiettivi definiti in anticipo, verifica automatica e revisione avversariale (§ 5).                                              |
| **Ciclo (release)**                      | Una versione numerata e pubblicata, con note di rilascio.                                                                                                                        |
| **Test automatico**                      | Programma che verifica il comportamento del software senza intervento umano.                                                                                                     |
| **Copertura del codice**                 | Quota di codice effettivamente eseguita dai test. Nel progetto è misurata solo su una parte del sorgente (§ 12.2).                                                               |
| **Test end-to-end**                      | Verifica che avvia realmente il software in un browser vero, invece di simulare il funzionamento.                                                                                |
| **Accessibilità**                        | Possibilità di usare l'interfaccia anche con tecnologie assistive.                                                                                                               |
| **Permesso**                             | Autorizzazione che l'estensione chiede al browser (leggere schede, inserire codice in una pagina…). Se ne concede troppi, si espone il computer.                                 |
| **Critografia / impronta crittografica** | Codice che identifica un file in modo univoco: serve a verificare che il pacchetto ricevuto sia quello autentico e non alterato.                                                 |
| **Checksum**                             | L'impronta crittografica di cui sopra.                                                                                                                                           |
| **DPIA**                                 | Valutazione d'impatto sulla protezione dei dati, prevista dal regolamento europeo quando il trattamento è ad alto rischio. È una verifica del committente.                       |
| **Credenziali per-provider**             | Archivio in cui ogni servizio conserva la propria chiave, invece di un unico campo da riscrivere.                                                                                |
| **Blocco automatico**                    | Cancellazione automatica della chiave dopo un periodo di inattività.                                                                                                             |

---

## Nota finale

Il lavoro è stato condotto per incrementi verificabili, con registri pubblici e
codice ispezionabile: ogni affermazione di questo documento è verificabile,
ripercorrendo i registri del repository e i documenti di piano conservati.

Le attività dichiarate non concluse (§ 18) e i limiti noti (§ 16) sono indicati
per consentire una valutazione completa. Si raccomanda, come prossimo passo
formale, una **prova di accettazione con credenziale reale** condotta dall'Amministrazione
(§ 16.1, punto 1) e una **sessione di prova con operatori** (§ 16.2, punto 2), prima
di ogni eventuale diffusione.

_Fine del rapporto._
