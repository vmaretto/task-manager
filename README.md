This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Dashboard e priorita iniziali

La pagina di atterraggio e la dashboard **Priorita di oggi**. Le sezioni non usano
un elenco parallelo: leggono i normali task e li ordinano usando `completed`,
`workflow_status`, `priority` e `due_date`.

- `workflow_status = active` alimenta le tre priorita critiche e le prossime azioni.
- `workflow_status = waiting` sposta il task nella sezione **In attesa**.
- `is_today_priority = true` fissa manualmente il task davanti alle priorita
  calcolate. Sono ammessi al massimo tre task fissati, aperti e in azione.
- Le azioni rapide completano il task, lo rimandano a domani o lo riattivano.

Le tre card principali mostrano prima i task fissati manualmente e completano gli
eventuali posti liberi con l'ordinamento automatico esistente (priorita, urgenza,
data). Il form impedisce di fissare un quarto task e mostra quali fissaggi possono
essere rimossi. Completare un task o spostarlo **In attesa** rimuove automaticamente
il fissaggio. La stessa regola viene applicata alla copia locale/offline e dal
database tramite trigger.

La Home usa il modello **Area → Progetto/filone → Task** e mantiene il riepilogo
mattutino compatto: **Oggi/Urgente**, **Questa settimana**, **In attesa** e
**Da non perdere di vista**. Le macro-aree canoniche sono Professionista, pOsti,
Food Innovation Broker e Personale. La vista **Inbox** raccoglie i task senza
progetto e permette di classificarli in un secondo momento.

Per allineare un database esistente eseguire
[`migration_operating_model.sql`](./migration_operating_model.sql). La migrazione
e idempotente, aggiunge i campi della gerarchia se mancanti e crea o promuove le
quattro macro-aree senza cambiare gli ID gia referenziati.

## Integrazione ChatGPT / Task Portal

L'endpoint MCP e `/api/mcp` e usa OAuth. Il server espone quattro azioni:

- `list_projects`: legge aree, progetti e relazioni gerarchiche;
- `list_tasks`: legge task aperti/completati, anche per progetto o stato;
- `create_task`: crea task con priorita, scadenza, responsabile e note;
- `update_task`: aggiorna gli stessi campi, completa/riapre, sposta in attesa o
  in Inbox e gestisce il fissaggio tra le priorita di oggi.

`list_projects` include una lettura di compatibilita per installazioni che non
hanno ancora applicato la migrazione delle aree. Se restituisce
`hierarchy_available: false`, applicare `migration_operating_model.sql` prima di
usare la gerarchia. In produzione servono `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (dashboard), `SUPABASE_SERVICE_ROLE_KEY`,
`MCP_OAUTH_SIGNING_SECRET` e `MCP_OAUTH_APPROVAL_SECRET`; le due chiavi Supabase
pubbliche devono appartenere allo stesso progetto usato dalla service role.

Se il progetto Supabase viene sostituito con un database vuoto, la prima
sincronizzazione carica l'intero workspace conservato nel browser (prima aree,
poi progetti, poi task) invece di sovrascrivere la sola copia offline.

Per un database Supabase esistente eseguire
[`migration_today_priorities.sql`](./migration_today_priorities.sql) nel SQL editor.
La migrazione aggiunge lo stato operativo e inserisce le priorita iniziali in modo
idempotente: se un task con lo stesso testo esiste gia, anche se completato, non
viene creato ne riaperto. CRM/GAL, gateway SWITCH e privacy policy non fanno parte
del seed; eventuali record storici corrispondenti vengono conservati ma marcati
come completati. In modalita esclusivamente locale il seed viene unito una sola volta ai
dati del browser, confrontando nome progetto e testo task: i record gia presenti
non vengono sovrascritti ne riaperti. Con Supabase configurato, l'inizializzazione
resta affidata esclusivamente alla migrazione SQL.

Per abilitare il fissaggio manuale su un database esistente, dopo la migrazione
della dashboard eseguire anche
[`migration_manual_today_priorities.sql`](./migration_manual_today_priorities.sql).
La migrazione e idempotente: aggiunge `tasks.is_today_priority`, ripulisce stati
incompatibili, conserva al massimo tre eventuali fissaggi gia presenti e installa
le regole database senza creare o riaprire task. **Non distribuire il codice che
scrive il nuovo campo prima di avere applicato questa migrazione.**

## Aggiunta rapida e tasto Azione iPhone

La pagina mobile-first e disponibile alla route stabile:

```text
https://task-manager-dusky-chi-88.vercel.app/quick-add
```

Usa le stesse funzioni di lettura, scrittura e coda offline della dashboard. La
modalita **Task normale** crea un task medio; **Priorita di oggi** crea un task ad
alta priorita e lo fissa. Se i tre posti sono occupati, la pagina richiede di
rimuovere esplicitamente uno dei fissaggi esistenti prima di continuare.

Configurazione consigliata del tasto Azione:

1. Aprire la route una volta in Safari ed effettuare il normale accesso, se
   richiesto.
2. In **Comandi Rapidi**, creare un comando con l'azione **Apri URL** e inserire
   la route riportata sopra.
3. Assegnare un nome al comando, per esempio “Aggiunta rapida task”.
4. Aprire **Impostazioni → Tasto Azione → Comando rapido**, scegliere il comando
   appena creato e verificare che il pulsante sotto l'azione sia configurato.

Riferimenti Apple: [Aprire URL in Comandi Rapidi](https://support.apple.com/it-it/guide/shortcuts/apd621a1ad7a/ios)
e [assegnare un comando rapido al tasto Azione](https://support.apple.com/it-it/guide/shortcuts/apdfea15680b/ios).

## Task vocale sicuro da Comandi Rapidi

La pagina mobile-first di configurazione e disponibile alla route:

```text
https://task-manager-dusky-chi-88.vercel.app/voice-task
```

Il Comando Rapido invia la dettatura a:

```text
POST https://task-manager-dusky-chi-88.vercel.app/api/voice-tasks
Authorization: Bearer INCOLLA_QUI_IL_TOKEN_REALE
Content-Type: application/json

{"transcript":"Testo dettato"}
```

`INCOLLA_QUI_IL_TOKEN_REALE` e solo un placeholder, non e un token utilizzabile.
Il token reale viene mostrato dalla pagina una sola volta dopo un abbinamento
monouso. La trascrizione non viene mai inserita nell'URL o nella query string.
La risposta JSON contiene `message`, per esempio `Task creato: Chiamare Giuseppe`
oppure `Creato da rivedere: Verificare preventivo`.

### Esperienza utente: una volta e ogni giorno

Una sola volta, per ogni iPhone da configurare:

1. L'amministratore crea un codice di abbinamento associato al profilo. Il codice
   ha 100 bit di entropia, scade dopo 15 minuti e puo essere consumato una volta.
2. L'utente apre `/voice-task`, inserisce quel codice e riceve il token personale.
   Non vede e non inserisce mai `VOICE_TASK_ADMIN_SECRET`.
3. L'utente copia il token nel Comando Rapido e assegna il comando al tasto Azione.

Da quel momento, per ogni task: **premere il tasto Azione, dettare, leggere la
conferma**. Non occorre riaprire la pagina o ripetere l'abbinamento. In caso di
iPhone perso, token dimenticato o nuovo dispositivo, l'amministratore revoca il
token precedente e genera un nuovo codice monouso.

### Architettura dell'abbinamento

L'app non dispone ancora di identita Supabase reali: `virgilio`, `marco` e `ida`
sono preferenze applicative, non account autenticati, e le policy operative
preesistenti non sono per-utente. Un magic-link limitato alla sola pagina vocale
non sarebbe quindi una protezione completa: richiederebbe prima account, mapping
profilo/utente e revisione delle RLS dell'intera app.

L'onboarding usa invece un pairing a capacita limitata:

- `VOICE_TASK_ADMIN_SECRET` resta esclusivamente lato server e protegge soltanto
  la creazione/revoca amministrativa;
- `/api/voice-token` crea il codice monouso solo con header Bearer amministrativo;
- `/api/voice-pair` accetta il codice nel corpo JSON HTTPS, mai nell'URL;
- `exchange_voice_task_pairing` consuma il codice e ruota il token in una singola
  transazione, impedendo doppi utilizzi concorrenti;
- database conserva solo SHA-256 di codici e token; le relative tabelle hanno RLS
  attiva e nessuna policy per `anon` o `authenticated`.

Il compromesso e operativo: senza un login utente verificabile, l'amministratore
deve consegnare il codice monouso attraverso un canale diretto. L'utente compie
comunque il setup una sola volta e non conosce alcun segreto di infrastruttura.

### Configurazione server e ordine di pubblicazione

Il codice locale non basta da solo. Prima di pubblicare:

1. Eseguire [`migration_voice_tasks.sql`](./migration_voice_tasks.sql), quindi
   [`migration_voice_pairing_onboarding.sql`](./migration_voice_pairing_onboarding.sql)
   e [`migration_voice_today_priority_commands.sql`](./migration_voice_today_priority_commands.sql)
   nel SQL Editor del progetto Supabase. Le migrazioni sono idempotenti. L'ultima
   aggiunge la RPC server-only che crea il task e gestisce il pin in una singola
   transazione; non applicarla in produzione prima dell'autorizzazione.
2. Impostare in Vercel, solo come variabili server:
   - `SUPABASE_SERVICE_ROLE_KEY`: service role del progetto Supabase;
   - `VOICE_TASK_ADMIN_SECRET`: segreto casuale di almeno 24 caratteri, usato
     esclusivamente dalle operazioni amministrative e mai inviato al browser;
   - `NEXT_PUBLIC_SUPABASE_URL`: gia usata dall'app, necessaria anche alle route.
3. Pubblicare e verificare `/voice-task`, `/api/voice-pair` e `/api/voice-tasks`.

Nel setup attuale il percorso amministrativo piu semplice e il SQL Editor
Supabase autenticato. Una singola chiamata genera e restituisce il codice:

```sql
SELECT * FROM create_voice_task_pairing('virgilio');
```

La funzione non e eseguibile da `anon` o `authenticated`; resta disponibile al
proprietario del database e alla service role. In alternativa, da un terminale
amministrativo che dispone gia del segreto, caricare
`VOICE_TASK_ADMIN_SECRET` nell'ambiente senza inserirlo negli argomenti, poi:

```bash
npm run voice:pair -- --profile=virgilio
```

Per un ambiente diverso impostare anche `VOICE_TASK_BASE_URL`. Lo script stampa
solo il codice monouso e la scadenza; non stampa il segreto amministrativo. Non
inserire mai `SUPABASE_SERVICE_ROLE_KEY` o `VOICE_TASK_ADMIN_SECRET` nel Comando
Rapido.

### Configurazione esatta in Comandi Rapidi

Questi passaggi si eseguono **una sola volta** per iPhone.

1. Ricevere dall'amministratore il codice monouso, aprire **Task vocale**, inserirlo
   e premere **Abbina e mostra il mio token**. Premere **Copia token personale**.
   Non condividere il token: chi lo possiede puo creare task per quel profilo.
2. Su iPhone aprire **Comandi Rapidi**, toccare **+**, rinominare il nuovo comando
   `Task vocale` e toccare **Add Action** (Aggiungi azione).
3. Cercare e aggiungere **Dictate Text** (Detta testo) come prima azione ed
   espanderla. Impostare:
   - **Language → Italian**;
   - **Stop Listening → When Tapped**.
   `When Tapped` evita che una breve pausa tronchi la frase: al termine della
   dettatura l'utente tocca manualmente per continuare. Questa e una modifica da
   fare **una sola volta nel Comando Rapido**, non nella web app. L'output usato
   nei passaggi successivi e la variabile **Dictated Text**.
4. Cercare e aggiungere **URL** come seconda azione. Nel campo URL incollare:
   `https://task-manager-dusky-chi-88.vercel.app/api/voice-tasks`.
5. Aggiungere **Get Contents of URL** come terza azione e impostare:
   - **Method:** `POST`;
   - in **Headers**, aggiungere la chiave `Authorization` e come valore
     `Bearer INCOLLA_QUI_IL_TOKEN_REALE`, sostituendo l'intero placeholder con
     il token copiato al punto 1; tra `Bearer` e il token deve restare uno spazio;
   - in **Request Body**, scegliere `JSON`, aggiungere la chiave di testo
     `transcript` e assegnarle la variabile magica **Dictated Text** del punto 3.
6. Aggiungere **Get Dictionary Value**. Nel campo della chiave scrivere
   `message`; come dizionario usare l'output **Contents of URL** del punto 5.
7. Aggiungere **Show Result** e selezionare come contenuto il valore
   dizionario del punto 6. Avviare una prova: deve apparire una conferma leggibile.
8. Aprire **Impostazioni → Tasto Azione**, scorrere fino a **Comando rapido**,
   toccare **Scegli un comando rapido** e selezionare `Task vocale`.

Apple documenta i metodi e il corpo JSON in
[Ottieni contenuti dell'URL](https://support.apple.com/it-it/guide/shortcuts/apd58d46713f/ios),
l'estrazione della risposta con
[Ottieni valore dizionario](https://support.apple.com/it-it/guide/shortcuts/apd9cf19a736/ios)
e l'assegnazione in
[Usare il tasto Azione con Comandi Rapidi](https://support.apple.com/it-it/guide/shortcuts/apdfea15680b/ios).
Se **Detta testo** non compare o non acquisisce audio, verificare che Dettatura
sia abilitata in **Impostazioni → Generali → Tastiera → Abilita dettatura**, come
indicato nella [guida Apple alla Dettatura](https://support.apple.com/it-it/guide/iphone/iph2c0651d2/ios).

### Interpretazione e revisione

Il parser e intenzionalmente deterministico: non e configurata alcuna
integrazione LLM nel progetto. Riconosce `oggi`, `domani`, `dopodomani`, date
`gg/mm[/aaaa]`, date italiane come `12 agosto 2026`, priorita alta/media/bassa,
`urgente`, nomi dei progetti attivi e responsabili esplicitamente introdotti da
`responsabile` o `assegna a`. Non inventa campi mancanti. Conflitti, date non
valide, progetti o responsabili sconosciuti producono `needs_review = true` e il
badge **Da rivedere** nella dashboard.

Esempi completi:

- `Chiamare Giuseppe domani, priorità alta, progetto WISE, responsabile Marco`;
- `Inviare la fattura, scade il 12 settembre, progetto GAL, fissalo tra le
  priorità di oggi`: fissa soltanto se ci sono meno di 3 pin; se i posti sono
  pieni crea comunque il task e chiede di liberarne uno;
- `Inviare la fattura, forza priorità di oggi`: la keyword esplicita `forza`
  autorizza la sostituzione del task fissato meno urgente. L'ordine e lo stesso
  della dashboard (priorita, stato/data); a parita viene sostituito il piu
  vecchio. La risposta indica sempre il titolo sostituito.

La RPC serializza il conteggio e l'eventuale sostituzione con la stessa advisory
lock usata dal trigger dei pin. Nessun task viene spostato senza la keyword
`forza`; un conflitto transazionale restituisce una richiesta esplicita di
riprovare.

L'audit conserva una anteprima massima di 160 caratteri e il risultato strutturato,
mai il token. Non viene esposto nella pagina pubblica di onboarding perche, senza
login utente, non e possibile autorizzarne la lettura in modo affidabile.

Per i controlli locali:

```bash
npm test
npm run lint
npm run build
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
