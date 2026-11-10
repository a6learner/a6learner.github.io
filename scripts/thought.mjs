// Pin a short thought:   npm run thought "What I was thinking"
// In Chinese:            npm run thought "想到的事" -- --zh
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const zh = args.includes('--zh');
const text = args.filter((a) => !a.startsWith('--')).join(' ').trim();
if (!text) {
  console.log('Usage: npm run thought "What I was thinking"   (add -- --zh for Chinese)');
  process.exit(1);
}
const now = new Date();
const today = now.toLocaleDateString('sv-SE');
const stamp = now.toTimeString().slice(0, 8).replace(/:/g, '');
const file = path.join('src', 'content', 'thoughts', `${today}-${stamp}.${zh ? 'zh' : 'en'}.md`);
fs.writeFileSync(file, `---\ndate: ${today}\n---\n\n${text}\n`);
console.log(`Pinned ${file}. Run npm run publish to put it online.`);
