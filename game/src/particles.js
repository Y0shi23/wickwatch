// Effects: sparks of soot and fire, floating score text and arc-lash bolts. They never touch the
// rules; the world just asks for them, and the renderer paints whatever is alive.

/** A pool of effects driven by its own random source, so effects never change how a night plays. */
export function createEffects(random) {
  const particles = [];
  const texts = [];
  const bolts = [];

  /** A puff of `count` particles at (x, y), coloured by `hue`, flung up to `speed` px/s. */
  function burst(x, y, hue, count, speed, size = 3, life = 0.7) {
    for (let index = 0; index < count; index += 1) {
      const angle = random.range(0, Math.PI * 2);
      const pace = random.range(0.2, 1) * speed;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: random.range(0.5, 1) * life,
        max: life,
        size: random.range(0.6, 1.2) * size,
        hue,
      });
    }
  }

  /** A short trail mote behind something moving fast. */
  function trail(x, y, hue, size = 2.4) {
    particles.push({ x, y, vx: random.range(-20, 20), vy: random.range(-20, 20), life: 0.3, max: 0.3, size, hue });
  }

  /** Text that rises and fades: points, "+light", a boon's name. */
  function float(x, y, text, hue = 40) {
    texts.push({ x, y, text, hue, life: 1.1 });
  }

  /** A jagged bolt from one point to another, for Arc Lash. */
  function bolt(x1, y1, x2, y2) {
    const points = [{ x: x1, y: y1 }];
    for (let index = 1; index < 6; index += 1) {
      const t = index / 6;
      points.push({ x: x1 + (x2 - x1) * t + random.range(-12, 12), y: y1 + (y2 - y1) * t + random.range(-12, 12) });
    }
    points.push({ x: x2, y: y2 });
    bolts.push({ points, life: 0.22 });
  }

  function update(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 2.4 * dt;
      particle.vy *= 1 - 2.4 * dt;
    }
    for (let index = texts.length - 1; index >= 0; index -= 1) {
      texts[index].life -= dt;
      texts[index].y -= 34 * dt;
      if (texts[index].life <= 0) texts.splice(index, 1);
    }
    for (let index = bolts.length - 1; index >= 0; index -= 1) {
      bolts[index].life -= dt;
      if (bolts[index].life <= 0) bolts.splice(index, 1);
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }

  function clear() {
    particles.length = 0;
    texts.length = 0;
    bolts.length = 0;
  }

  return { particles, texts, bolts, burst, trail, float, bolt, update, clear };
}
