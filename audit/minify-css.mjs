/**
 * Minify a stylesheet. Called by bundle.py.
 *
 *     node audit/minify-css.mjs <in.css> <out.css>
 *
 * clean-css at level 1 only: it collapses whitespace, drops comments and
 * shortens values. Level 2 reorders and merges rules, which is not safe here —
 * the cascade deliberately re-declares `.poster` twice and relies on source
 * order for the gradient override.
 */
import CleanCSS from 'clean-css';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output] = process.argv;
const css = readFileSync(input, 'utf8');
const out = new CleanCSS({ level: 1, rebase: false }).minify(css);

if (out.errors.length) {
  console.error(out.errors.join('\n'));
  process.exit(1);
}
writeFileSync(output, out.styles, 'utf8');
process.stdout.write(String(out.styles.length));
