import {
  createVoiceToken,
  getVoiceServerClient,
  hashVoicePairingCode,
  hashVoiceToken,
  noStoreJson,
  normalizeVoicePairingCode,
} from '@/lib/voice-task-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLocaleLowerCase().includes('application/json')) {
    return noStoreJson({ message: 'Invia un corpo JSON.' }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ message: 'Il corpo JSON non è valido.' }, { status: 400 });
  }

  const pairingCode = body && typeof body === 'object' && 'pairing_code' in body && typeof body.pairing_code === 'string'
    ? normalizeVoicePairingCode(body.pairing_code)
    : null;
  const pairingCodeHash = pairingCode ? hashVoicePairingCode(pairingCode) : null;
  if (!pairingCodeHash) {
    return noStoreJson({ message: 'Codice monouso non valido o scaduto.' }, { status: 401 });
  }

  try {
    const rawToken = createVoiceToken();
    const supabase = getVoiceServerClient();
    const { data, error } = await supabase.rpc('exchange_voice_task_pairing', {
      pairing_hash_value: pairingCodeHash,
      new_token_hash_value: hashVoiceToken(rawToken),
      new_token_prefix_value: rawToken.slice(0, 11),
    });
    const exchange = Array.isArray(data) ? data[0] : null;
    if (error || !exchange?.owner_profile || !exchange?.token_id) {
      return noStoreJson({ message: 'Codice monouso non valido o scaduto.' }, { status: 401 });
    }

    return noStoreJson({
      token: rawToken,
      profile: exchange.owner_profile,
      message: 'Abbinamento completato. Copia ora il token nel Comando Rapido: non sarà più mostrato.',
    }, { status: 201 });
  } catch {
    return noStoreJson({ message: 'Abbinamento temporaneamente non disponibile.' }, { status: 503 });
  }
}
