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
- Le azioni rapide completano il task, lo rimandano a domani o lo riattivano.

Per un database Supabase esistente eseguire
[`migration_today_priorities.sql`](./migration_today_priorities.sql) nel SQL editor.
La migrazione aggiunge lo stato operativo e inserisce le priorita iniziali in modo
idempotente: se un task con lo stesso testo esiste gia, anche se completato, non
viene creato ne riaperto. CRM/GAL, gateway SWITCH e privacy policy non fanno parte
del seed. In modalita esclusivamente locale il seed viene unito una sola volta ai
dati del browser, confrontando nome progetto e testo task: i record gia presenti
non vengono sovrascritti ne riaperti. Con Supabase configurato, l'inizializzazione
resta affidata esclusivamente alla migrazione SQL.

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
