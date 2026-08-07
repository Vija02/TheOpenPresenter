import { Fragment, ReactNode } from "react";

/**
 * A tiny Markdown renderer for AI replies.
 */

const INLINE = [
  {
    re: /\*\*(.+?)\*\*/s,
    render: (t: ReactNode, k: number) => <strong key={k}>{t}</strong>,
  },
  {
    re: /__(.+?)__/s,
    render: (t: ReactNode, k: number) => <strong key={k}>{t}</strong>,
  },
  {
    re: /(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/s,
    render: (t: ReactNode, k: number) => <em key={k}>{t}</em>,
  },
  {
    re: /(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/s,
    render: (t: ReactNode, k: number) => <em key={k}>{t}</em>,
  },
] as const;

const CODE = /`([^`]+)`/;

/**
 * Splits one line into styled spans.
 */
const renderInline = (text: string, keyPrefix = ""): ReactNode[] => {
  const codeMatch = CODE.exec(text);
  if (codeMatch && codeMatch.index !== undefined) {
    const [full, inner] = codeMatch;
    return [
      ...renderInline(text.slice(0, codeMatch.index), `${keyPrefix}a`),
      <code
        key={`${keyPrefix}code`}
        className="rounded bg-surface-secondary px-1 py-0.5 text-[0.9em] font-mono"
      >
        {inner}
      </code>,
      ...renderInline(
        text.slice(codeMatch.index + full.length),
        `${keyPrefix}b`,
      ),
    ];
  }

  for (const { re, render } of INLINE) {
    const match = re.exec(text);
    if (!match || match.index === undefined) continue;
    const [full, inner] = match;
    return [
      ...renderInline(text.slice(0, match.index), `${keyPrefix}a`),
      render(renderInline(inner ?? "", `${keyPrefix}i`), 0),
      ...renderInline(text.slice(match.index + full.length), `${keyPrefix}b`),
    ];
  }

  return text ? [<Fragment key={`${keyPrefix}t`}>{text}</Fragment>] : [];
};

/** A leading `-`, `*` or `1.` marker. */
const BULLET = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/;

export type MarkdownProps = {
  text: string;
  className?: string;
};

export const Markdown = ({ text, className }: MarkdownProps) => {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul${blocks.length}`} className="list-disc pl-4 space-y-0.5">
        {bullets.map((item, i) => (
          <li key={i}>{renderInline(item, `li${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const bullet = BULLET.exec(line);
    if (bullet) {
      bullets.push(bullet[1] ?? "");
      continue;
    }
    flushBullets();
    if (line.trim() === "") continue;
    blocks.push(
      <p key={`p${blocks.length}`} className="whitespace-pre-wrap">
        {renderInline(line, `p${blocks.length}`)}
      </p>,
    );
  }
  flushBullets();

  return <div className={className}>{blocks}</div>;
};
