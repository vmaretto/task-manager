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
Il token reale viene mostrato dalla pagina una sola volta quando viene generato o
rigenerato. La trascrizione non viene mai inserita nell'URL o nella query string.
La risposta JSON contiene `message`, per esempio `Task creato: Chiamare Giuseppe`
oppure `Creato da rivedere: Verificare preventivo`.

### Configurazione server e ordine di pubblicazione

Il codice locale non basta da solo. Prima di pubblicare:

1. Eseguire [`migration_voice_tasks.sql`](./migration_voice_tasks.sql) nel SQL
   Editor del progetto Supabase. La migrazione e idempotente e aggiunge
   `tasks.needs_review`, `tasks.source`, le tabelle di token/audit, indici, RLS e
   la funzione atomica di rotazione.
2. Impostare in Vercel, solo come variabili server:
   - `SUPABASE_SERVICE_ROLE_KEY`: service role del progetto Supabase;
   - `VOICE_TASK_ADMIN_SECRET`: segreto casuale di almeno 24 caratteri, usato
     esclusivamente per generare/revocare token dalla pagina;
   - `NEXT_PUBLIC_SUPABASE_URL`: gia usata dall'app, necessaria anche alle route.
3. Pubblicare il codice e verificare che la route `/voice-task` e l'endpoint
   HTTPS definitivo rispondano.
4. Solo dopo la pubblicazione, aprire `/voice-task`, inserire la chiave di
   gestione, generare il token personale e copiarlo subito.

L'app non dispone ancora di un vero login Supabase: la chiave di gestione server
e quindi il controllo amministrativo necessario per la UI. Non viene salvata in
`localStorage`. I token personali sono casuali, in tabella viene conservato solo
SHA-256, e le tabelle `voice_task_tokens` e `voice_task_events` non hanno policy
pubbliche. Le route server usano la service role; lo Shortcut non dipende da
cookie Safari. Non inserire mai `SUPABASE_SERVICE_ROLE_KEY` o
`VOICE_TASK_ADMIN_SECRET` nel Comando Rapido.

### Configurazione esatta in Comandi Rapidi

Questi passaggi vanno eseguiti **dopo** migrazione e pubblicazione, quando l'URL
definitivo e raggiungibile.

1. Aprire la pagina **Task vocale**, scegliere il profilo, inserire la chiave di
   gestione e premere **Genera token**. Premere **Copia token personale**. Non
   condividere il valore: chi lo possiede puo creare task per quel profilo.
2. Su iPhone aprire **Comandi Rapidi**, toccare **+**, rinominare il nuovo comando
   `Task vocale` e toccare **Aggiungi azione**.
3. Cercare e aggiungere **Detta testo** come prima azione. Espandere l'azione.
   Se la versione di iOS mostra questi campi, impostare:
   - **Lingua:** `Italiano`;
   - **Interrompi ascolto:** `Dopo una pausa`.
   Se i campi non compaiono, non aggiungere azioni sostitutive: Apple varia i
   controlli visibili tra versioni e usa le impostazioni di Dettatura di sistema.
   L'output richiesto nei passaggi successivi e la variabile **Testo dettato**.
4. Cercare e aggiungere **URL** come seconda azione. Nel campo URL incollare:
   `https://task-manager-dusky-chi-88.vercel.app/api/voice-tasks`.
5. Aggiungere **Ottieni contenuti dell'URL** come terza azione. Toccare
   **Mostra altro** e impostare:
   - **Metodo:** `POST`;
   - in **Intestazioni**, aggiungere la chiave `Authorization` e come valore
     `Bearer INCOLLA_QUI_IL_TOKEN_REALE`, sostituendo l'intero placeholder con
     il token copiato al punto 1; tra `Bearer` e il token deve restare uno spazio;
   - in **Corpo richiesta**, scegliere `JSON`, aggiungere la chiave di testo
     `transcript` e assegnarle la variabile magica **Testo dettato** del punto 3.
6. Aggiungere **Ottieni valore dizionario**. Nel campo della chiave scrivere
   `message`; come dizionario usare l'output **Contenuti dell'URL** del punto 5.
7. Aggiungere **Mostra risultato** e selezionare come contenuto il valore
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

Le ultime cinque elaborazioni sono mostrate nella pagina di configurazione solo
dopo l'autorizzazione amministrativa. L'audit conserva una anteprima massima di
160 caratteri e il risultato strutturato, mai il token.

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
