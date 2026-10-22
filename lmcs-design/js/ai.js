// Claude calls for LMCS Design. Runs in the browser with the media team's own API key,
// which stays in this browser's LMCS Design database.

import Anthropic from '../vendor/anthropic-sdk-0.132.1.mjs';
import { buildSystemPrompt, briefText, generateInstruction } from './designer-brain.js';
import { formatBrief } from './formats.js';

const MODEL = 'claude-opus-5-5';

// Downscale for the API (keeps requests small and fast); originals stay full-size for rendering.
export async function blobToImageBlock(blob, maxSide = 1800) {
  const bmp = await createImageBitmap(blob);
  const r = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r);
  c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const data = c.toDataURL('image/jpeg', 0.88).split(',')[1];
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
}

async function imageContent(refBlobs, photoBlobs) {
  const content = [];
  for (let i = 0; i < refBlobs.length; i++) {
    content.push({ type: 'text', text: `Reference ${i + 1}:` });
    content.push(await blobToImageBlock(refBlobs[i]));
  }
  for (let i = 0; i < photoBlobs.length; i++) {
    content.push({ type: 'text', text: `Photo slot ${i}:` });
    content.push(await blobToImageBlock(photoBlobs[i], 1000));
  }
  return content;
}

function parseVariants(text) {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('The designer did not return a design. Try again.');
  const data = JSON.parse(t.slice(a, b + 1));
  const variants = Array.isArray(data.variants) ? data.variants : [data];
  return variants.filter(v => v && Array.isArray(v.elements));
}

async function run({ apiKey, system, content, onProgress }) {
  if (!apiKey) throw new Error('Add your Claude API key in Settings first.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high' },
    system,
    messages: [{ role: 'user', content }],
  });
  let chars = 0;
  stream.on('text', (delta) => { chars += delta.length; onProgress?.({ phase: 'writing', chars }); });
  let msg;
  try {
    msg = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('The API key was not accepted. Check it in Settings.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Too many requests right now. Wait a minute and try again.');
    if (err instanceof Anthropic.BadRequestError) throw new Error(`Request rejected: ${err.message}`);
    if (err instanceof Anthropic.APIError) throw new Error(`Claude API error ${err.status ?? ''}: ${err.message}`);
    throw err;
  }
  if (msg.stop_reason === 'refusal') throw new Error('The request was declined. Rephrase the brief and try again.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The design was too long to finish. Try fewer references or a shorter brief.');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return parseVariants(text);
}

export async function generateDesigns({ apiKey, brand, brief, fmt, refBlobs, photoBlobs, onProgress }) {
  onProgress?.({ phase: 'reading' });
  const content = await imageContent(refBlobs, photoBlobs);
  content.push({ type: 'text', text: briefText(brief, fmt, brand) + '\n\n' + generateInstruction(brief, refBlobs.length, photoBlobs.length) });
  return run({ apiKey, system: buildSystemPrompt(brand), content, onProgress });
}

export async function refineDesign({ apiKey, brand, brief, fmt, spec, instruction, refBlobs, photoBlobs, onProgress }) {
  onProgress?.({ phase: 'reading' });
  const content = await imageContent(refBlobs, photoBlobs);
  content.push({ type: 'text', text: [
    briefText(brief, fmt, brand),
    'CURRENT DESIGN:', JSON.stringify(spec),
    `CHANGE REQUESTED BY THE MEDIA TEAM: ${instruction}`,
    'Apply the change and keep everything else that works. Return { "variants": [ ONE DESIGN ] }.',
  ].join('\n\n') });
  return run({ apiKey, system: buildSystemPrompt(brand), content, onProgress });
}

export async function adaptDesign({ apiKey, brand, brief, fromFmt, toFmt, spec, photoBlobs, onProgress }) {
  onProgress?.({ phase: 'reading' });
  const content = await imageContent([], photoBlobs);
  content.push({ type: 'text', text: [
    briefText(brief, toFmt, brand),
    `SOURCE DESIGN (made for ${formatBrief(fromFmt)}):`, JSON.stringify(spec),
    `Re-lay this design for the NEW FORMAT: ${formatBrief(toFmt)}`,
    'Keep the same campaign identity (colours, motifs, headline, photo choice) so both read as one campaign,',
    'but rebuild the layout properly for the new shape, medium and viewing distance - do not just stretch it.',
    'Return { "variants": [ ONE DESIGN ] }.',
  ].join('\n') });
  return run({ apiKey, system: buildSystemPrompt(brand), content, onProgress });
}
