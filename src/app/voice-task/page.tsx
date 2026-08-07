'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type VoiceProfile = 'virgilio' | 'marco' | 'ida';
type TokenState = {
  id: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
} | null;
type RecentEvent = {
  id: string;
  transcript_preview: string;
  status: 'created' | 'needs_review' | 'failed';
  message: string;
  created_at: string;
};

const ENDPOINT_URL = 'https://task-manager-dusky-chi-88.vercel.app/api/voice-tasks';
const TOKEN_PLACEHOLDER = 'INCOLLA_QUI_IL_TOKEN_REALE';

const profileLabels: Record<VoiceProfile, string> = {
  virgilio: 'Virgilio',
  marco: 'Marco',
  ida: 'Ida',
};

export default function VoiceTaskPage() {
  const [profile, setProfile] = useState<VoiceProfile>('virgilio');
  const [adminSecret, setAdminSecret] = useState('');
  const [tokenState, setTokenState] = useState<TokenState>(null);
  const [recent, setRecent] = useState<RecentEvent[]>([]);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem('switchboard.viewer-profile');
      if (stored === 'virgilio' || stored === 'marco' || stored === 'ida') setProfile(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function manageToken(action: 'status' | 'generate' | 'regenerate' | 'revoke') {
    if (!adminSecret.trim()) {
      setMessage({ tone: 'error', text: 'Inserisci la chiave di gestione server.' });
      return;
    }
    if ((action === 'regenerate' || action === 'revoke') && !window.confirm(
      action === 'regenerate'
        ? 'Il token precedente smetterà subito di funzionare. Continuare?'
        : 'Il Comando Rapido smetterà subito di funzionare. Revocare il token?',
    )) return;

    setBusy(true);
    setMessage(null);
    if (action !== 'status') setRawToken(null);
    try {
      const response = await fetch('/api/voice-token', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminSecret.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, profile }),
      });
      const result = await response.json() as {
        token_state?: TokenState;
        token?: string;
        recent?: RecentEvent[];
        message?: string;
      };
      if ('token_state' in result) setTokenState(result.token_state ?? null);
      if (result.recent) setRecent(result.recent);
      if (!response.ok) throw new Error(result.message || 'Operazione non riuscita.');
      if (result.token) setRawToken(result.token);
      setMessage({ tone: 'success', text: result.message || 'Stato aggiornato.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Operazione non riuscita.' });
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage({ tone: 'success', text: `${label} copiato.` });
  }

  function handleStatus(event: FormEvent) {
    event.preventDefault();
    void manageToken('status');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#164e63_0,transparent_38%),linear-gradient(180deg,#0f172a,#020617)] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-3 py-3">
          <Link href="/" className="rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-semibold text-slate-200">← Dashboard</Link>
          <Link href="/quick-add" className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100">⚡ Aggiunta rapida</Link>
        </header>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/90 shadow-2xl shadow-slate-950/40">
          <div className="border-b border-slate-700 bg-gradient-to-br from-cyan-500/20 via-transparent to-violet-500/10 p-5 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Comandi Rapidi · iPhone</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Task vocale</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">Detta una frase dal tasto Azione. L’app riconosce titolo, priorità, scadenza, progetto e responsabile senza inviare il token nell’URL.</p>
          </div>

          <div className="space-y-6 p-5 sm:p-8">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-200">Endpoint HTTPS definitivo</label>
                <button type="button" onClick={() => void copy(ENDPOINT_URL, 'URL')} className="rounded-lg border border-cyan-500/35 px-3 py-1.5 text-xs font-bold text-cyan-100">Copia URL</button>
              </div>
              <code className="block break-all rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs leading-relaxed text-cyan-200">{ENDPOINT_URL}</code>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">La trascrizione viaggia nel corpo JSON di una richiesta POST, mai nella query string.</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">La creazione vocale richiede una connessione Internet; la normale coda offline della web app resta invariata.</p>
            </div>

            <form onSubmit={handleStatus} className="rounded-2xl border border-slate-700 bg-slate-950/35 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-400">Profilo proprietario
                  <select value={profile} onChange={(event) => { setProfile(event.target.value as VoiceProfile); setRawToken(null); setTokenState(null); setRecent([]); }} className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-base text-white">
                    {Object.entries(profileLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-400">Chiave di gestione server
                  <input type="password" autoComplete="off" value={adminSecret} onChange={(event) => setAdminSecret(event.target.value)} placeholder="Richiedila all’amministratore" className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-base text-white placeholder:text-slate-500" />
                </label>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">Questa chiave non viene salvata nel browser. Serve perché l’app attuale non dispone ancora di login Supabase: impedisce a visitatori anonimi di generare token.</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-100 disabled:opacity-50">Controlla stato</button>
                {!tokenState && <button type="button" disabled={busy} onClick={() => void manageToken('generate')} className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">Genera token</button>}
                {tokenState && <button type="button" disabled={busy} onClick={() => void manageToken('regenerate')} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-100 disabled:opacity-50">Rigenera</button>}
                {tokenState && <button type="button" disabled={busy} onClick={() => void manageToken('revoke')} className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-100 disabled:opacity-50">Revoca</button>}
              </div>
            </form>

            {tokenState && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-bold">● Token attivo · {tokenState.token_prefix}…</p>
                <p className="mt-1 text-xs text-emerald-100/70">Creato {new Date(tokenState.created_at).toLocaleString('it-IT')} · {tokenState.last_used_at ? `ultimo uso ${new Date(tokenState.last_used_at).toLocaleString('it-IT')}` : 'mai usato'}</p>
              </div>
            )}

            {rawToken && (
              <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-500/10 p-4 sm:p-5">
                <p className="font-bold text-amber-100">Copialo adesso: sarà mostrato una sola volta</p>
                <code className="mt-3 block break-all rounded-xl bg-slate-950/70 p-3 text-xs leading-relaxed text-amber-100">{rawToken}</code>
                <button type="button" onClick={() => void copy(rawToken, 'Token')} className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-slate-950">Copia token personale</button>
                <p className="mt-3 text-xs leading-relaxed text-amber-100/75">Incollalo soltanto nell’header Authorization del tuo Comando Rapido. Chi lo possiede può creare task a tuo nome: non inviarlo in chat, email o screenshot.</p>
              </div>
            )}

            {message && <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100'}`}>{message.text}</div>}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-900/85 p-5 sm:p-8">
          <button type="button" onClick={() => setGuideOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left">
            <span><span className="block text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Guida campo per campo</span><span className="mt-1 block text-xl font-bold sm:text-2xl">Configura tasto Azione iPhone</span></span>
            <span className="text-2xl text-slate-400">{guideOpen ? '−' : '+'}</span>
          </button>

          {guideOpen && (
            <div className="mt-5 space-y-5 border-t border-slate-700 pt-5 text-sm leading-relaxed text-slate-300">
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-cyan-100"><strong>Dopo la pubblicazione:</strong> prima deve essere applicata <code>migration_voice_tasks.sql</code> e Vercel deve avere le tre variabili server indicate nel README. Solo allora genera il token reale.</div>
              <ol className="space-y-4">
                <li><strong className="text-white">1. Genera e copia il token.</strong> In questa pagina scegli il profilo, inserisci la chiave di gestione, premi <strong>Genera token</strong> e poi <strong>Copia token personale</strong>. Non usare il placeholder qui sotto.</li>
                <li><strong className="text-white">2. Crea il comando.</strong> Apri <strong>Comandi Rapidi</strong>, tocca <strong>+</strong>, rinominalo “Task vocale” e scegli <strong>Aggiungi azione</strong>.</li>
                <li><strong className="text-white">3. Aggiungi “Detta testo”.</strong> Cerca e seleziona <strong>Detta testo</strong>. Espandi l’azione: se la tua versione di iOS mostra i campi, imposta <strong>Lingua: Italiano</strong> e <strong>Interrompi ascolto: Dopo una pausa</strong>. Se non li mostra, lascia l’azione invariata: Apple varia i controlli disponibili tra versioni e usa le impostazioni di Dettatura di sistema. Il risultato da selezionare dopo sarà la variabile <strong>Testo dettato</strong>.</li>
                <li><strong className="text-white">4. Aggiungi “URL”.</strong> Come seconda azione cerca <strong>URL</strong> e incolla esattamente <code className="break-all text-cyan-200">{ENDPOINT_URL}</code>.</li>
                <li><strong className="text-white">5. Aggiungi “Ottieni contenuti dell’URL”.</strong> Come terza azione selezionala e tocca <strong>Mostra altro</strong>. Imposta <strong>Metodo: POST</strong>. In <strong>Intestazioni</strong> aggiungi <strong>Authorization</strong> come chiave e <code className="break-all text-amber-200">Bearer {TOKEN_PLACEHOLDER}</code> come valore, sostituendo tutto il placeholder con il token reale copiato (mantieni “Bearer” e uno spazio). In <strong>Corpo richiesta</strong> scegli <strong>JSON</strong>, aggiungi la chiave testuale <code>transcript</code> e come valore seleziona la variabile magica <strong>Testo dettato</strong> prodotta al passo 3.</li>
                <li><strong className="text-white">6. Estrai la conferma.</strong> Aggiungi <strong>Ottieni valore dizionario</strong>. Nel campo chiave scrivi <code>message</code>; come dizionario lascia il risultato <strong>Contenuti dell’URL</strong> dell’azione precedente.</li>
                <li><strong className="text-white">7. Mostra il risultato.</strong> Aggiungi <strong>Mostra risultato</strong> e usa come contenuto il valore dizionario del passo 6. Prova il comando: deve comparire “Task creato: …” oppure “Creato da rivedere: …”.</li>
                <li><strong className="text-white">8. Assegna il tasto Azione.</strong> Apri <strong>Impostazioni → Tasto Azione</strong>, scorri fino a <strong>Comando rapido</strong>, tocca <strong>Scegli un comando rapido</strong> e seleziona “Task vocale”.</li>
              </ol>
              <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4 text-xs text-slate-400"><strong className="text-slate-200">Prima prova:</strong> “Ricordami di chiamare Giuseppe domani, priorità alta, progetto WISE, responsabile Marco”. Se una data, un progetto o un responsabile non è riconoscibile con certezza, il task viene creato con il badge <strong className="text-amber-200">Da rivedere</strong>.</div>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-900/75 p-5 sm:p-8">
          <h2 className="text-xl font-bold">Elaborazioni recenti</h2>
          <p className="mt-1 text-xs text-slate-500">Le ultime cinque anteprime sono visibili solo dopo il controllo della chiave di gestione.</p>
          {recent.length === 0 ? <p className="mt-4 rounded-xl bg-slate-950/35 p-4 text-sm text-slate-500">Nessuna elaborazione caricata.</p> : (
            <div className="mt-4 space-y-3">
              {recent.map((event) => (
                <article key={event.id} className="rounded-xl border border-slate-700 bg-slate-950/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${event.status === 'needs_review' ? 'bg-amber-500/15 text-amber-100' : 'bg-emerald-500/15 text-emerald-100'}`}>{event.status === 'needs_review' ? 'Da rivedere' : 'Creato'}</span><time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString('it-IT')}</time></div>
                  <p className="mt-2 text-sm text-slate-200">{event.message}</p>
                  <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">“{event.transcript_preview}”</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
