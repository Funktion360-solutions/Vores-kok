'use client';
import { useId, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Heading2, Quote, Eye, Pencil } from 'lucide-react';
import { RichText } from './rich-text';
import { formatSelection, type FormatAction } from '@/lib/rich-text';
const tools = [
  { action: 'bold', label: 'Fed', icon: Bold },
  { action: 'italic', label: 'Kursiv', icon: Italic },
  { action: 'ul', label: 'Punktliste', icon: List },
  { action: 'ol', label: 'Nummereret liste', icon: ListOrdered },
  { action: 'heading', label: 'Underoverskrift', icon: Heading2 },
  { action: 'quote', label: 'Fremhævet råd', icon: Quote },
] as const;
export function TextEditor({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  function format(action: FormatAction) {
    const field = ref.current;
    if (!field) return;
    const change = formatSelection(value, field.selectionStart, field.selectionEnd, action);
    onChange(change.value);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(change.start, change.end);
    });
  }
  return (
    <div className="text-editor">
      <div className="text-editor-heading">
        <label htmlFor={id}>{label}</label>
        <button
          className="text-view-toggle"
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? <Pencil size={15} /> : <Eye size={15} />}{' '}
          {preview ? 'Skriv videre' : 'Vis formatering'}
        </button>
      </div>
      <div className="text-editor-surface">
        <div className="format-toolbar" role="group" aria-label={'Formatering af ' + label}>
          {tools.map(({ action, label: tool, icon: Icon }) => (
            <button
              key={action}
              type="button"
              title={tool}
              aria-label={tool}
              disabled={preview}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(action)}
            >
              <Icon size={17} />
              <span>{tool}</span>
            </button>
          ))}
        </div>
        {preview ? (
          <div className="text-preview" aria-label={'Forhåndsvisning af ' + label}>
            {value.trim() ? (
              <RichText text={value} />
            ) : (
              <p className="preview-empty">Din tekst vises her, når du har skrevet noget.</p>
            )}
          </div>
        ) : (
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'i')
              ) {
                e.preventDefault();
                format(e.key.toLowerCase() === 'b' ? 'bold' : 'italic');
              }
            }}
          />
        )}
      </div>
      <p className="text-editor-hint">
        Markér tekst og vælg formatering.{' '}
        {preview ? 'Se resultatet ovenfor.' : 'Fed: ⌘/Ctrl+B · Kursiv: ⌘/Ctrl+I'}
      </p>
    </div>
  );
}
