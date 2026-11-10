// Publish public content from the command line (the writing desk has the same thing as a button).
//   npm run publish
//   npm run publish "New post about X"
// Uses the same allowlist and checks as the desk: private and draft content is never included.
import readline from 'node:readline/promises';
import { preparePublish, commitAndPush, pushPending } from './lib/publish-core.mjs';

console.log('Checking what can be published and building the site...');
const plan = preparePublish();
for (const s of plan.skipped ?? []) console.log(`  kept local (${s.why}): ${s.path}`);

if (!plan.files.length) {
  if (plan.ahead > 0) {
    console.log(`${plan.ahead} saved commit(s) have not been uploaded yet. Uploading...`);
    const r = pushPending();
    console.log(r.ok ? `Uploaded. Live in about a minute: ${r.site}` : r.problems.join('\n'));
    process.exit(r.ok ? 0 : 1);
  }
  console.log(plan.problems.join('\n'));
  process.exit(0);
}
if (!plan.ok) {
  console.log('\n' + plan.problems.join('\n'));
  process.exit(1);
}

const message = process.argv.slice(2).join(' ').trim() || plan.message;
console.log('\nFiles to publish:');
for (const f of plan.files) console.log(`  ${f}`);
console.log(`\nCommit message: ${message}`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question('\nPublish these to GitHub? [y/N] ')).trim().toLowerCase();
rl.close();
if (answer !== 'y' && answer !== 'yes') {
  console.log('Cancelled. Nothing was changed.');
  process.exit(0);
}

const result = commitAndPush(plan.files, message);
if (!result.ok) {
  console.log('\n' + result.problems.join('\n'));
  process.exit(1);
}
console.log(`\nPublished as ${result.commit}. Live in about a minute: ${result.site}`);
console.log(`Progress: ${result.actions}`);
