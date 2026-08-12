const SENTENCE_BOUNDARY = /[.!?]["')\]]?(?=\s|$)/;
const PARAGRAPH_BREAK = "\n\n";

export function splitLead(body: string): { lead: string; remainder: string } {
  const text = body.trim();
  if (text === "") return { lead: "", remainder: "" };

  const sentence = SENTENCE_BOUNDARY.exec(text);
  const sentenceEnd = sentence === null ? -1 : sentence.index + sentence[0].length;
  const paragraphEnd = text.indexOf(PARAGRAPH_BREAK);
  const boundary =
    paragraphEnd >= 0 && (sentenceEnd < 0 || paragraphEnd < sentenceEnd)
      ? paragraphEnd
      : sentenceEnd;

  if (boundary < 0 || boundary >= text.length) return { lead: text, remainder: "" };
  return { lead: text.slice(0, boundary).trim(), remainder: text.slice(boundary).trim() };
}
