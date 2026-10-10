import { Fragment } from 'react';
import { inlineText, textBlocks } from '@/lib/rich-text';
function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineText(text).map((part, n) => {
        const child = part.text.split('\n').map((line, j) => (
          <Fragment key={j}>
            {j > 0 ? <br /> : null}
            {line}
          </Fragment>
        ));
        return part.kind === 'bold' ? (
          <strong key={n}>{child}</strong>
        ) : part.kind === 'italic' ? (
          <em key={n}>{child}</em>
        ) : part.kind === 'code' ? (
          <code key={n}>{child}</code>
        ) : (
          <Fragment key={n}>{child}</Fragment>
        );
      })}
    </>
  );
}
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={'rich-copy ' + className}>
      {textBlocks(text).map((block, n) =>
        block.kind === 'ul' ? (
          <ul key={n}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : block.kind === 'ol' ? (
          <ol key={n} start={block.start}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </ol>
        ) : block.kind === 'heading' ? (
          <h4 key={n}>
            <Inline text={'text' in block ? block.text : ''} />
          </h4>
        ) : block.kind === 'quote' ? (
          <blockquote key={n}>
            <Inline text={'text' in block ? block.text : ''} />
          </blockquote>
        ) : (
          <p key={n}>
            <Inline text={'text' in block ? block.text : ''} />
          </p>
        ),
      )}
    </div>
  );
}
