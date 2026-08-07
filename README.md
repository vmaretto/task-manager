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
