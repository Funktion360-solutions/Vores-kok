import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { textBlocks, inlineText } from './rich-text';
import { detailFields, totalTime, type PublicRecipe } from './model';
let fontFiles: Promise<Buffer[]> | undefined;
const ink = rgb(0.21, 0.24, 0.22),
  muted = rgb(0.4, 0.45, 0.43),
  blue = rgb(0.28, 0.43, 0.5),
  sand = rgb(0.94, 0.91, 0.85);
type Run = { text: string; font: PDFFont };
export async function recipePdf(recipe: PublicRecipe, origin: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  fontFiles ||= Promise.all(
    ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSerif.ttf'].map((name) =>
      readFile(join(process.cwd(), 'assets/pdf', name)),
    ),
  );
  const fonts = await Promise.all(
    (await fontFiles).map((bytes) => doc.embedFont(bytes, { subset: true })),
  );
  const [regular, bold, serif] = fonts as [PDFFont, PDFFont, PDFFont];
  const supported = new Map(fonts.map((font) => [font, new Set(font.getCharacterSet())]));
  const clean = (text: string, font: PDFFont) =>
    Array.from(text.normalize('NFC'))
      .filter((c) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(c))
      .map((c) => (supported.get(font)!.has(c.codePointAt(0)!) || c === '\n' ? c : '?'))
      .join('');
  const W = 595.28,
    H = 841.89,
    margin = 52,
    width = W - margin * 2;
  let page: PDFPage;
  let y = H - 108;
  function nextPage() {
    if (doc.getPageCount() >= 200) throw new Error('Opskriften er for lang til PDF.');
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: sand });
    page.drawText('AkselsMad', { x: margin, y: H - 44, font: serif, size: 22, color: ink });
    page.drawText('OPSKRIFTER AF AKSEL SLOT', {
      x: W - 225,
      y: H - 40,
      font: regular,
      size: 8,
      color: blue,
    });
    y = H - 105;
  }
  function room(height: number) {
    if (y - height < 66) nextPage();
  }
  function lines(runs: Run[], size: number, indent = 0, color = ink) {
    let x = margin + indent;
    let used = 0;
    const max = width - indent;
    room(size * 1.5);
    const newline = () => {
      y -= size * 1.5;
      room(size * 1.5);
      x = margin + indent;
      used = 0;
    };
    for (const run of runs) {
      const text = clean(run.text, run.font);
      for (const token of text.split(/(\n|\s+)/).filter(Boolean)) {
        if (token === '\n') {
          newline();
          continue;
        }
        const space = /^\s+$/.test(token);
        let word = space ? ' ' : token;
        let length = run.font.widthOfTextAtSize(word, size);
        if (used + length > max && used > 0) {
          newline();
          if (space) continue;
        }
        if (used === 0 && space) continue;
        if (length > max) {
          for (const char of Array.from(word)) {
            length = run.font.widthOfTextAtSize(char, size);
            if (used + length > max && used > 0) newline();
            page.drawText(char, { x, y, font: run.font, size, color });
            x += length;
            used += length;
          }
        } else {
          page.drawText(word, { x, y, font: run.font, size, color });
          x += length;
          used += length;
        }
      }
    }
    y -= size * 1.5;
  }
  function heading(text: string, size = 16) {
    room(56);
    y -= 10;
    lines([{ text, font: serif }], size, 0, blue);
    y -= 7;
  }
  function rich(text: string, size = 10.5) {
    for (const block of textBlocks(text)) {
      if (block.kind === 'ul' || block.kind === 'ol') {
        for (let n = 0; n < block.items.length; n++) {
          room(size * 1.5);
          page.drawText(block.kind === 'ul' ? '-' : `${block.start + n}.`, {
            x: margin,
            y,
            font: bold,
            size,
            color: blue,
          });
          lines(
            inlineText(block.items[n]!).map((part) => ({
              text: part.text,
              font: part.kind === 'bold' ? bold : regular,
            })),
            size,
            23,
          );
          y -= 3;
        }
      } else if ('text' in block) {
        if (block.kind === 'heading') heading(block.text, 13);
        else {
          lines(
            inlineText(block.text).map((part) => ({
              text: part.text,
              font: part.kind === 'bold' ? bold : regular,
            })),
            size,
            block.kind === 'quote' ? 18 : 0,
            block.kind === 'quote' ? muted : ink,
          );
          y -= 6;
        }
      }
    }
  }
  nextPage();
  const r = recipe.content;
  lines([{ text: r.title, font: serif }], 27);
  y -= 10;
  lines(
    [
      {
        text: `${r.category || 'Opskrift'} | ${r.servings} ${r.yield_unit || 'personer'} | ${totalTime(r) ? totalTime(r) + ' min i alt' : 'Tid ikke angivet'}`,
        font: bold,
      },
    ],
    9,
    0,
    blue,
  );
  y -= 8;
  const timing = [
    r.prep_minutes ? `Forberedelse: ${r.prep_minutes} min` : '',
    r.cook_minutes ? `Tilberedning: ${r.cook_minutes} min` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  if (timing) {
    lines([{ text: timing, font: regular }], 9, 0, muted);
    y -= 6;
  }
  if (r.description) rich(r.description);
  heading('Ingredienser');
  for (const i of r.ingredients) {
    const amount =
      i.quantity === null
        ? ''
        : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(i.quantity) + ' ';
    lines(
      [
        {
          text: `${amount}${i.unit ? i.unit + ' ' : ''}${i.name}${i.preparation ? ', ' + i.preparation : ''}`,
          font: regular,
        },
      ],
      10.5,
    );
    y -= 4;
  }
  heading('Fremgangsmåde');
  for (let n = 0; n < r.steps.length; n++) {
    room(55);
    lines([{ text: `Trin ${n + 1}`, font: bold }], 11, 0, blue);
    y -= 4;
    rich(r.steps[n]!.body);
    if (r.steps[n]!.timer_seconds) {
      lines(
        [
          {
            text: `Vejledende tid: ${Math.round(r.steps[n]!.timer_seconds! / 60)} min`,
            font: regular,
          },
        ],
        9,
        0,
        muted,
      );
      y -= 7;
    }
    y -= 5;
  }
  for (const [field, title] of detailFields)
    if (r[field]) {
      heading(title);
      rich(r[field]!);
    }
  heading('Find opskriften igen', 13);
  lines(
    [{ text: new URL('/opskrifter/' + recipe.slug, origin).href, font: regular }],
    8.5,
    0,
    blue,
  );
  lines(
    [
      {
        text: `Udgave ${recipe.published_revision}. Hentet ${new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen' }).format(new Date())}.`,
        font: regular,
      },
    ],
    8.5,
    0,
    muted,
  );
  const pages = doc.getPages();
  for (let n = 0; n < pages.length; n++) {
    pages[n]!.drawLine({
      start: { x: margin, y: 49 },
      end: { x: W - margin, y: 49 },
      thickness: 0.5,
      color: sand,
    });
    pages[n]!.drawText('AkselsMad | Aksel Slot', {
      x: margin,
      y: 33,
      font: regular,
      size: 8,
      color: muted,
    });
    pages[n]!.drawText(`Side ${n + 1} af ${pages.length}`, {
      x: W - 120,
      y: 33,
      font: regular,
      size: 8,
      color: muted,
    });
  }
  doc.setTitle(r.title);
  doc.setAuthor('Aksel Slot');
  doc.setCreator('AkselsMad');
  doc.setSubject('Opskrift fra AkselsMad');
  return doc.save();
}
