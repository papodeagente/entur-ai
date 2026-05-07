import { useState, useRef } from 'react';
import { cn } from '@/lib/cn';

interface PreProps extends React.HTMLAttributes<HTMLPreElement> {
  children?: React.ReactNode;
}

/**
 * Custom <pre> renderer para react-markdown.
 * Detecta a linguagem do <code class="language-xxx">, mostra header com label
 * e botão Copy, e mantém o highlight do rehype-highlight intacto.
 */
export function CodeBlock(props: PreProps) {
  const { children, className, ...rest } = props;
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  // Tenta extrair linguagem do <code class="language-xxx">
  let language = '';
  let codeText = '';
  try {
    const child: any = Array.isArray(children) ? children[0] : children;
    if (child?.props?.className) {
      const match = /language-(\w+)/.exec(child.props.className);
      if (match) language = match[1];
    }
    const inner = child?.props?.children;
    if (typeof inner === 'string') codeText = inner;
    else if (Array.isArray(inner)) {
      codeText = inner
        .map((x: any) => (typeof x === 'string' ? x : ''))
        .join('');
    }
  } catch {}

  const onCopy = async () => {
    try {
      const text = codeText || preRef.current?.innerText || '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-border-subtle bg-[#0f172a] group/code">
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-elevated/40 border-b border-border-subtle">
        <span className="text-[10px] uppercase tracking-wider font-mono text-text-tertiary">
          {language || 'código'}
        </span>
        <button
          onClick={onCopy}
          className={cn(
            'text-[10px] uppercase tracking-wider font-medium',
            'text-text-tertiary hover:text-text-primary',
            'px-1.5 py-0.5 rounded transition-colors',
            'opacity-60 group-hover/code:opacity-100'
          )}
          aria-label={copied ? 'Copiado' : 'Copiar código'}
        >
          {copied ? '✓ copiado' : '⧉ copiar'}
        </button>
      </div>
      <pre
        ref={preRef}
        {...rest}
        className={cn('!my-0 !border-0 !rounded-none px-4 py-3 overflow-x-auto scrollbar-clean text-[13px]', className)}
      >
        {children}
      </pre>
    </div>
  );
}

export function TableWrapper(props: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="my-3 overflow-x-auto scrollbar-clean rounded-md border border-border-subtle">
      <table {...props} className={cn('!my-0 !border-0', props.className)} />
    </div>
  );
}
