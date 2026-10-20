# Mettere lmuse in testing sul Chrome Web Store

Questa guida spiega come pubblicare lmuse come **Private / Trusted testers**
(installabile solo dagli utenti autorizzati) e passare in seguito alla pubblicazione
pubblica. La modalità **Unlisted non limita l'installazione ai soli tester**: chiunque
possegga il link può installare. L'accesso alla dashboard richiede l'account sviluppatore.

## 0. Cosa serve (una tantum)

1. Account Google con **verifica in due passaggi** attiva.
2. Registrazione developer Chrome Web Store: **5 USD una tantum**
   → https://chrome.google.com/webstore/devconsole
3. Email di contatto pubblica per il listing.
4. Il pacchetto `release/lmuse-0.9.0.zip` da generare dopo CI verde e test manuali.

## 1. Upload come Private

1. Apri la [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. **New item** → carica `release/lmuse-0.9.0.zip`.
3. Compila la scheda usando `STORE.md` (nome, descrizione, categoria, lingue).
4. Carica gli screenshot `store/screenshot-1.png` e `store/screenshot-2.png`.
5. **Privacy practices**:
   - Privacy policy: `https://culturedigitali.github.io/lmuse/privacy.html`
   - Single purpose: testo in `STORE.md`.
   - Giustificazioni permessi: tabella in `STORE.md` (una per campo).
   - Data usage: nessuna raccolta da parte dello sviluppatore; il provider scelto
     riceve la chiave per autenticazione e il contesto di task filtrato, che non è
     garantito anonimo; vedere PRIVACY-GATEWAY.md.
   - Remote code: **No**.
6. **Visibility**: `Private` (non “Unlisted” né “Public”). Nella sezione _Trusted testers_
   inserisci le email delle persone che devono provarlo (max 100).
7. **Submit for review**. La revisione avviene secondo i tempi effettivi del Chrome Web Store.

## 2. Dopo l'approvazione (testing)

- Condividi il link `https://chromewebstore.google.com/detail/<id>` con i tester:
  potranno installarla solo con l'email autorizzata.
- Chiedi a ogni tester di riportare: provider usato, task, esito, messaggi di errore.
- Raccomandato: 5–10 tester per 7–14 giorni **con account e dati di test**, includendo almeno:
  - un task di sola lettura (riassunto);
  - un task con conferma (navigazione/form);
  - uno STOP a metà;
  - un provider locale (Ollama) e uno cloud con dati sintetici;
  - verifica del consenso di disclosure per sito;
  - tentativi di prompt injection e di ripristino token su dominio diverso;
  - controllo del traffico HTTP verso il mock provider, senza dati originali.
- Tieni traccia dei difetti in GitHub Issues con etichetta `beta`.

## 3. Criterio per passare a “Public”

Passa a pubblico solo se, nei test:

- [ ] nessun crash o errore non gestito nei log del service worker;
- [ ] nessuna richiesta di rete imprevista (solo provider configurato);
- [ ] conferme umane sempre mostrate per le azioni sensibili;
- [ ] nessuna chiave visibile in log, export o schermate;
- [ ] almeno 3 tester hanno completato 5 task reali ciascuno;
- [ ] nessun difetto aperto di severità alta;
- [ ] recensione privacy/permessi coerente con il comportamento osservato.

Poi: dashboard → _Visibility_ → **Public** → _Submit for review_.

## 4. Note specifiche BYOK

- Il revisore non ha una chiave: le istruzioni in `STORE.md` spiegano come
  verificare UI e permessi e come usare Ollama in locale.
- Il permesso `nativeMessaging` è usato solo dal bridge opencode opzionale:
  se la revisione lo contesta, si può pubblicare una variante store senza
  bridge (rimuovendo permesso + card opencode) mantenendo la versione GitHub.
- `<all_urls>` è il punto più delicato: la giustificazione è pronta e l'elenco
  “Domini consentiti” è la mitigazione dichiarata.

## 5. Versioni

- Candidata per il test: `0.9.0` (da generare e validare, non ancora approvata).
- Valutare il rilascio pubblico solo dopo la beta privata e un audit conclusivo; i fix richiedono un incremento della versione.
- Non riusare lo stesso numero di versione per pacchetti diversi: lo store
  rifiuta versioni duplicate.
