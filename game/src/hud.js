// The HUD and the screens around play: the title, the boon choice at the end of each night, the
// pause card and the results of a watch. All drawn on the playfield's 1280x720 coordinates.
import { FLARE, NIGHTS, VIEW } from './config.js';
import { boonById } from './boons.js';
import { ENEMY_KINDS } from './enemies.js';
import { comboMultiplier, END_DAWN, END_LANTERN } from './world.js';
import { drawIcon } from './icons.js';

const SANS = '"Trebuchet MS", Verdana, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const GOLD = '#ffcf7a';
const PALE = '#e8e2d4';
const DIM = 'rgba(232, 226, 212, 0.62)';

/** Where the boon cards sit on the choice screen, for drawing and for clicks. */
export function boonCardRects(count) {
  const width = 300;
  const height = 270;
  const gap = 36;
  const left = (VIEW.width - (width * count + gap * (count - 1))) / 2;
  return Array.from({ length: count }, (_, index) => ({ x: left + index * (width + gap), y: 268, width, height }));
}

function panel(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function text(ctx, value, x, y, size, color, align = 'left', font = SANS, weight = 'bold') {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function wrap(ctx, value, x, y, width, lineHeight) {
  const words = value.split(' ');
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function bar(ctx, x, y, width, height, share, from, to) {
  panel(ctx, x, y, width, height, height / 2, 'rgba(10, 12, 24, 0.75)', 'rgba(255, 220, 160, 0.35)');
  if (share <= 0) return;
  const fill = ctx.createLinearGradient(x, 0, x + width, 0);
  fill.addColorStop(0, from);
  fill.addColorStop(1, to);
  panel(ctx, x + 2, y + 2, Math.max(height - 4, (width - 4) * Math.min(1, share)), height - 4, (height - 4) / 2, fill);
}

function formatScore(value) {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * The watch log: one medallion a night, left to right. A kept night is a flame as bright as the light
 * the lantern still held at its dawn-break, a lost night a red cross, a night to come an empty ring;
 * `next` rings the night about to begin.
 */
function drawWatchLog(ctx, state, centerX, y, spacing, size, next = 0) {
  const left = centerX - ((NIGHTS - 1) * spacing) / 2;
  for (let night = 1; night <= NIGHTS; night += 1) {
    const x = left + (night - 1) * spacing;
    const entry = state.log.find((item) => item.night === night);
    ctx.beginPath();
    ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 12, 28, 0.85)';
    ctx.fill();
    ctx.lineWidth = night === next ? 2.5 : 1.5;
    ctx.strokeStyle = night === next ? GOLD : entry ? 'rgba(255, 207, 122, 0.55)' : 'rgba(255, 255, 255, 0.18)';
    ctx.stroke();
    if (entry && entry.kept) {
      drawIcon(ctx, 'flame', x, y, size * 0.7, `rgba(255, ${150 + Math.round(entry.light * 80)}, ${70 + Math.round(entry.light * 60)}, ${0.45 + entry.light * 0.55})`);
    } else if (entry) {
      ctx.strokeStyle = '#ff6a6a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.25, y - size * 0.25);
      ctx.lineTo(x + size * 0.25, y + size * 0.25);
      ctx.moveTo(x + size * 0.25, y - size * 0.25);
      ctx.lineTo(x - size * 0.25, y + size * 0.25);
      ctx.stroke();
    } else {
      text(ctx, `${night}`, x, y + size * 0.18, Math.round(size * 0.42), night === next ? GOLD : 'rgba(255, 255, 255, 0.35)', 'center');
    }
  }
}

/** The in-play HUD: lantern light, the Wick's hearts, the night, score and combo, flare and boons. */
export function drawHud(ctx, state, ui) {
  const top = ctx.createLinearGradient(0, 0, 0, 92);
  top.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  top.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, VIEW.width, 92);
  const lantern = state.lantern;
  drawIcon(ctx, 'flame', 30, 30, 24, GOLD);
  text(ctx, 'LANTERN', 50, 24, 13, DIM);
  bar(ctx, 50, 30, 250, 16, lantern.light / lantern.maxLight, '#ff7a2a', '#ffe08a');
  text(ctx, `${Math.ceil(lantern.light)}`, 310, 44, 16, lantern.light < 30 ? '#ff7060' : PALE);
  const player = state.player;
  for (let index = 0; index < player.maxHp; index += 1) {
    drawIcon(ctx, 'heart', 60 + index * 26, 68, 18, index < player.hp ? '#ff6a4a' : 'rgba(255, 255, 255, 0.18)');
  }
  text(ctx, 'WICK', 50 + player.maxHp * 26 + 22, 74, 12, DIM);
  text(ctx, `NIGHT ${state.night} / ${NIGHTS}`, VIEW.width / 2, 32, 24, GOLD, 'center', SERIF);
  const left = Math.max(0, state.nightTotal - state.nightBanished);
  bar(ctx, VIEW.width / 2 - 130, 42, 260, 8, state.nightTotal ? state.nightBanished / state.nightTotal : 0, '#6a5acd', '#c9a6ff');
  text(ctx, `${left} shade${left === 1 ? '' : 's'} left tonight`, VIEW.width / 2, 68, 13, DIM, 'center');
  if (state.omen !== null) text(ctx, `◆ ${state.omen.name}`, VIEW.width / 2, 90, 15, `hsl(${state.omen.hue}, 90%, 72%)`, 'center');
  text(ctx, formatScore(state.score), VIEW.width - 28, 38, 30, PALE, 'right');
  text(ctx, `BEST ${formatScore(Math.max(ui.best, state.score))}`, VIEW.width - 28, 58, 12, DIM, 'right');
  if (state.combo > 1) {
    const multiplier = comboMultiplier(state.combo);
    text(ctx, `COMBO ${state.combo}  ×${multiplier.toFixed(1)}`, VIEW.width - 28, 80, 15, multiplier > 1 ? '#ffb347' : PALE, 'right');
  }
  if (state.boss !== null) {
    const boss = state.boss;
    text(ctx, boss.final ? 'THE GLOAM, UNBOUND' : 'THE GLOAM', VIEW.width / 2, 98, 14, '#ff8aa0', 'center', SERIF);
    bar(ctx, VIEW.width / 2 - 260, 104, 520, 12, boss.hp / boss.maxHp, '#7a1030', '#ff4a6a');
  }
  const cost = FLARE.cost * state.mods.flareCost;
  const ready = state.flare >= cost;
  const pulse = ready ? 0.6 + 0.4 * Math.sin(ui.clock * 6) : 1;
  drawIcon(ctx, 'burst', 34, VIEW.height - 34, 26, ready ? `rgba(255, 220, 140, ${pulse})` : 'rgba(255, 220, 140, 0.5)');
  text(ctx, ready ? 'FLARE READY — RIGHT-CLICK / E' : 'FLARE', 56, VIEW.height - 44, 13, ready ? GOLD : DIM);
  bar(ctx, 56, VIEW.height - 36, 200, 10, state.flare / cost, '#ff9a3a', '#fff0b0');
  const counts = new Map();
  for (const id of state.boons) counts.set(id, (counts.get(id) ?? 0) + 1);
  let x = VIEW.width - 30;
  for (const [id, count] of [...counts].reverse()) {
    const boon = boonById(id);
    panel(ctx, x - 34, VIEW.height - 52, 34, 34, 8, 'rgba(20, 18, 34, 0.75)', 'rgba(255, 207, 122, 0.45)');
    drawIcon(ctx, boon.icon, x - 17, VIEW.height - 35, 20, GOLD);
    if (count > 1) text(ctx, `${count}`, x - 4, VIEW.height - 21, 11, PALE, 'right');
    x -= 40;
  }
  if (state.banner !== null && ui.screen === 'play') {
    const fade = Math.min(1, state.banner.time, 3 - state.banner.time + 0.4);
    ctx.globalAlpha = Math.max(0, fade);
    text(ctx, state.banner.text, VIEW.width / 2, 250, 56, GOLD, 'center', SERIF);
    text(ctx, state.banner.sub, VIEW.width / 2, 286, 18, PALE, 'center', SANS, 'normal');
    ctx.globalAlpha = 1;
  }
  if (ui.mouse && ui.screen === 'play') {
    ctx.strokeStyle = 'rgba(255, 230, 180, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ui.mouse.x, ui.mouse.y, 9, 0, Math.PI * 2);
    ctx.moveTo(ui.mouse.x - 15, ui.mouse.y);
    ctx.lineTo(ui.mouse.x - 5, ui.mouse.y);
    ctx.moveTo(ui.mouse.x + 5, ui.mouse.y);
    ctx.lineTo(ui.mouse.x + 15, ui.mouse.y);
    ctx.moveTo(ui.mouse.x, ui.mouse.y - 15);
    ctx.lineTo(ui.mouse.x, ui.mouse.y - 5);
    ctx.moveTo(ui.mouse.x, ui.mouse.y + 5);
    ctx.lineTo(ui.mouse.x, ui.mouse.y + 15);
    ctx.stroke();
  }
  if (ui.muted) text(ctx, 'SOUND OFF (M)', VIEW.width / 2, VIEW.height - 16, 12, DIM, 'center');
}

function veil(ctx, alpha) {
  ctx.fillStyle = `rgba(3, 4, 14, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawLogo(ctx, y, size) {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 160, 60, 0.85)';
  ctx.shadowBlur = 34;
  const fill = ctx.createLinearGradient(0, y - size, 0, y);
  fill.addColorStop(0, '#fff1c4');
  fill.addColorStop(1, '#ff9a3a');
  ctx.font = `bold ${size}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = fill;
  ctx.fillText('WICKWATCH', VIEW.width / 2, y);
  ctx.restore();
}

function drawTitle(ctx, state, ui) {
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  shade.addColorStop(0, 'rgba(3, 4, 14, 0.62)');
  shade.addColorStop(0.32, 'rgba(3, 4, 14, 0.05)');
  shade.addColorStop(0.62, 'rgba(3, 4, 14, 0.05)');
  shade.addColorStop(1, 'rgba(3, 4, 14, 0.7)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawLogo(ctx, 150, 104);
  text(ctx, 'Keep the last lantern lit through ten nights of the Murk.', VIEW.width / 2, 194, 22, PALE, 'center', SERIF, 'italic');
  panel(ctx, 240, 478, 800, 168, 18, 'rgba(8, 10, 24, 0.8)', 'rgba(255, 207, 122, 0.4)');
  const controls = [
    ['WASD / Arrows', 'move the Wick'],
    ['Mouse', 'aim'],
    ['Left click (hold)', 'shoot sparks'],
    ['Space / Shift', 'dash: burns what it passes'],
    ['Right click / E', 'flare when charged'],
    ['P / Esc · M', 'pause · sound'],
  ];
  controls.forEach(([key, does], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 276 + column * 380;
    const y = 512 + row * 30;
    text(ctx, key, x, y, 16, GOLD);
    text(ctx, does, x + 156, y, 15, PALE, 'left', SANS, 'normal');
  });
  text(ctx, 'Embers charge your flare  ·  a boon at every dawn-break  ·  two Gloams rise', VIEW.width / 2, 604, 14, DIM, 'center', SANS, 'normal');
  const kinds = Object.values(ENEMY_KINDS).map((kind) => kind.name).join('  ·  ');
  text(ctx, `The Murk: ${kinds}`, VIEW.width / 2, 628, 14, 'rgba(200, 170, 255, 0.9)', 'center');
  const pulse = 0.55 + 0.45 * Math.sin(ui.clock * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, 'Click or press Enter to light the lantern', VIEW.width / 2, 684, 24, GOLD, 'center', SERIF);
  ctx.globalAlpha = 1;
  if (ui.best > 0) text(ctx, `Best watch: ${formatScore(ui.best)}`, VIEW.width / 2, 708, 14, DIM, 'center');
}

function drawBoonChoice(ctx, state, ui) {
  veil(ctx, 0.55);
  drawWatchLog(ctx, state, VIEW.width / 2, 42, 46, 30, state.night + 1);
  text(ctx, `NIGHT ${state.night} SURVIVED`, VIEW.width / 2, 132, 52, GOLD, 'center', SERIF);
  text(ctx, `+${formatScore(state.clearBonus ?? 0)} dawn-break bonus  ·  score ${formatScore(state.score)}  ·  lantern ${Math.ceil(state.lantern.light)}`, VIEW.width / 2, 170, 18, PALE, 'center', SANS, 'normal');
  text(ctx, 'Choose a boon for the night ahead', VIEW.width / 2, 228, 24, PALE, 'center', SERIF, 'italic');
  const rects = boonCardRects(state.offer.length);
  state.offer.forEach((boon, index) => {
    const rect = rects[index];
    const hover = ui.hover === index;
    const owned = state.boons.filter((id) => id === boon.id).length;
    const accent = boon.rare ? '#c9a6ff' : GOLD;
    const glow = boon.rare ? '190, 150, 255' : '255, 190, 90';
    ctx.save();
    if (hover || boon.rare) {
      ctx.shadowColor = `rgba(${glow}, ${hover ? 0.85 : 0.5})`;
      ctx.shadowBlur = hover ? 28 : 16;
    }
    panel(ctx, rect.x, rect.y - (hover ? 8 : 0), rect.width, rect.height, 20, hover ? 'rgba(40, 30, 54, 0.95)' : boon.rare ? 'rgba(30, 20, 48, 0.94)' : 'rgba(18, 16, 34, 0.92)', hover ? accent : `rgba(${glow}, 0.55)`);
    ctx.restore();
    const y = rect.y - (hover ? 8 : 0);
    const halo = ctx.createRadialGradient(rect.x + rect.width / 2, y + 74, 4, rect.x + rect.width / 2, y + 74, 56);
    halo.addColorStop(0, `rgba(${glow}, 0.4)`);
    halo.addColorStop(1, `rgba(${glow}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(rect.x, y + 14, rect.width, 120);
    drawIcon(ctx, boon.icon, rect.x + rect.width / 2, y + 74, 56, accent);
    if (boon.rare) text(ctx, 'RARE', rect.x + rect.width - 20, y + 30, 13, accent, 'right');
    text(ctx, boon.name, rect.x + rect.width / 2, y + 150, 26, PALE, 'center', SERIF);
    ctx.font = `normal 17px ${SANS}`;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    wrap(ctx, boon.text, rect.x + rect.width / 2, y + 184, rect.width - 44, 22);
    text(ctx, owned > 0 ? `owned ×${owned}` : 'new', rect.x + 20, y + rect.height - 18, 13, owned > 0 ? '#b9a6ff' : '#8fe0a0');
    text(ctx, `press ${index + 1}`, rect.x + rect.width - 20, y + rect.height - 18, 13, accent, 'right');
  });
  const omen = state.nextOmen;
  const omenColor = omen ? `hsl(${omen.hue}, 90%, 72%)` : '#ff8aa0';
  panel(ctx, 240, 566, 800, 74, 16, 'rgba(10, 10, 26, 0.85)', omen ? `hsla(${omen.hue}, 80%, 65%, 0.6)` : 'rgba(255, 110, 130, 0.6)');
  text(ctx, omen ? 'TOMORROW\'S OMEN' : 'TOMORROW', 270, 594, 13, DIM);
  text(ctx, omen ? omen.name : state.night + 1 === NIGHTS ? 'The Gloam, Unbound' : 'The Gloam rises', 270, 622, 22, omenColor, 'left', SERIF);
  ctx.font = `normal 16px ${SANS}`;
  ctx.fillStyle = PALE;
  ctx.textAlign = 'left';
  wrap(ctx, omen ? omen.text : 'A blood moon and no omen: only the Gloam and its brood.', 520, 598, 500, 21);
  text(ctx, 'Click a card or press 1 · 2 · 3', VIEW.width / 2, 676, 16, DIM, 'center');
}

function drawPause(ctx) {
  veil(ctx, 0.55);
  text(ctx, 'PAUSED', VIEW.width / 2, 330, 64, GOLD, 'center', SERIF);
  text(ctx, 'P or Esc to resume  ·  R to start over  ·  M sound', VIEW.width / 2, 380, 18, PALE, 'center', SANS, 'normal');
}

function drawResults(ctx, state, ui) {
  veil(ctx, 0.7);
  const dawn = state.over === END_DAWN;
  if (dawn) {
    const sunrise = ctx.createLinearGradient(0, VIEW.height, 0, 0);
    sunrise.addColorStop(0, 'rgba(255, 150, 80, 0.45)');
    sunrise.addColorStop(0.6, 'rgba(255, 120, 120, 0.08)');
    sunrise.addColorStop(1, 'rgba(255, 120, 120, 0)');
    ctx.fillStyle = sunrise;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  const title = dawn ? 'DAWN BREAKS' : state.over === END_LANTERN ? 'THE LANTERN WENT OUT' : 'THE WICK WAS SNUFFED';
  const line = dawn
    ? 'The lantern held through all ten nights. The Murk sinks back into the sea.'
    : state.over === END_LANTERN
      ? `The dark took the sea on night ${state.night}. Guard the light closer next time.`
      : `The Wick guttered on night ${state.night}. Dash through danger, not into it.`;
  text(ctx, title, VIEW.width / 2, 120, 60, dawn ? '#ffe2a0' : '#ff9a8a', 'center', SERIF);
  text(ctx, line, VIEW.width / 2, 160, 19, PALE, 'center', SERIF, 'italic');
  panel(ctx, 320, 188, 640, 420, 22, 'rgba(10, 10, 26, 0.88)', 'rgba(255, 207, 122, 0.45)');
  text(ctx, 'SCORE', VIEW.width / 2, 226, 16, DIM, 'center');
  text(ctx, formatScore(state.score), VIEW.width / 2, 282, 58, GOLD, 'center', SERIF);
  if (ui.newBest) text(ctx, '★ NEW BEST ★', VIEW.width / 2, 310, 16, '#8fe0a0', 'center');
  else text(ctx, `best ${formatScore(ui.best)}`, VIEW.width / 2, 310, 14, DIM, 'center');
  const rows = [
    ['Nights survived', `${dawn ? NIGHTS : state.night - 1} / ${NIGHTS}`],
    ['Shades banished', `${state.kills}`],
    ['Best combo', `${state.bestCombo}`],
    ['Embers gathered', `${state.embersTaken}`],
  ];
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 370 + column * 300;
    const y = 352 + row * 40;
    text(ctx, label, x, y, 15, DIM, 'left', SANS, 'normal');
    text(ctx, value, x + 240, y, 20, PALE, 'right');
  });
  text(ctx, 'Boons', 370, 444, 15, DIM, 'left', SANS, 'normal');
  state.boons.forEach((id, index) => {
    const boon = boonById(id);
    drawIcon(ctx, boon.icon, 450 + index * 36, 438, 22, boon.rare ? '#c9a6ff' : GOLD);
  });
  if (state.boons.length === 0) text(ctx, 'none yet', 450, 444, 15, DIM, 'left', SANS, 'normal');
  text(ctx, 'THE WATCH', VIEW.width / 2, 492, 13, DIM, 'center');
  drawWatchLog(ctx, state, VIEW.width / 2, 532, 56, 38);
  text(ctx, 'each flame burns as bright as the light the lantern kept at that dawn-break', VIEW.width / 2, 584, 13, DIM, 'center', SANS, 'normal');
  const pulse = 0.55 + 0.45 * Math.sin(ui.clock * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, 'Click or press Enter to light it again', VIEW.width / 2, 652, 26, GOLD, 'center', SERIF);
  ctx.globalAlpha = 1;
  text(ctx, 'Esc for the title', VIEW.width / 2, 682, 14, DIM, 'center');
}

/** Whatever screen is up over the playfield (none during play). */
export function drawScreen(ctx, state, ui) {
  if (ui.screen === 'title') drawTitle(ctx, state, ui);
  else if (ui.screen === 'boon') drawBoonChoice(ctx, state, ui);
  else if (ui.screen === 'paused') drawPause(ctx);
  else if (ui.screen === 'over') drawResults(ctx, state, ui);
}
