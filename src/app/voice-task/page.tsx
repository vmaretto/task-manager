'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

const ENDPOINT_URL = 'https://task-manager-dusky-chi-88.vercel.app/api/voice-tasks';
const TOKEN_PLACEHOLDER = 'INCOLLA_QUI_IL_TOKEN_REALE';
const SETUP_COMPLETE_KEY = 'switchboard.voice-task-setup-complete';

export default function VoiceTaskPage() {
  const [pairingCode, setPairingCode] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [pairedProfile, setPairedProfile] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSetupComplete(window.localStorage.getItem(SETUP_COMPLETE_KEY) === '1');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function pairDevice(event: FormEvent) {
    event.preventDefault();
    if (!pairingCode.trim()) {
      setMessage({ tone: 'error', text: 'Inserisci il codice monouso ricevuto dall’amministratore.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    setRawToken(null);
    try {
      const response = await fetch('/api/voice-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairing_code: pairingCode.trim() }),
      });
      const result = await response.json() as { token?: string; profile?: string; message?: string };
      if (!response.ok || !result.token) throw new Error(result.message || 'Abbinamento non riuscito.');

      setRawToken(result.token);
      setPairedProfile(result.profile ?? null);
      setTokenCopied(false);
      setPairingCode('');
      setMessage({ tone: 'success', text: 'iPhone abbinato. Completa ora il Comando Rapido con il token mostrato.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Abbinamento non riuscito.' });
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setTokenCopied(true);
    setMessage({ tone: 'success', text: 'Token copiato. Incollalo nel Comando Rapido, poi conferma la fine della configurazione.' });
  }

  function finishSetup() {
    window.localStorage.setItem(SETUP_COMPLETE_KEY, '1');
    setSetupComplete(true);
    setRawToken(null);
    setTokenCopied(false);
    setMessage({ tone: 'success', text: 'Configurazione completata. Da ora usa soltanto il tasto Azione.' });
  }

  function restartSetup() {
    window.localStorage.removeItem(SETUP_COMPLETE_KEY);
    setSetupComplete(false);
    setRawToken(null);
    setPairedProfile(null);
    setMessage(null);
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
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">Dopo una sola configurazione, il gesto quotidiano è esattamente questo: <strong className="text-white">premi il tasto Azione, parla, task creato.</strong></p>
          </div>

          <div className="space-y-6 p-5 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">Una volta soltanto</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">Ricevi un codice monouso, copi il token nel Comando Rapido e assegni il comando al tasto Azione.</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Ogni giorno</p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white">1. Premi il tasto Azione<br />2. Detta il task<br />3. Leggi la conferma</p>
              </div>
            </div>

            {setupComplete && !rawToken ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <p className="text-lg font-bold text-emerald-100">✓ Configurazione già completata su questo dispositivo</p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-100/80">Non devi tornare qui ogni volta. Usa direttamente il tasto Azione e detta il task.</p>
                <button type="button" onClick={restartSetup} className="mt-4 rounded-xl border border-emerald-400/35 px-4 py-2.5 text-sm font-bold text-emerald-100">Sostituisci l’iPhone o ripeti l’abbinamento</button>
              </div>
            ) : !rawToken ? (
              <form onSubmit={pairDevice} className="rounded-2xl border border-slate-700 bg-slate-950/35 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Passo iniziale</p>
                <h2 className="mt-1 text-xl font-bold">Abbina questo iPhone</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">Chiedi all’amministratore il tuo <strong className="text-slate-200">codice monouso</strong>: è associato al tuo profilo, scade dopo 15 minuti e funziona una sola volta. Non serve alcuna chiave di gestione server.</p>
                <label className="mt-4 block text-xs font-semibold text-slate-400">Codice monouso
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={pairingCode}
                    onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
                    placeholder="VTP-XXXX-XXXX-XXXX-XXXX-XXXX"
                    className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 font-mono text-base uppercase tracking-wide text-white placeholder:text-slate-500"
                  />
                </label>
                <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-50">{busy ? 'Abbinamento…' : 'Abbina e mostra il mio token'}</button>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">Il codice viene inviato nel corpo cifrato della richiesta HTTPS, mai nell’URL. Dopo l’uso viene invalidato.</p>
              </form>
            ) : null}

            {rawToken && (
              <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-500/10 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Abbinamento riuscito{pairedProfile ? ` · ${pairedProfile}` : ''}</p>
                <p className="mt-1 font-bold text-amber-100">Copia il token adesso: sarà mostrato una sola volta</p>
                <code className="mt-3 block break-all rounded-xl bg-slate-950/70 p-3 text-xs leading-relaxed text-amber-100">{rawToken}</code>
                <button type="button" onClick={() => void copyToken()} className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-slate-950">Copia token personale</button>
                {tokenCopied && <button type="button" onClick={finishSetup} className="mt-3 w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm font-extrabold text-emerald-100">Ho incollato il token: configurazione finita</button>}
                <p className="mt-3 text-xs leading-relaxed text-amber-100/75">Incollalo soltanto nell’header Authorization del Comando Rapido. Non inviarlo in chat, email o screenshot.</p>
              </div>
            )}

            {message && <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100'}`}>{message.text}</div>}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-900/85 p-5 sm:p-8">
          <button type="button" onClick={() => setGuideOpen(open => !open)} className="flex w-full items-center justify-between gap-3 text-left">
            <span><span className="block text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Configurazione una tantum</span><span className="mt-1 block text-xl font-bold sm:text-2xl">Configura tasto Azione iPhone</span></span>
            <span className="text-2xl text-slate-400">{guideOpen ? '−' : '+'}</span>
          </button>

          {guideOpen && (
            <div className="mt-5 space-y-5 border-t border-slate-700 pt-5 text-sm leading-relaxed text-slate-300">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-100"><strong>Quando hai finito questi passaggi non devi più aprire questa pagina.</strong> Ogni nuovo task richiede soltanto tasto Azione e dettatura.</div>
              <ol className="space-y-4">
                <li><strong className="text-white">1. Abbina l’iPhone e copia il token.</strong> Inserisci qui il codice monouso ricevuto dall’amministratore, premi <strong>Abbina e mostra il mio token</strong>, poi <strong>Copia token personale</strong>.</li>
                <li><strong className="text-white">2. Crea il comando.</strong> Apri <strong>Comandi Rapidi</strong>, tocca <strong>+</strong>, rinominalo “Task vocale” e scegli <strong>Add Action</strong> (Aggiungi azione).</li>
                <li><strong className="text-white">3. Aggiungi “Dictate Text”.</strong> Cerca e seleziona <strong>Dictate Text</strong> (Detta testo), espandi l’azione e imposta <strong>Language → Italian</strong> e soprattutto <strong>Stop Listening → When Tapped</strong>. In questo modo la dettatura non si interrompe dopo una breve pausa: quando hai finito, tocchi tu per terminarla. È una modifica una tantum nel Comando Rapido, non una configurazione della web app. L’output è la variabile <strong>Dictated Text</strong>.</li>
                <li><strong className="text-white">4. Aggiungi “URL”.</strong> Come seconda azione cerca <strong>URL</strong> e incolla <code className="break-all text-cyan-200">{ENDPOINT_URL}</code>.</li>
                <li><strong className="text-white">5. Aggiungi “Get Contents of URL”.</strong> Imposta <strong>Method: POST</strong>. In <strong>Headers</strong> aggiungi <strong>Authorization</strong> e come valore <code className="break-all text-amber-200">Bearer {TOKEN_PLACEHOLDER}</code>, sostituendo il placeholder con il token appena copiato. In <strong>Request Body</strong> scegli <strong>JSON</strong>, aggiungi la chiave <code>transcript</code> e assegnale <strong>Dictated Text</strong>.</li>
                <li><strong className="text-white">6. Estrai la conferma.</strong> Aggiungi <strong>Get Dictionary Value</strong>, usa la chiave <code>message</code> e come dizionario il risultato <strong>Contents of URL</strong>.</li>
                <li><strong className="text-white">7. Mostra il risultato.</strong> Aggiungi <strong>Show Result</strong> e usa il valore del passo 6. La conferma dice anche se il task è stato fissato, non fissato perché i posti erano pieni, oppure quale task è stato sostituito.</li>
                <li><strong className="text-white">8. Assegna il tasto Azione.</strong> Apri <strong>Impostazioni → Tasto Azione → Comando rapido → Scegli un comando rapido</strong> e seleziona “Task vocale”.</li>
              </ol>
              <div className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-xs text-cyan-50">
                <p className="font-bold text-cyan-100">Esempi vocali</p>
                <p>“Chiamare Giuseppe domani, priorità alta, progetto WISE, responsabile Marco.”</p>
                <p>“Inviare la fattura, scade il 12 settembre, progetto GAL, <strong>fissalo tra le priorità di oggi</strong>.” Se i 3 posti sono pieni, il task viene creato ma nessuno viene spostato.</p>
                <p>“Inviare la fattura, <strong>forza priorità di oggi</strong>.” Solo la parola <strong>forza</strong> autorizza a sostituire la priorità fissata meno urgente; la conferma ne indica il titolo.</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4 text-xs text-slate-400"><strong className="text-slate-200">Da quel momento:</strong> premi il tasto Azione, parla con calma, tocca per terminare la dettatura e attendi la conferma.</div>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-900/75 p-5 sm:p-8">
          <h2 className="text-xl font-bold">Sicurezza e assistenza</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
            <li>• Il segreto amministrativo rimane sul server e non viene mai chiesto in questa pagina.</li>
            <li>• Il codice di abbinamento è monouso, associato al profilo e scade in 15 minuti.</li>
            <li>• Nel database sono salvati solo gli hash dei codici e dei token.</li>
            <li>• Se perdi l’iPhone o devi rifare il comando, chiedi all’amministratore di revocare il vecchio token e creare un nuovo codice.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
