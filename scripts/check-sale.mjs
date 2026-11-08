// Release guard: inspect the actual deliverable, not just the source configuration.
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkSale(dist = 'dist-sale') {
  const forbidden = [
    'آروین', 'فائقه', 'فائقم', 'khooneye-man', 'cats/ani.jpg', 'cats/pastil.jpg',
    'our-home-v10', 'سالگردمون مبارک', 'خوشگلترین پرنسس دنیا',
  ];
  const problems = [];
  let files = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { await walk(path); continue; }
      files++;
      const rel = relative(dist, path).replaceAll('\\', '/');
      if (rel.startsWith('memories/') || rel.startsWith('music/') || rel.startsWith('cats/')) {
        problems.push(`Personal asset directory: ${rel}`);
      }
      if (!['.html', '.js', '.css', '.json', '.txt', '.md'].includes(extname(path))) continue;
      const text = await readFile(path, 'utf8');
      for (const word of forbidden) if (text.includes(word)) problems.push(`${rel}: ${word}`);
      if (/(?:^|["'`(=])\.?\.?\/?memories\//.test(text)) problems.push(`${rel}: personal gallery URL`);
    }
  }
  await walk(dist);
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  if (!html.includes('خانه‌ی مهر')) problems.push('Missing sale branding');
  if (!html.includes('تولیدشده با هوش مصنوعی')) problems.push('Missing AI/fiction disclosure');
  if (files < 35) problems.push('Incomplete release');
  if (problems.length) throw new Error(`Sale privacy check failed:\n${problems.join('\n')}`);
  console.log(`Privacy check passed: ${files} files; no personal names, recordings, portraits or gallery URLs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkSale(process.argv[2] || 'dist-sale');
}
