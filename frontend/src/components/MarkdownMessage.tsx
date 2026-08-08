import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: ({ children }) => <h1 className="font-heading text-lg font-bold mt-3 mb-1.5 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="font-heading text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="font-heading text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/50 pl-3 my-2 text-text-secondary">{children}</blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || "");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="bg-surface border border-text-secondary/15 rounded px-1.5 py-0.5 text-[0.85em] font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-surface border border-text-secondary/15 rounded-xl p-3 my-2 overflow-x-auto text-[0.85em] font-mono">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-text-secondary/15 my-3" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-text-secondary/20 px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border border-text-secondary/20 px-2 py-1">{children}</td>,
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="max-w-[95%] text-text-primary font-body leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
