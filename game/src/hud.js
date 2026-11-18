// The HUD and the screens around play: the title, the boon choice at the end of each night, the
// pause card and the results of a watch. All drawn on the playfield's 1280x720 coordinates.
import { DIFFICULTIES, FLARE, NIGHTS, VIEW } from './config.js';
import { BOONS, boonById } from './boons.js';
import { ENEMY_KINDS } from './enemies.js';
import { OMENS } from './omens.js';
import { PALETTES, paletteFor } from './palettes.js';
import { comboMultiplier, END_DAWN, END_LANTERN } from './world.js';
import { watchFeats, watchGrade } from './feats.js';
import { drawIcon } from './icons.js';

const SANS = '"Trebuchet MS", Verdana, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const GOLD = '#ffcf7a';
const PALE = '#e8e2d4';
const DIM = 'rgba(232, 226, 212, 0.62)';

/** Where the boon cards sit on the dawn-break screen, for drawing and for clicks. */
export function boonCardRects(count) {
  const width = 236;
  const gap = 16;
  return Array.from({ length: count }, (_, index) => ({ x: 40 + index * (width + gap), y: 222, width, height: 280 }));
}

/** Where the three watch (difficulty) chips sit on the title, for drawing and for clicks. */
export function difficultyChipRects() {
  return DIFFICULTIES.map((_, index) => ({ x: 340 + index * 228, y: 572, width: 220, height: 40 }));
}

/** Where the two tide cards sit, beside the boons, for drawing and for clicks. */
export function tideCardRects(count) {
  return Array.from({ length: count }, (_, index) => ({ x: 812, y: 222 + index * 144, width: 428, height: 132 }));
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

/** The stakes, always in sight: how the watch is won and how it is lost. */
function drawStakes(ctx, x, y) {
  const rows = [
    ['WIN', 'keep the lantern lit through 10 nights', '#5fd38a'],
    ['LOSE', 'lantern light hits 0, or the Wick loses every heart', '#ff6a6a'],
  ];
  rows.forEach(([tag, what, color], index) => {
    const top = y + index * 26;
    panel(ctx, x, top, 330, 22, 6, 'rgba(8, 8, 20, 0.72)');
    panel(ctx, x, top, 48, 22, 6, color);
    text(ctx, tag, x + 24, top + 16, 12, '#0b0b16', 'center');
    text(ctx, what, x + 56, top + 16, 12, PALE, 'left', SANS, 'normal');
  });
}

/** Every boon taken this watch, by name, with how many times it is stacked. */
function drawBoonList(ctx, state, x, y) {
  const counts = new Map();
  for (const id of state.boons) counts.set(id, (counts.get(id) ?? 0) + 1);
  const height = 34 + Math.max(1, counts.size) * 22;
  panel(ctx, x, y, 230, height, 10, 'rgba(8, 8, 20, 0.72)', 'rgba(255, 207, 122, 0.3)');
  text(ctx, `BOONS ${state.boons.length}`, x + 12, y + 21, 12, GOLD);
  text(ctx, `of ${BOONS.length} kinds`, x + 218, y + 21, 11, DIM, 'right', SANS, 'normal');
  if (counts.size === 0) text(ctx, 'one at every dawn-break', x + 12, y + 46, 12, DIM, 'left', SANS, 'normal');
  [...counts].forEach(([id, count], index) => {
    const boon = boonById(id);
    const row = y + 46 + index * 22;
    const color = boon.rare ? '#c9a6ff' : GOLD;
    drawIcon(ctx, boon.icon, x + 20, row - 5, 15, color);
    text(ctx, boon.name, x + 36, row, 13, boon.rare ? color : PALE, 'left', SANS, 'normal');
    if (count > 1) text(ctx, `×${count}`, x + 218, row, 12, color, 'right');
  });
}

/** The controls, as key caps along the bottom edge. */
function drawControls(ctx, y) {
  const keys = [['WASD', 'move'], ['LMB', 'sparks'], ['SPACE', 'dash'], ['RMB / E', 'flare'], ['P', 'pause'], ['M', 'sound']];
  ctx.font = `bold 12px ${SANS}`;
  const widths = keys.map(([key, does]) => {
    ctx.font = `bold 12px ${SANS}`;
    const cap = ctx.measureText(key).width + 14;
    ctx.font = `normal 12px ${SANS}`;
    return { cap, total: cap + 6 + ctx.measureText(does).width + 16 };
  });
  let x = (VIEW.width - widths.reduce((sum, item) => sum + item.total, 0)) / 2;
  keys.forEach(([key, does], index) => {
    panel(ctx, x, y - 15, widths[index].cap, 20, 5, 'rgba(255, 230, 190, 0.92)');
    text(ctx, key, x + widths[index].cap / 2, y - 1, 12, '#1a1424', 'center');
    text(ctx, does, x + widths[index].cap + 6, y - 1, 12, PALE, 'left', SANS, 'normal');
    x += widths[index].total;
  });
}

/** The in-play HUD: lantern light, the Wick's hearts, the stakes, the night, score and combo, flare, boons and controls. */
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
  drawStakes(ctx, 20, 92);
  drawBoonList(ctx, state, 20, 152);
  drawControls(ctx, VIEW.height - 14);
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
  if (ui.muted) text(ctx, 'SOUND OFF (M)', VIEW.width / 2, VIEW.height - 40, 12, DIM, 'center');
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
  const kindCount = Object.keys(ENEMY_KINDS).length;
  const counts = `${NIGHTS} NIGHTS  ·  ${kindCount} KINDS OF MURK  ·  2 GLOAMS  ·  ${BOONS.length} BOONS  ·  ${OMENS.length} TIDES  ·  ${PALETTES.length + 1} SEAS`;
  text(ctx, counts, VIEW.width / 2, 232, 16, '#ffd98f', 'center');
  panel(ctx, 240, 456, 800, 196, 18, 'rgba(8, 10, 24, 0.82)', 'rgba(255, 207, 122, 0.4)');
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
    const y = 486 + row * 27;
    text(ctx, key, x, y, 15, GOLD);
    text(ctx, does, x + 156, y, 14, PALE, 'left', SANS, 'normal');
  });
  text(ctx, 'WATCH', 276, 592, 13, DIM);
  difficultyChipRects().forEach((rect, index) => {
    const level = DIFFICULTIES[index];
    const chosen = ui.difficulty === index;
    panel(ctx, rect.x, rect.y, rect.width, rect.height, 9, chosen ? 'rgba(70, 48, 20, 0.95)' : 'rgba(20, 18, 34, 0.9)', chosen ? GOLD : 'rgba(255, 255, 255, 0.18)');
    panel(ctx, rect.x + 8, rect.y + 9, 20, 20, 5, chosen ? GOLD : 'rgba(255, 230, 190, 0.6)');
    text(ctx, `${index + 1}`, rect.x + 18, rect.y + 24, 12, '#1a1424', 'center');
    text(ctx, level.name, rect.x + 36, rect.y + 18, 14, chosen ? GOLD : PALE);
    text(ctx, level.text, rect.x + 36, rect.y + 33, 11, DIM, 'left', SANS, 'normal');
  });
  const kinds = Object.values(ENEMY_KINDS).map((kind) => kind.name).join('  ·  ');
  text(ctx, `The Murk: ${kinds}`, VIEW.width / 2, 634, 14, 'rgba(200, 170, 255, 0.9)', 'center');
  const pulse = 0.55 + 0.45 * Math.sin(ui.clock * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, 'Click or press Enter to light the lantern', VIEW.width / 2, 684, 24, GOLD, 'center', SERIF);
  ctx.globalAlpha = 1;
  if (ui.best > 0) text(ctx, `Best watch: ${formatScore(ui.best)}`, VIEW.width / 2, 708, 14, DIM, 'center');
}

function riskDots(ctx, risk, x, y, color) {
  for (let index = 0; index < 3; index += 1) {
    ctx.beginPath();
    ctx.arc(x + index * 14, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = index < risk ? color : 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
  }
}

function drawTideChoice(ctx, state) {
  text(ctx, '2 · CHOOSE TOMORROW\'S TIDE', 812, 206, 16, GOLD);
  text(ctx, 'Q · W', 1240, 206, 13, DIM, 'right');
  const rects = tideCardRects(state.omenOffer.length);
  if (rects.length === 0) {
    panel(ctx, 812, 222, 428, 276, 18, 'rgba(40, 8, 18, 0.9)', 'rgba(255, 110, 130, 0.7)');
    text(ctx, 'NO TIDE TO CHOOSE', 1026, 290, 14, DIM, 'center');
    text(ctx, state.night + 1 === NIGHTS ? 'The Gloam, Unbound' : 'The Gloam rises', 1026, 340, 32, '#ff8aa0', 'center', SERIF);
    text(ctx, 'A blood moon, and only the Gloam and its brood.', 1026, 382, 16, PALE, 'center', SANS, 'normal');
    text(ctx, 'Banish it to keep the night.', 1026, 408, 16, PALE, 'center', SANS, 'normal');
    return;
  }
  state.omenOffer.forEach((omen, index) => {
    const rect = rects[index];
    const chosen = state.nextOmen === omen;
    const color = `hsl(${omen.hue}, 90%, 70%)`;
    ctx.save();
    if (chosen) {
      ctx.shadowColor = `hsla(${omen.hue}, 90%, 60%, 0.7)`;
      ctx.shadowBlur = 22;
    }
    panel(ctx, rect.x, rect.y, rect.width, rect.height, 16, chosen ? 'rgba(34, 26, 50, 0.96)' : 'rgba(16, 14, 30, 0.9)', chosen ? color : 'rgba(255, 255, 255, 0.18)');
    ctx.restore();
    panel(ctx, rect.x + 14, rect.y + 14, 26, 24, 6, 'rgba(255, 230, 190, 0.92)');
    text(ctx, index === 0 ? 'Q' : 'W', rect.x + 27, rect.y + 31, 14, '#1a1424', 'center');
    text(ctx, omen.name, rect.x + 52, rect.y + 34, 22, color, 'left', SERIF);
    text(ctx, 'RISK', rect.x + rect.width - 68, rect.y + 31, 11, DIM, 'right');
    riskDots(ctx, omen.risk, rect.x + rect.width - 56, rect.y + 27, '#ff7a6a');
    ctx.font = `normal 15px ${SANS}`;
    ctx.fillStyle = PALE;
    ctx.textAlign = 'left';
    wrap(ctx, omen.text, rect.x + 18, rect.y + 64, rect.width - 36, 19);
    text(ctx, 'REWARD', rect.x + 18, rect.y + 116, 11, DIM);
    text(ctx, omen.reward, rect.x + 76, rect.y + 117, 14, '#8fe0a0');
    if (chosen) text(ctx, 'CHOSEN', rect.x + rect.width - 18, rect.y + 117, 12, color, 'right');
  });
}

function drawBoonChoice(ctx, state, ui) {
  veil(ctx, 0.58);
  drawWatchLog(ctx, state, VIEW.width / 2, 40, 46, 30, state.night + 1);
  text(ctx, `NIGHT ${state.night} SURVIVED`, VIEW.width / 2, 118, 48, GOLD, 'center', SERIF);
  text(ctx, `+${formatScore(state.clearBonus ?? 0)} dawn-break bonus  ·  score ${formatScore(state.score)}  ·  lantern ${Math.ceil(state.lantern.light)}`, VIEW.width / 2, 154, 17, PALE, 'center', SANS, 'normal');
  text(ctx, '1 · CHOOSE A BOON', 40, 206, 16, GOLD);
  text(ctx, '1 · 2 · 3', 780, 206, 13, DIM, 'right');
  drawTideChoice(ctx, state);
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
    drawIcon(ctx, boon.icon, rect.x + rect.width / 2, y + 72, 50, accent);
    if (boon.rare) text(ctx, 'RARE', rect.x + rect.width - 16, y + 28, 12, accent, 'right');
    text(ctx, boon.name, rect.x + rect.width / 2, y + 144, 22, PALE, 'center', SERIF);
    ctx.font = `normal 15px ${SANS}`;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    wrap(ctx, boon.text, rect.x + rect.width / 2, y + 176, rect.width - 36, 20);
    text(ctx, owned > 0 ? `owned ×${owned}` : 'new', rect.x + 16, y + rect.height - 16, 12, owned > 0 ? '#b9a6ff' : '#8fe0a0');
    panel(ctx, rect.x + rect.width - 40, y + rect.height - 34, 24, 22, 5, 'rgba(255, 230, 190, 0.92)');
    text(ctx, `${index + 1}`, rect.x + rect.width - 28, y + rect.height - 18, 13, '#1a1424', 'center');
  });
  const night = state.night + 1;
  const palette = paletteFor(night);
  const tide = state.nextOmen;
  panel(ctx, 40, 528, 1200, 64, 16, 'rgba(10, 10, 26, 0.85)', 'rgba(255, 207, 122, 0.35)');
  text(ctx, 'NEXT', 64, 566, 13, DIM);
  text(ctx, `NIGHT ${night} OF ${NIGHTS}`, 112, 568, 22, GOLD, 'left', SERIF);
  text(ctx, palette.name, 330, 567, 17, PALE, 'left', SERIF, 'italic');
  const tideLine = tide ? `tide: ${tide.name}  ·  reward: ${tide.reward}` : 'no tide: the Gloam rises under a blood moon';
  text(ctx, tideLine, 1216, 567, 16, tide ? `hsl(${tide.hue}, 90%, 72%)` : '#ff8aa0', 'right');
  text(ctx, `Pick a tide (Q / W or click), then a boon (1 / 2 / 3 or click) to light night ${night}`, VIEW.width / 2, 634, 16, DIM, 'center');
}

function drawPause(ctx) {
  veil(ctx, 0.55);
  text(ctx, 'PAUSED', VIEW.width / 2, 330, 64, GOLD, 'center', SERIF);
  text(ctx, 'P or Esc to resume  ·  R to start over  ·  M sound', VIEW.width / 2, 380, 18, PALE, 'center', SANS, 'normal');
}

const GRADE_COLORS = { S: '#ffd36a', A: '#ffb36a', B: '#9fd6ff', C: '#b9a6ff', D: '#a0a0b0' };

/** The grade medallion: a big letter in a glowing coin, with the watch it was earned on. */
function drawGrade(ctx, state, x, y) {
  const grade = watchGrade(state);
  const color = GRADE_COLORS[grade];
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  const coin = ctx.createRadialGradient(x - 20, y - 24, 10, x, y, 86);
  coin.addColorStop(0, '#fff6dc');
  coin.addColorStop(1, color);
  ctx.fillStyle = coin;
  ctx.beginPath();
  ctx.arc(x, y, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(80, 50, 20, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 66, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, grade, x, y + 34, 96, '#3a2410', 'center', SERIF);
  text(ctx, 'GRADE', x, y + 116, 16, PALE, 'center');
  text(ctx, `${state.difficulty.name} watch`, x, y + 140, 14, DIM, 'center', SANS, 'normal');
}

/** The feats of the watch, ticked or open. */
function drawFeats(ctx, state, x, y) {
  const feats = watchFeats(state);
  const earned = feats.filter((feat) => feat.done).length;
  panel(ctx, x, y, 290, 52 + feats.length * 34, 16, 'rgba(10, 10, 26, 0.88)', 'rgba(255, 207, 122, 0.45)');
  text(ctx, `FEATS ${earned}/${feats.length}`, x + 18, y + 32, 15, GOLD);
  feats.forEach((feat, index) => {
    const row = y + 66 + index * 34;
    panel(ctx, x + 16, row - 16, 20, 20, 5, feat.done ? '#5fd38a' : 'rgba(255, 255, 255, 0.12)');
    if (feat.done) {
      ctx.strokeStyle = '#0b2014';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 21, row - 6);
      ctx.lineTo(x + 25, row - 1);
      ctx.lineTo(x + 31, row - 11);
      ctx.stroke();
    }
    text(ctx, feat.name, x + 44, row - 1, 13, feat.done ? PALE : DIM, 'left', SANS, 'normal');
  });
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
  drawGrade(ctx, state, 190, 330);
  drawFeats(ctx, state, 966, 188);
  panel(ctx, 340, 188, 600, 420, 22, 'rgba(10, 10, 26, 0.88)', 'rgba(255, 207, 122, 0.45)');
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
    const x = 366 + column * 292;
    const y = 352 + row * 40;
    text(ctx, label, x, y, 15, DIM, 'left', SANS, 'normal');
    text(ctx, value, x + 236, y, 20, PALE, 'right');
  });
  text(ctx, 'Boons', 366, 444, 15, DIM, 'left', SANS, 'normal');
  state.boons.forEach((id, index) => {
    const boon = boonById(id);
    drawIcon(ctx, boon.icon, 440 + index * 36, 438, 22, boon.rare ? '#c9a6ff' : GOLD);
  });
  if (state.boons.length === 0) text(ctx, 'none yet', 440, 444, 15, DIM, 'left', SANS, 'normal');
  text(ctx, 'THE WATCH', VIEW.width / 2, 492, 13, DIM, 'center');
  drawWatchLog(ctx, state, VIEW.width / 2, 532, 52, 36);
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
