export function formatDiagnosticLogs(logs: Array<{ time: string; level: string; message: string }>) {
  const redact = (text: string) => text
    .replace(/\bBearer\s+\S+/gi, 'Bearer [скрыто]')
    .replace(/\b(access[_-]?token|refresh[_-]?token|user[_-]?token|token|password|authorization|client[_-]?secret|secret|api[_-]?key)(["']?)\s*[:=]\s*["']?([^\s"'&,;}]+)/gi, '$1$2:[скрыто]')
    .replace(/\bmfa\.[\w-]+|\b[\w-]{20,}\.[\w-]{6,}\.[\w-]{15,}\b/g, '[скрыто]')
    .replace(/\b[\w-]{60,}\b/g, '[скрыто]');
  return logs.map(({ time, level, message }) => `[${redact(time)}] [${redact(level)}] ${redact(message)}`).join('\n');
}
