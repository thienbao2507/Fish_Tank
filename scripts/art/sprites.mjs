import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..', '..');
const recipeDir = join(scriptDir, 'pixelbolt');
const outputDir = join(projectRoot, 'public', 'art', 'gen');
const previewDir = join(projectRoot, '.ai-flow');
const pixelboltCli = join(projectRoot, 'node_modules', 'pixelbolt', 'bin', 'pixelbolt.js');

function runPixelbolt(args) {
  const result = spawnSync(process.execPath, [pixelboltCli, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'Pixelbolt chạy thất bại');
  }

  return result.stdout.trim();
}

const recipes = readdirSync(recipeDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name)
  .sort();

if (recipes.length === 0) {
  throw new Error(`Không tìm thấy recipe Pixelbolt trong ${recipeDir}`);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

const tempRoot = mkdtempSync(join(tmpdir(), 'fishtank-sprites-'));
try {
  for (const recipeFile of recipes) {
    const spriteName = basename(recipeFile, '.json');
    const recipePath = join(recipeDir, recipeFile);
    const renderDir = join(tempRoot, spriteName);
    const renderOutput = runPixelbolt(['render', recipePath, '--out', renderDir]);
    const renderResult = JSON.parse(renderOutput);
    const sheetFile = renderResult.files.find(
      (file) => basename(file) === file && file.toLowerCase().endsWith('.png'),
    );

    if (!sheetFile) {
      throw new Error(`Pixelbolt không trả về sheet PNG cho ${recipeFile}`);
    }

    const pngTarget = join(outputDir, `${spriteName}.png`);
    const gifTarget = join(previewDir, `${spriteName}.gif`);
    copyFileSync(join(renderDir, sheetFile), pngTarget);
    runPixelbolt(['gif', recipePath, '--out', gifTarget, '--scale', '6', '--force']);
    console.log(`Đã sinh ${pngTarget} và ${gifTarget}`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
