// Take the screenshots in shots.json from the real game (Node 22, standard library only): serves
// game/, opens each staged scene (?shot=...) in headless Chrome at 1280x720 and saves it as a JPEG
// under screenshots/ (macOS `sips` converts the PNG). Set CHROME to a Chrome or chrome-headless-shell
// binary:  CHROME=/path/to/chrome node tools/capture-shots.ts
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const chrome = process.env.CHROME;
if (!chrome) throw new Error('Set CHROME to a Chrome or chrome-headless-shell binary.');
const port = 8137 + Math.floor(Math.random() * 500);
const shots: { name: string; query: string }[] = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'wickwatch-shots-'));

const server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(port)], { stdio: 'ignore' });
await new Promise((done) => setTimeout(done, 800));
try {
  for (const shot of shots) {
    const png = join(scratch, shot.name.replace(/\.jpe?g$/, '.png'));
    execFileSync(chrome, [
      '--headless', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,720', '--force-device-scale-factor=1',
      '--virtual-time-budget=5000', `--screenshot=${png}`, `http://localhost:${port}/${shot.query}`,
    ], { stdio: 'ignore' });
    const out = join(root, 'screenshots', shot.name);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out', out], { stdio: 'ignore' });
    console.log(`${shot.name}: ${statSync(out).size} bytes`);
  }
} finally {
  server.kill();
}
