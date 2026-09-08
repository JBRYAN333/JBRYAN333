import fs from 'node:fs';
import path from 'node:path';

const OWNER = process.env.GITHUB_REPOSITORY_OWNER || 'JBRYAN333';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const BASE = 'https://api.github.com';
const SAFE_DELAY_MS = 200;

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'soul-counter-forge',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (TOKEN) HEADERS.Authorization = `Bearer ${TOKEN}`;

const LANG_SHORT = {
  Python: 'Py', JavaScript: 'JS', TypeScript: 'TS', HTML: 'HTML', CSS: 'CSS',
  Shell: 'SH', 'C#': 'C#', 'C++': 'C++', Java: 'Java', Go: 'Go', Rust: 'Rust',
  PHP: 'PHP', C: 'C', Kotlin: 'K', Swift: 'Swift', Ruby: 'Rb', PowerShell: 'PS',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gh(pathname) {
  const res = await fetch(BASE + pathname, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`GET ${pathname} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const templatePath = process.argv[2] || 'stats/soul-counter.template.svg';
  const outPath = process.argv[3] || 'soul-counter.svg';

  const user = await gh(`/users/${OWNER}`);
  let repos = [];
  try {
    repos = await gh(`/users/${OWNER}/repos?per_page=100`);
  } catch (e) {
    console.warn(`repos list failed: ${e.message}`);
  }

  const count = user.public_repos ?? repos.length;
  const followers = user.followers ?? 0;
  const souls = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0);

  const langs = {};
  for (const r of repos) {
    if (r.fork) continue;
    const ls = await gh(`/repos/${r.full_name}/languages`).catch(() => ({}));
    for (const [l, b] of Object.entries(ls)) langs[l] = (langs[l] || 0) + b;
    await sleep(SAFE_DELAY_MS);
  }
  const top = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([l]) => LANG_SHORT[l] || (l.length > 8 ? l.slice(0, 8) : l));
  const langStr = top.join(' · ');

  console.log(JSON.stringify({ repos: count, followers, souls, languages: langStr }));

  let svg = fs.readFileSync(templatePath, 'utf8');
  for (const [token, value] of [['{{REPOS}}', count], ['{{FOLLOWERS}}', followers], ['{{SOULS}}', souls], ['{{LANGS}}', langStr]]) {
    svg = svg.split(token).join(String(value));
  }
  fs.writeFileSync(outPath, svg);
  console.log(`wrote ${path.resolve(outPath)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});