const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const outputPath = process.argv[2] || path.join(process.cwd(), 'release-metadata.json');

const runGit = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const normalizeSha = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || /^0+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const currentSha = normalizeSha(runGit(['rev-parse', 'HEAD']));
const previousSha = normalizeSha(process.env.PREVIOUS_RELEASE_SHA) || normalizeSha(runGit(['rev-parse', 'HEAD^']));
const rawLog = previousSha
  ? runGit(['log', '--format=%H\t%s', `${previousSha}..HEAD`])
  : runGit(['log', '--format=%H\t%s', '-n', '8']);

const commits = rawLog
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [sha, subject] = line.split('\t');
    return sha && subject ? { sha, subject } : null;
  })
  .filter(Boolean);

const metadata = {
  currentSha,
  previousSha,
  commits,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
