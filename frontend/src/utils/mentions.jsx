/**
 * Render update text with @mentions highlighted.
 * `mentions` is the populated list on the update ([{ _id, name }]).
 * Returns the original string when there is nothing to highlight, otherwise
 * an array of strings and <span className="mq-mention"> nodes.
 */
export function highlightMentions(text, mentions = []) {
  if (!text) return text;

  const names = [...new Set((mentions || []).map((m) => m?.name).filter(Boolean))]
    .sort((a, b) => b.length - a.length); // match longer names first
  if (names.length === 0) return text;

  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`@(?:${escaped.join('|')})`, 'g');

  const parts = [];
  let last = 0;
  let key = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={key++} className="mq-mention">{m[0]}</span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Resolve which participants are mentioned in the given text by matching
 * "@Name" tokens. Returns an array of participant ids.
 */
export function extractMentionIds(text, participants = []) {
  if (!text) return [];
  return participants.filter((p) => p.name && text.includes(`@${p.name}`)).map((p) => p._id);
}
