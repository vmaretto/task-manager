const euroFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const decimalEuroFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MetricCard = {
  label: string;
  value: string;
  detail: string;
  tone: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet';
};

type RankingItem = {
  name: string;
  amount: number;
  detail: string;
  kind?: string;
};

const metrics: MetricCard[] = [
  {
    label: 'Movimenti banca 2025',
    value: '815',
    detail: 'Entrate €274.761,91 · Uscite €334.751,69',
    tone: 'blue',
  },
  {
    label: 'Saldo movimenti',
    value: '-€59.989,78',
    detail: 'Da leggere insieme a trasferimenti, imposte e movimenti non fattura',
    tone: 'red',
  },
  {
    label: 'Fatture attive',
    value: '€230.650,76',
    detail: 'Totale fatture italiane emesse nel 2025',
    tone: 'green',
  },
  {
    label: 'Fatture passive',
    value: '€296.272,40',
    detail: 'Totale fatture italiane ricevute nel 2025',
    tone: 'amber',
  },
  {
    label: 'Match già presenti',
    value: '270',
    detail: 'Fatture abbinate: €290.478,97',
    tone: 'violet',
  },
  {
    label: 'Da verificare',
    value: '400 righe',
    detail: 'Pagamenti/incassi senza fattura dopo filtri automatici',
    tone: 'slate',
  },
];

const openAreas = [
  { label: 'Pagamenti senza fattura', amount: 166_509.96, detail: '400 righe dopo filtro automatico', color: 'bg-blue-500' },
  { label: 'Fatture senza pagamento', amount: 306_061.87, detail: '207 righe da chiudere', color: 'bg-amber-500' },
];

const paymentsWithoutInvoice: RankingItem[] = [
  { name: 'Birra Peroni', amount: 88_872.56, detail: '4 movimenti', kind: 'ricavi/incassi da riconciliare' },
  { name: 'Consorzio Tutela e Valorizzazione Olio EVO', amount: 32_940.0, detail: '2 movimenti', kind: 'incassi da collegare a fatture attive' },
  { name: 'Agro Camera / CCIAA RM', amount: 8_490.0, detail: '3 movimenti', kind: 'incassi da verificare' },
  { name: 'EIT Food', amount: 5_752.0, detail: '1 movimento', kind: 'documentazione da controllare' },
  { name: 'AWS EMEA', amount: 1_819.98, detail: '11 movimenti', kind: 'fatture estere/servizi' },
  { name: 'Golden Tulip', amount: 1_279.4, detail: '2 movimenti', kind: 'spese viaggio/ospitalità' },
  { name: 'Google', amount: 1_107.2, detail: 'movimenti ricorrenti', kind: 'fatture estere/servizi' },
  { name: 'Pino al Mare', amount: 1_039.0, detail: 'movimenti da qualificare', kind: 'spese da verificare' },
];

const invoicesWithoutPayment: RankingItem[] = [
  { name: 'Virgilio Maretto', amount: 104_358.8, detail: 'Passiva' },
  { name: 'Birra Peroni S.r.l.', amount: 65_060.16, detail: 'Attiva' },
  { name: 'FEDRO SRL', amount: 42_700.0, detail: 'Passiva' },
  { name: 'Consorzio Olio di Roma IGP', amount: 32_940.0, detail: 'Attiva' },
  { name: 'MIDA SRLS', amount: 13_000.0, detail: 'Passiva' },
  { name: 'Agro Camera', amount: 10_357.8, detail: 'Attiva' },
  { name: 'Aichi Obiettivo 20 S.r.l.', amount: 7_442.0, detail: 'Attiva' },
];

const workflow = [
  'Chiudere prima i blocchi grossi: Peroni, Consorzio Olio Roma, FEDRO, Virgilio Maretto.',
  'Separare incassi/ricavi da pagamenti/costi: non tutto ciò che è “senza fattura” è documento mancante.',
  'Classificare ogni riga in: documento presente da abbinare, documento mancante, non richiede fattura.',
  'Portare al commercialista solo la lista residua davvero da recuperare, non il rumore bancario.',
];

const toneClasses: Record<MetricCard['tone'], string> = {
  slate: 'border-slate-600 bg-slate-800',
  blue: 'border-blue-500/50 bg-blue-500/10',
  green: 'border-green-500/50 bg-green-500/10',
  amber: 'border-amber-500/50 bg-amber-500/10',
  red: 'border-red-500/50 bg-red-500/10',
  violet: 'border-violet-500/50 bg-violet-500/10',
};

function MetricCard({ metric }: { metric: MetricCard }) {
  return (
    <div className={`rounded-2xl border-2 p-4 shadow-lg ${toneClasses[metric.tone]}`}>
      <div className="text-xs uppercase tracking-wide text-slate-400 font-bold">{metric.label}</div>
      <div className="text-2xl font-black text-white mt-2">{metric.value}</div>
      <p className="text-sm text-slate-300 mt-2 leading-snug">{metric.detail}</p>
    </div>
  );
}

function RankingList({ title, items, accent }: { title: string; items: RankingItem[]; accent: string }) {
  const max = Math.max(...items.map((item) => item.amount));

  return (
    <div className="bg-slate-800 rounded-2xl border-2 border-slate-700 p-4 shadow-lg">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.name} className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-500 font-bold">#{index + 1}</div>
                <div className="font-semibold text-white leading-snug">{item.name}</div>
                <div className="text-xs text-slate-400 mt-1">{item.detail}{item.kind ? ` · ${item.kind}` : ''}</div>
              </div>
              <div className="text-right font-black text-white whitespace-nowrap">{decimalEuroFormatter.format(item.amount)}</div>
            </div>
            <div className="h-2 bg-slate-700 rounded-full mt-3 overflow-hidden">
              <div className={`${accent} h-full rounded-full`} style={{ width: `${Math.max(8, (item.amount / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnalysisView() {
  const maxArea = Math.max(...openAreas.map((area) => area.amount));

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border-2 border-blue-500/40 bg-gradient-to-br from-slate-800 to-slate-900 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="text-sm text-blue-300 font-bold uppercase tracking-wide">Analisi amministrativa</div>
            <h2 className="text-3xl font-black text-white mt-1">Bilancio / Prima nota 2025</h2>
            <p className="text-slate-300 mt-2 max-w-2xl">
              Vista operativa per chiudere riconciliazione banca-fatture: evidenzia cosa è già abbinato,
              cosa resta aperto e quali controparti sbloccano più valore.
            </p>
          </div>
          <div className="bg-slate-950/70 border border-slate-700 rounded-2xl p-4 min-w-[180px]">
            <div className="text-xs text-slate-400 font-bold uppercase">Priorità</div>
            <div className="text-xl font-black text-amber-300 mt-1">Top 20 righe</div>
            <div className="text-sm text-slate-400 mt-1">per chiudere l’80% del problema</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="bg-slate-800 rounded-2xl border-2 border-slate-700 p-4 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Aree aperte</h3>
        <div className="space-y-4">
          {openAreas.map((area) => (
            <div key={area.label}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold text-white">{area.label}</div>
                  <div className="text-xs text-slate-400">{area.detail}</div>
                </div>
                <div className="font-black text-white">{euroFormatter.format(area.amount)}</div>
              </div>
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                <div className={`${area.color} h-full rounded-full`} style={{ width: `${(area.amount / maxArea) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingList title="Top pagamenti/incassi senza fattura" items={paymentsWithoutInvoice} accent="bg-blue-500" />
        <RankingList title="Top fatture senza pagamento" items={invoicesWithoutPayment} accent="bg-amber-500" />
      </div>

      <div className="bg-slate-800 rounded-2xl border-2 border-slate-700 p-4 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Metodo di chiusura consigliato</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {workflow.map((step, index) => (
            <div key={step} className="flex gap-3 bg-slate-900/70 border border-slate-700 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black flex-shrink-0">{index + 1}</div>
              <p className="text-sm text-slate-300 leading-snug">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
