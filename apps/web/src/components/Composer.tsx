import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 240) + 'px';
    }
  }, [value]);

  const submit = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setValue('');
  };

  return (
    <div
      className={cn(
        'flex items-end gap-2 bg-bg-surface border border-border-subtle rounded-lg p-2.5',
        'focus-within:border-accent-teal/50 transition-colors duration-150'
      )}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Pergunte qualquer coisa…"
        rows={1}
        disabled={disabled}
        className={cn(
          'flex-1 bg-transparent outline-none resize-none text-[15px] leading-6 px-2 py-1.5',
          'placeholder:text-text-tertiary disabled:opacity-50'
        )}
      />
      <button
        onClick={submit}
        disabled={!value.trim() || disabled}
        className={cn(
          'shrink-0 w-9 h-9 rounded-md flex items-center justify-center',
          'bg-accent-teal text-bg-base hover:bg-accent-teal-hi',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          'transition-colors duration-150 ease-out-expo'
        )}
        title="Enviar (Enter)"
        aria-label="Enviar mensagem"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
