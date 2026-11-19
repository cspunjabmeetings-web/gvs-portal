// spec: F16-AC2, 9.2 — admin preview mein note ka matn wohi shakal jo visitor dekhe ga. `dangerouslySetInnerHTML` SIRF markdown.ts ke natije par.
import { renderMarkdown } from '../lib/markdown';

export default function NoteBody(p: { md: string }) {
  return <div class="note-body text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.md).html }} data-note-body />;
}
