// Painting the night: the sea, the lantern's rock, every shade, spark and ember, then the dark laid
// over it all with holes cut where light falls, then what glows through the dark (eyes, sparks,
// embers), and last the HUD and whichever screen is up. It reads the world and never changes it.
import { LANTERN, PLAYER, VIEW } from './config.js';
import { BRUTE, DARTER, GLOAM, SHADE, SPITTER } from './enemies.js';
import { glowRadius } from './world.js';
import { drawHud, drawScreen } from './hud.js';
import { paletteFor } from './palettes.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BOON = 'boon';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Fixed glints on the water, placed once by a tiny generator so every frame agrees. */
const GLINTS = (() => {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 70 }, () => ({ x: next() * VIEW.width, y: 60 + next() * (VIEW.height - 60), size: 0.6 + next() * 1.6, phase: next() * 6.28 }));
})();

/** The lantern's rock: an uneven ring of points around the lantern. */
const ROCK = Array.from({ length: 14 }, (_, index) => {
  const angle = (index / 14) * Math.PI * 2;
  const wobble = [1, 0.86, 1.08, 0.94, 1.12, 0.9, 1.02, 0.84, 1.1, 0.96, 1.05, 0.88, 1.14, 0.92][index];
  return { x: Math.cos(angle) * 78 * wobble, y: Math.sin(angle) * 40 * wobble };
});

/** A renderer for `canvas`: resize() fits it to the window, draw(world, ui) paints one frame. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  const dctx = dark.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    canvas.width = width;
    canvas.height = height;
    dark.width = width;
    dark.height = height;
    scale = Math.min(width / VIEW.width, height / VIEW.height);
    offsetX = (width - VIEW.width * scale) / 2;
    offsetY = (height - VIEW.height * scale) / 2;
  }

  /** The playfield point under a page pixel (for the mouse). */
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / Math.max(1, rect.width);
    return { x: ((clientX - rect.left) * ratio - offsetX) / scale, y: ((clientY - rect.top) * ratio - offsetY) / scale };
  }

  function drawSea(time, palette) {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    sky.addColorStop(0, palette.top);
    sky.addColorStop(0.55, palette.mid);
    sky.addColorStop(1, palette.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.lineWidth = 1.6;
    for (let row = 0; row < 26; row += 1) {
      const y = 40 + row * 27;
      ctx.strokeStyle = `rgba(${palette.wave}, ${0.08 + 0.06 * Math.sin(row * 1.7)})`;
      ctx.beginPath();
      for (let x = -20; x <= VIEW.width + 20; x += 20) {
        const wave = Math.sin(x * 0.012 + time * 0.9 + row * 0.8) * 5 + Math.sin(x * 0.031 - time * 1.3 + row) * 2;
        if (x === -20) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    for (const glint of GLINTS) {
      const shine = 0.25 + 0.25 * Math.sin(time * 1.5 + glint.phase);
      ctx.fillStyle = `rgba(170, 200, 255, ${shine})`;
      ctx.fillRect(glint.x, glint.y, glint.size * 3, glint.size * 0.7);
    }
  }

  /** A thin moon low over the sea, with its broken path of light on the water; it glows through the dark. */
  function drawMoon(time, palette) {
    const x = 1150;
    const y = 214;
    const blood = palette.name === 'Blood Moon';
    const halo = ctx.createRadialGradient(x, y, 20, x, y, blood ? 170 : 130);
    halo.addColorStop(0, `rgba(${palette.halo}, ${blood ? 0.4 : 0.3})`);
    halo.addColorStop(1, `rgba(${palette.halo}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(x - 170, y - 170, 340, 340);
    ctx.fillStyle = palette.moon;
    ctx.beginPath();
    ctx.arc(x, y, blood ? 34 : 30, 0, Math.PI * 2);
    ctx.fill();
    if (!blood) {
      ctx.fillStyle = palette.mid;
      ctx.beginPath();
      ctx.arc(x + 13, y - 7, 27, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let row = 0; row < 15; row += 1) {
      const wy = y + 70 + row * 24;
      const width = 10 + row * 4 + Math.sin(time * 1.7 + row) * 6;
      ctx.fillStyle = `rgba(${palette.halo}, ${0.18 - row * 0.009})`;
      ctx.fillRect(x - width / 2 + Math.sin(time + row * 1.3) * 6, wy, width, 2.4);
    }
  }

  function drawIsland(state, time) {
    const lantern = state.lantern;
    const pool = ctx.createRadialGradient(lantern.x, lantern.y, 10, lantern.x, lantern.y, glowRadius(lantern) * 1.05);
    pool.addColorStop(0, 'rgba(255, 190, 90, 0.34)');
    pool.addColorStop(0.5, 'rgba(255, 150, 60, 0.12)');
    pool.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(lantern.x, lantern.y, glowRadius(lantern) * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(lantern.x, lantern.y + 18);
    ctx.strokeStyle = `rgba(190, 220, 255, ${0.18 + Math.sin(time * 2) * 0.06})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 4, 92 + Math.sin(time * 2) * 4, 48 + Math.sin(time * 2) * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    const stone = ctx.createLinearGradient(0, -40, 0, 40);
    stone.addColorStop(0, '#5a4a46');
    stone.addColorStop(1, '#1e1820');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ROCK.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 190, 120, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, -10, 50, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const hurt = lantern.hurt > 0;
    ctx.save();
    ctx.translate(lantern.x, lantern.y);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(-4, 4, 8, 16);
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(-15, -30, 30, 5);
    ctx.fillRect(-12, 2, 24, 5);
    const share = lantern.light / lantern.maxLight;
    const glass = ctx.createLinearGradient(0, -26, 0, 2);
    glass.addColorStop(0, hurt ? '#ff6a5a' : `rgba(255, 230, 150, ${0.5 + share * 0.5})`);
    glass.addColorStop(1, hurt ? '#a02030' : `rgba(255, 150, 60, ${0.5 + share * 0.5})`);
    ctx.fillStyle = glass;
    ctx.fillRect(-10, -25, 20, 27);
    ctx.strokeStyle = '#a07a40';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -25, 20, 27);
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(0, 2);
    ctx.stroke();
    ctx.fillStyle = '#7a5a30';
    ctx.beginPath();
    ctx.moveTo(-15, -30);
    ctx.lineTo(0, -42);
    ctx.lineTo(15, -30);
    ctx.fill();
    ctx.restore();
  }

  function drawShade(enemy) {
    const flap = Math.sin(enemy.age * 13 + enemy.wobble) * 0.6;
    const r = enemy.radius;
    ctx.fillStyle = 'hsl(275, 42%, 36%)';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.5 + flap));
      ctx.beginPath();
      ctx.ellipse(side * r * 0.9, -r * 0.2, r * 1.1, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'hsl(280, 38%, 18%)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDarter(enemy) {
    const r = enemy.radius;
    ctx.rotate(Math.atan2(enemy.vy, enemy.vx));
    ctx.fillStyle = 'hsl(188, 55%, 34%)';
    ctx.beginPath();
    ctx.moveTo(r * 2.2, 0);
    ctx.lineTo(-r * 0.6, -r * 0.9);
    ctx.lineTo(-r * 1.8, -r * 0.2);
    ctx.lineTo(-r * 2.6, -r * 0.9);
    ctx.lineTo(-r * 2.2, 0);
    ctx.lineTo(-r * 2.6, r * 0.9);
    ctx.lineTo(-r * 1.8, r * 0.2);
    ctx.lineTo(-r * 0.6, r * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  function drawBlob(enemy, points, wobble, fill) {
    const r = enemy.radius;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let index = 0; index <= points; index += 1) {
      const angle = (index / points) * Math.PI * 2;
      const reach = r * (1 + wobble * Math.sin(angle * 3 + enemy.age * 4 + enemy.wobble));
      if (index === 0) ctx.moveTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
      else ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
    }
    ctx.fill();
  }

  function drawSpitter(enemy) {
    const r = enemy.radius * (1 + enemy.attack * 0.5);
    ctx.strokeStyle = 'hsl(150, 45%, 34%)';
    ctx.lineWidth = 3;
    for (let index = 0; index < 3; index += 1) {
      const sway = Math.sin(enemy.age * 5 + index * 2) * 8;
      ctx.beginPath();
      ctx.moveTo((index - 1) * 6, r * 0.5);
      ctx.quadraticCurveTo((index - 1) * 10 + sway, r * 1.6, (index - 1) * 6 - sway, r * 2.6);
      ctx.stroke();
    }
    ctx.fillStyle = 'hsl(155, 45%, 24%)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGloam(enemy) {
    const r = enemy.radius;
    ctx.strokeStyle = 'hsl(258, 45%, 24%)';
    ctx.lineCap = 'round';
    for (let index = 0; index < 9; index += 1) {
      const angle = (index / 9) * Math.PI * 2 + Math.sin(enemy.age * 0.8) * 0.2;
      const curl = Math.sin(enemy.age * 2.4 + index) * 0.5;
      ctx.lineWidth = 9 - (index % 3) * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r * 0.7, Math.sin(angle) * r * 0.7);
      ctx.quadraticCurveTo(Math.cos(angle + curl) * r * 1.6, Math.sin(angle + curl) * r * 1.6, Math.cos(angle - curl) * r * 2.2, Math.sin(angle - curl) * r * 2.2);
      ctx.stroke();
    }
    drawBlob(enemy, 24, 0.07, enemy.final ? 'hsl(330, 45%, 17%)' : 'hsl(255, 45%, 17%)');
    ctx.fillStyle = 'hsl(255, 38%, 30%)';
    for (let index = 0; index < 7; index += 1) {
      const angle = -Math.PI / 2 + (index - 3) * 0.32;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle - 0.1) * r * 0.9, Math.sin(angle - 0.1) * r * 0.9);
      ctx.lineTo(Math.cos(angle) * r * 1.45, Math.sin(angle) * r * 1.45);
      ctx.lineTo(Math.cos(angle + 0.1) * r * 0.9, Math.sin(angle + 0.1) * r * 0.9);
      ctx.fill();
    }
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === SHADE) drawShade(enemy);
    else if (enemy.kind === DARTER) drawDarter(enemy);
    else if (enemy.kind === BRUTE) drawBlob(enemy, 18, 0.1, 'hsl(320, 38%, 26%)');
    else if (enemy.kind === SPITTER) drawSpitter(enemy);
    else if (enemy.kind === GLOAM) drawGloam(enemy);
    if (enemy.hurt > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255, 240, 220, ${enemy.hurt * 4})`;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The eyes of every shade, and the faint aura round it: what of the Murk shows in the dark. */
  function drawEyes(enemy) {
    const r = enemy.radius;
    const hue = { [SHADE]: 280, [DARTER]: 185, [BRUTE]: 320, [SPITTER]: 140, [GLOAM]: enemy.final ? 350 : 265 }[enemy.kind];
    const reach = r * (enemy.kind === GLOAM ? 2.6 : 2.2);
    const aura = ctx.createRadialGradient(enemy.x, enemy.y, r * 0.3, enemy.x, enemy.y, reach);
    aura.addColorStop(0, `hsla(${hue}, 90%, 55%, ${enemy.kind === GLOAM ? 0.34 : 0.22})`);
    aura.addColorStop(1, `hsla(${hue}, 90%, 45%, 0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, reach, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `hsl(${hue}, 100%, 72%)`;
    ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
    ctx.shadowBlur = 10;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === DARTER) {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * r * 0.9, Math.sin(angle) * r * 0.9, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === GLOAM) {
      for (let index = 0; index < 5; index += 1) {
        const angle = -Math.PI / 2 + (index - 2) * 0.42;
        const blink = Math.sin(enemy.age * 3 + index * 1.7) > 0.93 ? 0.3 : 1;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * r * 0.5, Math.sin(angle) * r * 0.5 + 8, 6, 6 * blink, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const gap = enemy.kind === BRUTE ? 8 : 4;
      const count = enemy.kind === BRUTE ? 3 : 2;
      for (let index = 0; index < count; index += 1) {
        ctx.beginPath();
        ctx.arc((index - (count - 1) / 2) * gap, -r * 0.25, enemy.kind === BRUTE ? 3.2 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawWick(state, time) {
    const player = state.player;
    if (player.hp <= 0) return;
    if (player.invulnerable > 0 && player.dashTime <= 0 && Math.floor(time * 18) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    const flicker = 1 + Math.sin(time * 23) * 0.06 + Math.sin(time * 37) * 0.04;
    const r = PLAYER.radius;
    ctx.fillStyle = player.hurt > 0 ? '#ff6050' : '#ff8a2a';
    ctx.beginPath();
    ctx.moveTo(0, -r * 2.1 * flicker);
    ctx.bezierCurveTo(r * 1.3, -r * 0.6, r * 1.1, r, 0, r);
    ctx.bezierCurveTo(-r * 1.1, r, -r * 1.3, -r * 0.6, 0, -r * 2.1 * flicker);
    ctx.fill();
    ctx.fillStyle = '#fff3c0';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1 * flicker);
    ctx.bezierCurveTo(r * 0.6, -r * 0.2, r * 0.5, r * 0.6, 0, r * 0.6);
    ctx.bezierCurveTo(-r * 0.5, r * 0.6, -r * 0.6, -r * 0.2, 0, -r * 1.1 * flicker);
    ctx.fill();
    ctx.restore();
  }

  function drawLights(state, time, palette) {
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    dctx.fillStyle = `rgba(${palette.dark}, 0.7)`;
    dctx.fillRect(-10, -10, VIEW.width + 20, VIEW.height + 20);
    dctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, radius, strength = 1) => {
      const light = dctx.createRadialGradient(x, y, 0, x, y, radius);
      light.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
      light.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.75})`);
      light.addColorStop(1, 'rgba(0, 0, 0, 0)');
      dctx.fillStyle = light;
      dctx.beginPath();
      dctx.arc(x, y, radius, 0, Math.PI * 2);
      dctx.fill();
    };
    const lantern = state.lantern;
    hole(lantern.x, lantern.y, glowRadius(lantern) * (1 + Math.sin(time * 7) * 0.015 + Math.sin(time * 13) * 0.01));
    if (state.player.hp > 0) hole(state.player.x, state.player.y, 120, 0.9);
    let budget = 70;
    for (const spark of state.sparks) if (budget-- > 0) hole(spark.x, spark.y, 34, 0.7);
    for (const ember of state.embers) if (budget-- > 0) hole(ember.x, ember.y, 26, 0.6);
    for (const ring of state.rings) hole(ring.x, ring.y, ring.radius + 80, 0.95);
    if (state.flash > 0) {
      dctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.6, state.flash)})`;
      dctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0);
  }

  function drawGlowing(state, time, showTexts, palette) {
    const fx = state.fx;
    drawMoon(time, palette);
    for (const enemy of state.enemies) drawEyes(enemy);
    ctx.globalCompositeOperation = 'lighter';
    for (const glob of state.globs) {
      ctx.fillStyle = 'rgba(80, 255, 160, 0.55)';
      ctx.beginPath();
      ctx.arc(glob.x, glob.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(10, 40, 25, 0.9)';
      ctx.beginPath();
      ctx.arc(glob.x, glob.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ember of state.embers) {
      const pulse = 4 + Math.sin(time * 9 + ember.spin) * 1.2;
      ctx.save();
      ctx.translate(ember.x, ember.y);
      ctx.rotate(ember.spin + time * 2);
      ctx.fillStyle = `rgba(255, 170, 60, ${Math.min(1, ember.life)})`;
      ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      ctx.restore();
    }
    ctx.lineCap = 'round';
    for (const spark of state.sparks) {
      ctx.strokeStyle = spark.beacon ? 'rgba(140, 220, 255, 0.95)' : 'rgba(255, 214, 130, 1)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(spark.x - spark.vx * 0.04, spark.y - spark.vy * 0.04);
      ctx.lineTo(spark.x, spark.y);
      ctx.stroke();
    }
    for (const particle of fx.particles) {
      const alpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = `hsla(${particle.hue}, 95%, 62%, ${alpha})`;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    for (const bolt of fx.bolts) {
      ctx.strokeStyle = `rgba(170, 220, 255, ${bolt.life * 4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      bolt.points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
      ctx.stroke();
    }
    for (const ring of state.rings) {
      const fade = Math.max(0, 1 - ring.radius / (ring.max + 20));
      ctx.strokeStyle = ring.choir ? `rgba(150, 230, 255, ${fade})` : `rgba(255, 220, 150, ${fade})`;
      ctx.lineWidth = ring.choir ? 6 : 10;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    const player = state.player;
    if (player.hp > 0) {
      for (let index = 0; index < state.mods.orbiters; index += 1) {
        const angle = state.orbitAngle + (index / state.mods.orbiters) * Math.PI * 2;
        ctx.fillStyle = 'rgba(255, 120, 50, 0.95)';
        ctx.beginPath();
        ctx.arc(player.x + Math.cos(angle) * 48, player.y + Math.sin(angle) * 48, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 34);
      glow.addColorStop(0, 'rgba(255, 180, 80, 0.45)');
      glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    const lantern = state.lantern;
    const flame = ctx.createRadialGradient(lantern.x, lantern.y - 12, 0, lantern.x, lantern.y - 12, 46);
    flame.addColorStop(0, 'rgba(255, 220, 140, 0.8)');
    flame.addColorStop(1, 'rgba(255, 140, 50, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(lantern.x, lantern.y - 12, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Trebuchet MS", Verdana, sans-serif';
    for (const text of showTexts ? fx.texts : []) {
      ctx.fillStyle = `hsla(${text.hue}, 100%, 70%, ${Math.min(1, text.life * 1.5)})`;
      ctx.fillText(text.text, text.x, text.y);
    }
    if (player.hp > 0 && player.dashCooldown > 0) {
      ctx.strokeStyle = 'rgba(255, 220, 160, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - player.dashCooldown / 1.5));
      ctx.stroke();
    }
  }

  /** Paint one frame of `world` under the `ui` state (screen, best score, mouse, hover, clock). */
  function draw(world, ui) {
    const state = world.state;
    const time = ui.clock;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.shake > 0 ? state.shake : 0;
    const sx = Math.sin(time * 91) * shake * 0.5;
    const sy = Math.cos(time * 77) * shake * 0.5;
    ctx.setTransform(scale, 0, 0, scale, offsetX + sx * scale, offsetY + sy * scale);
    const palette = paletteFor(state.night);
    drawSea(time, palette);
    drawIsland(state, time);
    for (const enemy of state.enemies) drawEnemy(enemy);
    drawWick(state, time);
    drawLights(state, time, palette);
    ctx.setTransform(scale, 0, 0, scale, offsetX + sx * scale, offsetY + sy * scale);
    drawGlowing({ ...state, fx: world.fx }, time, ui.screen !== SCREEN_TITLE, palette);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (state.lantern.hurt > 0 || state.player.hurt > 0) {
      const edge = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.4, VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.7);
      edge.addColorStop(0, 'rgba(160, 20, 30, 0)');
      edge.addColorStop(1, `rgba(160, 20, 30, ${Math.max(state.lantern.hurt, state.player.hurt) * 0.9})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (ui.screen === SCREEN_PLAY || ui.screen === SCREEN_PAUSED) drawHud(ctx, state, ui);
    drawScreen(ctx, state, ui);
  }

  resize();
  return { resize, draw, toWorld };
}
