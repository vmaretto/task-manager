const profileArgument = process.argv.find(argument => argument.startsWith('--profile='));
const profile = profileArgument?.slice('--profile='.length);
const allowedProfiles = new Set(['virgilio', 'marco', 'ida']);
const adminSecret = process.env.VOICE_TASK_ADMIN_SECRET;
const baseUrl = (process.env.VOICE_TASK_BASE_URL || 'https://task-manager-dusky-chi-88.vercel.app').replace(/\/$/, '');

if (!profile || !allowedProfiles.has(profile)) {
  console.error('Uso: npm run voice:pair -- --profile=virgilio|marco|ida');
  process.exit(1);
}

if (!adminSecret || adminSecret.length < 24) {
  console.error('VOICE_TASK_ADMIN_SECRET non è disponibile nell’ambiente amministrativo.');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/voice-token`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminSecret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ action: 'create_pairing', profile }),
});
const result = await response.json();

if (!response.ok || typeof result.pairing_code !== 'string') {
  console.error(result.message || 'Impossibile creare il codice monouso.');
  process.exit(1);
}

console.log(`Codice monouso per ${profile}: ${result.pairing_code}`);
console.log(`Scadenza: ${new Date(result.expires_at).toLocaleString('it-IT')}`);
console.log('Invialo direttamente all’utente: può essere usato una sola volta.');
