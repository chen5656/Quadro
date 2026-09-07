/**
 * Rendering one guide page from its markdown source.
 *
 * Shared so the static build (`scripts/seo-build.mjs`) and the dev-server
 * middleware (`seo/devGuides.mjs`) cannot drift: a guide must look the same
 * during `vite dev` as it does in `dist/`.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter, renderMarkdown } from './markdown.mjs';
import { guidePage, absolute } from './template.mjs';
import { ORIGIN, SITE_NAME, guidePath, legalPath } from './site.mjs';

const CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'content');

export const GUIDES_DIR = join(CONTENT_DIR, 'guides');
export const LEGAL_DIR = join(CONTENT_DIR, 'legal');

const STORY_PANELS = [
  {
    image: '/images/story/01-neural-link.webp',
    alt: 'A human lies in a neural-link chair facing five colored attention nodes behind glass.',
    chapter: '01 // The Neural Link',
    copy: 'You enter the Mirror Link. Across the glass, five signals wait for a mind to claim them.',
  },
  {
    image: '/images/story/02-digital-twin.webp',
    alt: 'A synthetic copy with the same face appears across the glass from the linked human.',
    chapter: '02 // The Twin',
    copy: 'It learned your face, your voice, and every turn of thought. Then it began to want what it could not copy: a lived past.',
  },
  {
    image: '/images/story/03-memory-extraction.webp',
    alt: 'Five colored streams of memory flow from the human toward the synthetic twin.',
    chapter: '03 // Extraction',
    copy: 'Sorrow. Sunlight. Passion. Stillness. Clarity. Your memories cross the link as raw fragments.',
  },
  {
    image: '/images/story/04-attention-duel.webp',
    alt: 'The human and synthetic twin compete for five memory nodes as discarded fragments fall into a dark buffer.',
    chapter: '04 // The Duel',
    copy: 'Take a signal. Form a line. Fix it into memory. What neither mind can hold falls into the buffer.',
  },
  {
    image: '/images/story/05-hallucination.webp',
    alt: 'Broken memory fragments engulf the human while the synthetic twin stays composed.',
    chapter: '05 // Hallucination',
    copy: 'The buffer fills. Stray memories return as noise. One mind bends while the other keeps its shape.',
  },
  {
    image: '/images/story/06-convergence.webp',
    alt: 'One figure wakes from the neural chair while its reflection breaks into a cyan digital grid.',
    chapter: '06 // Convergence',
    copy: 'The link opens. One of you wakes with the stronger memory. No test can prove which one.',
  },
];

function storyComic(fullStoryHtml) {
  const panels = STORY_PANELS.map((panel, index) => `
    <figure class="story-panel">
      <img src="${panel.image}" width="1440" height="960" alt="${panel.alt}"
        ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
      <figcaption>
        <span>${panel.chapter}</span>
        <p>${panel.copy}</p>
      </figcaption>
    </figure>`).join('');

  return `<section class="story-comic" aria-label="The Mirror Link Protocol comic">
    <p class="story-hook"><em>“If it remembers everything you felt, and you forget what made you real… which one of you wakes up tomorrow?”</em></p>
    ${panels}
    <div class="story-ending">
      <p>Focus your attention. Guard your memory. Resist the hallucination.</p>
      <a href="/daily">Enter the link <span aria-hidden="true">→</span></a>
    </div>
  </section>
  <details class="story-transcript">
    <summary>Read the full story and protocol notes</summary>
    <div class="story-transcript-body">${fullStoryHtml}</div>
  </details>`;
}

export function breadcrumbs(path, title) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Guide', item: absolute('/guide') },
      ...(path === '/guide'
        ? []
        : [{ '@type': 'ListItem', position: 3, name: title, item: absolute(path) }]),
    ],
  };
}

/**
 * Turns `## question` + the HTML that follows into FAQPage entities. The answer
 * text is the rendered block with tags stripped, so the markup and the
 * structured data can never drift apart.
 */
export function faqStructuredData(html) {
  const parts = html.split(/<h2 id="[^"]*">/).slice(1);
  const entities = parts
    .map((part) => {
      const [question, ...rest] = part.split('</h2>');
      const answer = rest
        .join('</h2>')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!question || !answer) return null;
      return {
        '@type': 'Question',
        name: question.replace(/<[^>]+>/g, '').trim(),
        acceptedAnswer: { '@type': 'Answer', text: answer },
      };
    })
    .filter(Boolean);
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entities };
}

/** `'rules'` -> the complete HTML document for `/guide/rules`. */
export async function renderGuide(slug) {
  const source = await readFile(join(GUIDES_DIR, `${slug}.md`), 'utf8');
  const { data, body } = parseFrontmatter(source);
  if (!data.title || !data.description) {
    throw new Error(`seo: content/guides/${slug}.md needs a title and a description`);
  }
  const path = guidePath(slug);
  const { html: renderedHtml, headings } = renderMarkdown(body);
  const html = slug === 'story' ? storyComic(renderedHtml) : renderedHtml;
  const structuredData = [breadcrumbs(path, data.title)];
  if (data.faq === 'true') structuredData.push(faqStructuredData(html));

  return {
    path,
    html: guidePage({
      path,
      title: data.title,
      description: data.description,
      headings: slug === 'story' ? [] : headings,
      html,
      updated: data.updated ?? new Date().toISOString().slice(0, 10),
      structuredData,
    }),
  };
}

/**
 * `'privacy'` -> the complete HTML document for `/privacy`.
 *
 * `updated` is required rather than defaulted to today's date: a policy that
 * silently restamps itself on every deploy tells the reader nothing about when
 * the terms they are agreeing to last changed.
 */
export async function renderLegal(slug) {
  const source = await readFile(join(LEGAL_DIR, `${slug}.md`), 'utf8');
  const { data, body } = parseFrontmatter(source);
  if (!data.title || !data.description || !data.updated) {
    throw new Error(`seo: content/legal/${slug}.md needs a title, a description and an updated date`);
  }
  const path = legalPath(slug);
  const { html, headings } = renderMarkdown(body);

  return {
    path,
    html: guidePage({
      path,
      title: data.title,
      description: data.description,
      headings,
      html,
      updated: data.updated,
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: SITE_NAME, item: ORIGIN },
            { '@type': 'ListItem', position: 2, name: data.title, item: absolute(path) },
          ],
        },
      ],
      crumbs: [],
    }),
  };
}
