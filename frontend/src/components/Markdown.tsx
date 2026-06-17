import type { ReactNode } from 'react';

// A small, dependency-free Markdown renderer tuned for homework briefs:
// headings (#, ##, ###), **bold**, *italic*, `code`, [links](url),
// ordered/unordered lists, horizontal rules, and paragraphs. Not a full
// CommonMark implementation — just the subset teachers actually use.

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={key++} className="font-bold text-on-surface">{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<em key={key++}>{m[3]}</em>);
    else if (m[4] !== undefined) nodes.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-surface-variant/50 text-[0.85em] font-mono">{m[4]}</code>);
    else if (m[5] !== undefined) nodes.push(
      <a key={key++} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">{m[5]}</a>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const HR = /^(-{3,}|\*{3,}|_{3,})$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const ULI = /^[-*+]\s+/;
const OLI = /^\d+\.\s+/;
const BQ = /^>\s?/;
const isSpecial = (t: string) => HR.test(t) || HEADING.test(t) || ULI.test(t) || OLI.test(t) || BQ.test(t);

export default function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }

    if (HR.test(t)) { blocks.push(<hr key={key++} className="my-5 border-outline-variant/30" />); i++; continue; }

    const h = t.match(HEADING);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2]);
      if (level === 1) blocks.push(<h3 key={key++} className="text-xl font-extrabold text-on-surface mt-6 mb-2 first:mt-0">{content}</h3>);
      else if (level === 2) blocks.push(<h4 key={key++} className="text-base font-extrabold text-on-surface mt-5 mb-1.5">{content}</h4>);
      else blocks.push(<h5 key={key++} className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mt-4 mb-1">{content}</h5>);
      i++; continue;
    }

    if (BQ.test(t)) {
      const quote: string[] = [];
      while (i < lines.length && BQ.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(BQ, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="my-3 border-l-4 border-primary/40 bg-primary/5 rounded-r-xl pl-4 pr-3 py-2.5 text-sm text-on-surface leading-relaxed">
          {renderInline(quote.join(' '))}
        </blockquote>,
      );
      continue;
    }

    if (ULI.test(t)) {
      const items: ReactNode[] = [];
      while (i < lines.length && ULI.test(lines[i].trim())) {
        items.push(
          <li key={items.length} className="flex gap-2.5 text-sm text-on-surface leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
            <span>{renderInline(lines[i].trim().replace(ULI, ''))}</span>
          </li>,
        );
        i++;
      }
      blocks.push(<ul key={key++} className="my-2.5 space-y-1.5">{items}</ul>);
      continue;
    }

    if (OLI.test(t)) {
      const items: ReactNode[] = [];
      let n = 1;
      while (i < lines.length && OLI.test(lines[i].trim())) {
        const num = n++;
        items.push(
          <li key={items.length} className="flex gap-2.5 text-sm text-on-surface leading-relaxed">
            <span className="shrink-0 font-bold text-primary tabular-nums">{num}.</span>
            <span>{renderInline(lines[i].trim().replace(OLI, ''))}</span>
          </li>,
        );
        i++;
      }
      blocks.push(<ol key={key++} className="my-2.5 space-y-1.5">{items}</ol>);
      continue;
    }

    // Paragraph: gather consecutive plain lines into one block.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(<p key={key++} className="text-sm text-on-surface leading-relaxed my-2.5">{renderInline(para.join(' '))}</p>);
  }

  return <div className={className}>{blocks}</div>;
}
