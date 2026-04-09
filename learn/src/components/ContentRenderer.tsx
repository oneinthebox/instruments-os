import type { ContentBlock } from '@/data/types';
import { Mermaid } from '@/components/Mermaid';
import { Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

const CALLOUT_STYLES = {
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/5',
    icon: Info,
    iconColor: 'text-blue-400',
  },
  warning: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
  },
  tip: {
    border: 'border-l-primary',
    bg: 'bg-primary/5',
    icon: Lightbulb,
    iconColor: 'text-primary',
  },
};

function TextBlock({ content }: { content: string }) {
  // Basic markdown-like rendering: bold, inline code, line breaks
  const html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-primary">$1</code>')
    .replace(/\n/g, '<br />');

  return (
    <div
      className="text-base leading-relaxed text-foreground/90"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CodeBlock({ language, content }: { language: string; content: string }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg bg-[#0a0a0a] ring-1 ring-foreground/5">
      <div className="flex items-center justify-between border-b border-foreground/5 px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">{language}</span>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-sm leading-relaxed text-foreground/90">
          {content}
        </code>
      </pre>
    </div>
  );
}

function CalloutBlock({
  variant,
  content,
}: {
  variant: 'info' | 'warning' | 'tip';
  content: string;
}) {
  const style = CALLOUT_STYLES[variant];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'my-4 flex gap-3 rounded-r-lg border-l-2 px-4 py-3',
        style.border,
        style.bg
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', style.iconColor)} />
      <div className="text-sm leading-relaxed text-foreground/80">{content}</div>
    </div>
  );
}

function ComparisonTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 bg-muted/50">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2 text-left font-medium text-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-foreground/5 last:border-0"
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-4 py-2 text-foreground/80"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ContentRendererProps {
  blocks: ContentBlock[];
}

export function ContentRenderer({ blocks }: ContentRendererProps) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'text':
            return <TextBlock key={i} content={block.content} />;
          case 'code':
            return (
              <CodeBlock key={i} language={block.language} content={block.content} />
            );
          case 'mermaid':
            return <Mermaid key={i} chart={block.content} />;
          case 'callout':
            return (
              <CalloutBlock key={i} variant={block.variant} content={block.content} />
            );
          case 'comparison-table':
            return (
              <ComparisonTable key={i} headers={block.headers} rows={block.rows} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
