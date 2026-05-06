export function groupConversationsByDate<T extends { updatedAt: string | Date; pinned?: boolean }>(
  list: T[]
): { label: string; items: T[] }[] {
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86400000;

  const groups: Record<string, T[]> = {
    '📌 Fixadas': [],
    Hoje: [],
    Ontem: [],
    'Últimos 7 dias': [],
    'Últimos 30 dias': [],
    Anteriores: [],
  };

  for (const item of list) {
    if (item.pinned) {
      groups['📌 Fixadas'].push(item);
      continue;
    }
    const d = new Date(item.updatedAt);
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.floor((today0 - d0) / dayMs);
    if (days <= 0) groups['Hoje'].push(item);
    else if (days === 1) groups['Ontem'].push(item);
    else if (days < 7) groups['Últimos 7 dias'].push(item);
    else if (days < 30) groups['Últimos 30 dias'].push(item);
    else groups['Anteriores'].push(item);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}
