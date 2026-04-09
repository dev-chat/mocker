const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const SERVICE_LIKE_PATTERNS = [/\.service\.ts$/, /\.controller\.ts$/, /\/middleware\/.+\.ts$/];

const EXCLUDE_PATTERNS = [/\.spec\.ts$/, /\/test\//, /\/constants\.ts$/];

const rel = (filePath) => path.relative(ROOT, filePath).split(path.sep).join('/');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function isServiceLike(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  const included = SERVICE_LIKE_PATTERNS.some((pattern) => pattern.test(normalized));
  const excluded = EXCLUDE_PATTERNS.some((pattern) => pattern.test(normalized));
  return included && !excluded;
}

function getServiceCoverageInventory() {
  const allFiles = walk(SRC_DIR);
  const serviceFiles = allFiles.filter(isServiceLike);

  const withSpecs = serviceFiles
    .filter((file) => fs.existsSync(file.replace(/\.ts$/, '.spec.ts')))
    .map(rel)
    .sort();
  const withoutSpecs = serviceFiles
    .filter((file) => !fs.existsSync(file.replace(/\.ts$/, '.spec.ts')))
    .map(rel)
    .sort();

  return {
    all: serviceFiles.map(rel).sort(),
    withSpecs,
    withoutSpecs,
  };
}

function runVitestCoverage(collectCoverageFrom) {
  const args = ['vitest', 'run', '--silent', '--coverage'];
  for (const file of collectCoverageFrom) {
    args.push(`--coverage.include=${file}`);
  }

  const result = spawnSync('npx', args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  return result.status ?? 1;
}

function main() {
  const inventory = getServiceCoverageInventory();

  const coverageTargets = inventory.all;

  if (coverageTargets.length === 0) {
    console.error('Coverage gate failed: no service-like files found for coverage enforcement.');
    process.exit(1);
  }

  if (inventory.withoutSpecs.length > 0) {
    console.log(
      `Found ${inventory.withoutSpecs.length} service-like files without local specs; they are included in coverage enforcement.`,
    );
  }
  console.log(`Running coverage for ${coverageTargets.length} service-like files...`);
  const exitCode = runVitestCoverage(coverageTargets);
  process.exit(exitCode);
}

main();
