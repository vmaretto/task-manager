export type VoicePriority = 'high' | 'medium' | 'low';
export type VoicePinMode = 'none' | 'pin' | 'force';

export interface VoiceProject {
  id: string;
  name: string;
}

export interface ParsedVoiceTask {
  title: string;
  priority: VoicePriority;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  assignee: string | null;
  pinMode: VoicePinMode;
  needsReview: boolean;
  reviewReasons: string[];
}

const forcePinDirective = String.raw`\b(?:forza(?:lo|la)?\s+(?:(?:tra\s+le)|nelle)\s+priorit[aà]\s+di\s+oggi|forza(?:lo|la)?\s+priorit[aà]\s+di\s+oggi)\b`;
const pinDirective = String.raw`\b(?:(?:fissa|metti)(?:lo|la)?\s+(?:(?:tra\s+le)|nelle)\s+priorit[aà]\s+di\s+oggi)\b`;

const italianMonths: Record<string, number> = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseReferenceDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('referenceDate deve usare il formato YYYY-MM-DD');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function validDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day
    ? value
    : null;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function containsWholePhrase(value: string, phrase: string) {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}(?=$|[^\\p{L}\\p{N}])`, 'u').test(value);
}

function cleanTitle(transcript: string, projectName: string | null) {
  let title = transcript.trim();

  title = title
    .replace(/^\s*(?:ehi\s+)?(?:crea|aggiungi|inserisci|registra)\s+(?:un\s+)?(?:nuovo\s+)?task\s*(?:per|di|:)?\s*/i, '')
    .replace(/^\s*ricordami\s+di\s+/i, '')
    .replace(/^\s*(?:devo|bisogna|occorre)\s+/i, '');

  title = title
    .replace(new RegExp(forcePinDirective, 'gi'), ' ')
    .replace(new RegExp(pinDirective, 'gi'), ' ')
    .replace(/\b(?:con\s+)?priorit[aà]\s+(?:alta|media|bassa)\b/gi, ' ')
    .replace(/\b(?:ad\s+)?alta\s+priorit[aà]\b/gi, ' ')
    .replace(/\b(?:urgente|prioritario|prioritaria)\b/gi, ' ')
    .replace(/\b(?:(?:scade|scadenza|entro|per)(?:\s+il)?\s+)?(?:oggi|domani|dopodomani)\b/gi, ' ')
    .replace(/\b(?:(?:scade|scadenza|entro|per)(?:\s+il)?\s+)?\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/gi, ' ')
    .replace(/\b(?:(?:scade|scadenza|entro|per)(?:\s+il)?\s+)?\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+\d{4})?\b/gi, ' ')
    .replace(/\b(?:assegna(?:to)?\s+a|responsabile(?:\s*[:è])?)\s+[^,;.]+/gi, ' ');

  if (projectName) {
    const escaped = escapeRegExp(projectName);
    title = title
      .replace(new RegExp(`\\b(?:progetto|per|su)\\s+${escaped}(?=\\b|\\s|[,;.])`, 'gi'), ' ')
      .replace(new RegExp(escaped, 'gi'), ' ');
  } else {
    title = title.replace(/\bprogetto\s+[^,;.]+/gi, ' ');
  }

  title = title
    .replace(/\s*[,;:]\s*/g, ' ')
    .replace(/\s*\.\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!title) return '';
  return title.charAt(0).toLocaleUpperCase('it-IT') + title.slice(1);
}

export function parseVoiceTask(
  transcript: string,
  projects: VoiceProject[],
  referenceDate: string,
  allowedAssignees = ['Virgilio', 'Marco', 'Ida'],
): ParsedVoiceTask {
  const cleanTranscript = transcript.trim().replace(/\s+/g, ' ');
  const normalizedTranscript = normalize(cleanTranscript);
  const forcePinRequested = new RegExp(forcePinDirective, 'i').test(normalizedTranscript);
  const pinRequested = forcePinRequested || new RegExp(pinDirective, 'i').test(normalizedTranscript);
  const pinMode: VoicePinMode = forcePinRequested ? 'force' : pinRequested ? 'pin' : 'none';
  const transcriptWithoutPinDirective = cleanTranscript
    .replace(new RegExp(forcePinDirective, 'gi'), ' ')
    .replace(new RegExp(pinDirective, 'gi'), ' ');
  const normalizedFieldTranscript = normalize(transcriptWithoutPinDirective);
  const today = parseReferenceDate(referenceDate);
  const reviewReasons: string[] = [];

  const priorityCandidates: VoicePriority[] = [];
  if (/\b(?:priorita\s+alta|alta\s+priorita|urgente|prioritario|prioritaria)\b/.test(normalizedTranscript)) priorityCandidates.push('high');
  if (/\bpriorita\s+media\b/.test(normalizedTranscript)) priorityCandidates.push('medium');
  if (/\bpriorita\s+bassa\b/.test(normalizedTranscript)) priorityCandidates.push('low');
  const priorities = unique(priorityCandidates);
  if (priorities.length > 1) reviewReasons.push('Sono state indicate priorità in conflitto.');
  const priority = priorities.length === 1 ? priorities[0] : 'medium';

  const dateCandidates: string[] = [];
  if (/\bdopodomani\b/.test(normalizedFieldTranscript)) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + 2);
    dateCandidates.push(dateKey(date));
  } else if (/\bdomani\b/.test(normalizedFieldTranscript)) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + 1);
    dateCandidates.push(dateKey(date));
  }
  if (/\boggi\b/.test(normalizedFieldTranscript)) dateCandidates.push(dateKey(today));

  for (const match of cleanTranscript.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : today.getUTCFullYear();
    if (year < 100) year += 2000;
    let parsed = validDate(year, month, day);
    if (parsed && !match[3] && parsed < today) parsed = validDate(year + 1, month, day);
    if (parsed) dateCandidates.push(dateKey(parsed));
    else reviewReasons.push(`La data “${match[0]}” non è valida.`);
  }

  const monthPattern = Object.keys(italianMonths).join('|');
  const writtenDate = new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})(?:\\s+(\\d{4}))?\\b`, 'gi');
  for (const match of cleanTranscript.matchAll(writtenDate)) {
    const day = Number(match[1]);
    const month = italianMonths[normalize(match[2])];
    const year = match[3] ? Number(match[3]) : today.getUTCFullYear();
    let parsed = validDate(year, month, day);
    if (parsed && !match[3] && parsed < today) parsed = validDate(year + 1, month, day);
    if (parsed) dateCandidates.push(dateKey(parsed));
    else reviewReasons.push(`La data “${match[0]}” non è valida.`);
  }

  const dates = unique(dateCandidates);
  if (dates.length > 1) reviewReasons.push('Sono state indicate più scadenze diverse.');
  if (/\b(?:lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|settimana prossima)\b/.test(normalizedFieldTranscript) && dates.length === 0) {
    reviewReasons.push('La scadenza espressa a parole richiede conferma.');
  }
  const dueDate = dates.length === 1 ? dates[0] : null;

  const projectCandidates = projects
    .filter((project) => {
      const projectName = normalize(project.name);
      return containsWholePhrase(normalizedTranscript, projectName);
    })
    .sort((a, b) => b.name.length - a.name.length);
  const longestProject = projectCandidates[0] ?? null;
  const projectConflicts = projectCandidates.filter((project) => longestProject && !normalize(longestProject.name).includes(normalize(project.name)));
  if (projectConflicts.length > 0) reviewReasons.push('Sono stati riconosciuti più progetti.');
  if (/\bprogetto\b/.test(normalizedTranscript) && !longestProject) reviewReasons.push('Il progetto indicato non corrisponde a un progetto disponibile.');
  const project = projectConflicts.length === 0 ? longestProject : null;

  const assigneeDirective = /\b(?:assegna(?:to)?\s+a|responsabile(?:\s*[:è])?)\s+([^,;.]+)/i.exec(cleanTranscript);
  let assignee: string | null = null;
  if (assigneeDirective) {
    const directiveValue = normalize(assigneeDirective[1]);
    const matchedAssignees = allowedAssignees.filter((name) => new RegExp(`\\b${escapeRegExp(normalize(name))}\\b`).test(directiveValue));
    if (matchedAssignees.length === 1) assignee = matchedAssignees[0];
    else if (matchedAssignees.length > 1) assignee = matchedAssignees.join(' + ');
    else reviewReasons.push('Il responsabile indicato non è tra i profili disponibili.');
  }

  const title = cleanTitle(cleanTranscript, project?.name ?? null);
  if (title.length < 3) reviewReasons.push('Il titolo non è abbastanza chiaro.');

  return {
    title: title || 'Task vocale da definire',
    priority,
    dueDate,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    assignee,
    pinMode,
    needsReview: reviewReasons.length > 0,
    reviewReasons: unique(reviewReasons),
  };
}
