/**
 * Tickets are the unit of work (Jira-style). Backed by the tasks collection;
 * the ticket key is a short human-readable alias for the task id.
 */
export function ticketKey(taskId: string): string {
  const hex = taskId.replace(/^task_/, "").replace(/[^0-9a-f]/gi, "");
  return `TKT-${(hex.slice(0, 6) || "000000").toUpperCase()}`;
}
