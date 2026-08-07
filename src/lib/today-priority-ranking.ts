export type TodayPriorityRankable = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  created_at: string;
};

export type VoicePinResult = 'not_requested' | 'pinned' | 'full' | 'replaced';

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

function urgencyRank(task: TodayPriorityRankable, today: string) {
  if (task.due_date && task.due_date < today) return 0;
  if (task.due_date === today) return 1;
  if (task.due_date) return 2;
  return 3;
}

/** Dashboard order: priority first, then overdue/today/future/no date. */
export function compareTodayPriorityUrgency(
  a: TodayPriorityRankable,
  b: TodayPriorityRankable,
  today: string,
) {
  const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDifference !== 0) return priorityDifference;

  const urgencyDifference = urgencyRank(a, today) - urgencyRank(b, today);
  if (urgencyDifference !== 0) return urgencyDifference;

  const dateDifference = (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31');
  if (dateDifference !== 0) return dateDifference;

  const ageDifference = a.created_at.localeCompare(b.created_at);
  if (ageDifference !== 0) return ageDifference;
  return a.id.localeCompare(b.id);
}

/**
 * Force-pin victim: least urgent priority/date, then the oldest task for a
 * deterministic and explainable tie-break. The SQL RPC uses the same order.
 */
export function selectTodayPriorityReplacement<T extends TodayPriorityRankable>(
  tasks: T[],
  today: string,
): T | null {
  return [...tasks].sort((a, b) => {
    const priorityDifference = priorityRank[b.priority] - priorityRank[a.priority];
    if (priorityDifference !== 0) return priorityDifference;

    const urgencyDifference = urgencyRank(b, today) - urgencyRank(a, today);
    if (urgencyDifference !== 0) return urgencyDifference;

    const aDate = a.due_date ?? '9999-12-31';
    const bDate = b.due_date ?? '9999-12-31';
    const dateDifference = bDate.localeCompare(aDate);
    if (dateDifference !== 0) return dateDifference;

    const ageDifference = a.created_at.localeCompare(b.created_at);
    if (ageDifference !== 0) return ageDifference;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}

export function buildVoiceTaskMessage({
  title,
  needsReview,
  pinResult,
  replacedTaskText,
}: {
  title: string;
  needsReview: boolean;
  pinResult: VoicePinResult;
  replacedTaskText?: string | null;
}) {
  if (pinResult === 'full') {
    return `Task creato ma non fissato: ci sono già 3 priorità di oggi. Libera un posto e poi fissa “${title}”.`;
  }
  if (pinResult === 'replaced') {
    return `${needsReview ? 'Creato da rivedere e fissato' : 'Task creato e fissato'}: ${title}. Ha sostituito “${replacedTaskText ?? 'la priorità meno urgente'}”.`;
  }
  if (pinResult === 'pinned') {
    return `${needsReview ? 'Creato da rivedere e fissato' : 'Task creato e fissato'} tra le priorità di oggi: ${title}`;
  }
  return needsReview ? `Creato da rivedere: ${title}` : `Task creato: ${title}`;
}
