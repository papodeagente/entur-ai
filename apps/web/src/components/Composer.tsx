import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { modelHas, isImageModel } from '@entur-ai/ai';

export interface PendingAttachment {
  kind: 'image' | 'pdf' | 'text';
  mimeType: string;
  data: string;
  name: string;
}

export interface ToolFlags {
  webSearch: boolean;
  codeExec: boolean;
  thinking: boolean;
}

export interface ComposerHandle {
  insertText: (text: string) => void;
  focus: () => void;
}

interface Props {
  onSend: (text: string, attachments: PendingAttachment[], tools: ToolFlags) => void;
  disabled?: boolean;
  modelId: string;
}

async function fileToAttachment(file: File): Promise<PendingAttachment> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  let kind: 'image' | 'pdf' | 'text' = 'text';
  if (file.type.startsWith('image/')) kind = 'image';
  else if (file.type === 'application/pdf') kind = 'pdf';
  return { kind, mimeType: file.type || 'application/octet-stream', data: b64, name: file.name };
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { onSend, disabled, modelId },
  forwardedRef
) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [tools, setTools] = useState<ToolFlags>({
    webSearch: false,
    codeExec: false,
    thinking: false,
  });
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(forwardedRef, () => ({
    insertText: (text: string) => {
      setValue((v) => (v ? v + '\n\n' + text : text));
      setTimeout(() => ref.current?.focus(), 0);
    },
    focus: () => ref.current?.focus(),
  }));

  const isImage = isImageModel(modelId);
  const supportsAttach =
    modelHas(modelId, 'vision') ||
    modelHas(modelId, 'pdf') ||
    modelHas(modelId, 'image-edit');

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 240) + 'px';
    }
  }, [value]);

  const submit = () => {
    const v = value.trim();
    if ((!v && attachments.length === 0) || disabled) return;
    onSend(v, attachments, {
      webSearch: tools.webSearch && modelHas(modelId, 'web-search'),
      codeExec: tools.codeExec && modelHas(modelId, 'code-exec'),
      thinking: tools.thinking && modelHas(modelId, 'thinking'),
    });
    setValue('');
    setAttachments([]);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const converted = await Promise.all(arr.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...converted]);
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 bg-bg-surface border border-border-subtle rounded-lg p-2.5',
        'focus-within:border-accent-teal/50 transition-colors duration-150'
      )}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-bg-elevated rounded-md px-2 py-1 border border-border-subtle"
            >
              {a.kind === 'image' ? (
                <img
                  src={`data:${a.mimeType};base64,${a.data}`}
                  alt={a.name}
                  className="w-8 h-8 object-cover rounded"
                />
              ) : (
                <span className="text-base">📎</span>
              )}
              <span className="text-xs max-w-[150px] truncate">{a.name}</span>
              <button
                onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                className="text-text-tertiary hover:text-accent-danger"
                title="Remover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

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
        placeholder={
          isImage
            ? 'Descreva a imagem que você quer gerar…'
            : 'Pergunte qualquer coisa…'
        }
        rows={1}
        disabled={disabled}
        className={cn(
          'flex-1 bg-transparent outline-none resize-none text-[15px] leading-6 px-2 py-1.5',
          'placeholder:text-text-tertiary disabled:opacity-50'
        )}
      />

      <div className="flex items-center gap-2 px-1 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.txt,.md,.json,.csv"
          className="hidden"
          onChange={(e) => {
            onPickFiles(e.target.files);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />

        {(supportsAttach || isImage) && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            title="Anexar arquivo"
            className="text-text-secondary hover:text-text-primary p-1 rounded transition-colors"
          >
            📎
          </button>
        )}

        {modelHas(modelId, 'web-search') && (
          <ToolToggle
            label="🔎 Web"
            active={tools.webSearch}
            onClick={() => setTools((t) => ({ ...t, webSearch: !t.webSearch }))}
            title="Web Search"
          />
        )}
        {modelHas(modelId, 'code-exec') && (
          <ToolToggle
            label="🐍 Code"
            active={tools.codeExec}
            onClick={() => setTools((t) => ({ ...t, codeExec: !t.codeExec }))}
            title="Code Execution"
          />
        )}
        {modelHas(modelId, 'thinking') && (
          <ToolToggle
            label="💭 Think"
            active={tools.thinking}
            onClick={() => setTools((t) => ({ ...t, thinking: !t.thinking }))}
            title="Extended Thinking"
          />
        )}

        <div className="ml-auto">
          <button
            onClick={submit}
            disabled={(!value.trim() && attachments.length === 0) || disabled}
            className={cn(
              'w-9 h-9 rounded-md flex items-center justify-center',
              'bg-accent-teal text-bg-base hover:bg-accent-teal-hi',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'transition-colors duration-150 ease-out-expo'
            )}
            title="Enviar (Enter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

function ToolToggle({
  label,
  active,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'text-xs px-2 py-1 rounded-md border transition-colors duration-150',
        active
          ? 'bg-accent-teal/15 border-accent-teal/40 text-accent-teal-hi'
          : 'bg-transparent border-border-subtle text-text-secondary hover:bg-bg-elevated'
      )}
    >
      {label}
    </button>
  );
}
