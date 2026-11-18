// Little vector glyphs for the boons and the HUD, drawn with canvas paths so the game ships no images.

/** Draw glyph `name` centred on (x, y), `size` pixels across, in `color`. */
export function drawIcon(ctx, name, x, y, size, color) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size / 12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (name === 'bolt') {
    ctx.moveTo(s * 0.2, -s);
    ctx.lineTo(-s * 0.55, s * 0.1);
    ctx.lineTo(-s * 0.05, s * 0.1);
    ctx.lineTo(-s * 0.25, s);
    ctx.lineTo(s * 0.6, -s * 0.15);
    ctx.lineTo(s * 0.1, -s * 0.15);
    ctx.closePath();
    ctx.fill();
  } else if (name === 'fork') {
    for (const turn of [-0.35, 0.35]) {
      ctx.moveTo(0, s * 0.9);
      ctx.lineTo(Math.sin(turn) * s * 1.6, -s * 0.8);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-s * 0.55, -s * 0.8, s * 0.22, 0, Math.PI * 2);
    ctx.arc(s * 0.55, -s * 0.8, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'needle') {
    ctx.moveTo(-s, s * 0.15);
    ctx.lineTo(s, 0);
    ctx.lineTo(-s, -s * 0.15);
    ctx.fill();
    ctx.beginPath();
    for (const ring of [-0.4, 0.15]) {
      ctx.moveTo(ring * s, -s * 0.55);
      ctx.lineTo(ring * s, s * 0.55);
    }
    ctx.stroke();
  } else if (name === 'core') {
    ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      ctx.moveTo(Math.cos(angle) * s * 0.65, Math.sin(angle) * s * 0.65);
      ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
    }
    ctx.stroke();
  } else if (name === 'wing') {
    ctx.moveTo(0, s * 0.3);
    ctx.quadraticCurveTo(-s * 1.1, -s * 1.1, -s * 0.9, s * 0.6);
    ctx.quadraticCurveTo(-s * 0.4, s * 0.2, 0, s * 0.3);
    ctx.quadraticCurveTo(s * 1.1, -s * 1.1, s * 0.9, s * 0.6);
    ctx.quadraticCurveTo(s * 0.4, s * 0.2, 0, s * 0.3);
    ctx.fill();
  } else if (name === 'hearth') {
    ctx.rect(-s * 0.55, -s * 0.5, s * 1.1, s * 1.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, -s * 0.5);
    ctx.lineTo(0, -s);
    ctx.lineTo(s * 0.8, -s * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, s * 0.1, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'heart') {
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.35);
    ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.3, -s * 0.1, 0, s * 0.85);
    ctx.fill();
  } else if (name === 'star') {
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
      const reach = index % 2 === 0 ? s : s * 0.42;
      if (index === 0) ctx.moveTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
      else ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
    }
    ctx.closePath();
    ctx.fill();
  } else if (name === 'orbit') {
    ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
    ctx.arc(s * 0.53, -s * 0.53, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'arc') {
    ctx.moveTo(-s, -s * 0.2);
    ctx.lineTo(-s * 0.4, s * 0.3);
    ctx.lineTo(0, -s * 0.4);
    ctx.lineTo(s * 0.4, s * 0.3);
    ctx.lineTo(s, -s * 0.2);
    ctx.stroke();
  } else if (name === 'flame') {
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.8, s, 0, s);
    ctx.bezierCurveTo(-s * 0.8, s, -s * 0.9, -s * 0.2, 0, -s);
    ctx.fill();
  } else if (name === 'eye') {
    ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(0, -s * 0.9, s, 0);
    ctx.quadraticCurveTo(0, s * 0.9, -s, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'burst') {
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2;
      const reach = index % 2 === 0 ? s : s * 0.5;
      if (index === 0) ctx.moveTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
      else ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
    }
    ctx.closePath();
    ctx.fill();
  } else if (name === 'phoenix') {
    ctx.moveTo(0, s);
    ctx.quadraticCurveTo(-s * 0.2, 0, -s, -s * 0.6);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.3, -s * 0.1, -s * 0.9);
    ctx.quadraticCurveTo(0, -s * 0.2, s * 0.1, -s * 0.9);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.3, s, -s * 0.6);
    ctx.quadraticCurveTo(s * 0.2, 0, 0, s);
    ctx.fill();
  } else if (name === 'choir') {
    ctx.arc(0, s * 0.2, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    for (const reach of [0.5, 0.8]) {
      ctx.beginPath();
      ctx.arc(0, s * 0.2, s * reach, -Math.PI * 0.95, -Math.PI * 0.05);
      ctx.stroke();
    }
  } else if (name === 'mirror') {
    ctx.moveTo(-s, s * 0.6);
    ctx.lineTo(0, -s * 0.5);
    ctx.lineTo(s, s * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.85);
    ctx.lineTo(s, -s * 0.85);
    ctx.stroke();
  } else if (name === 'emberheart') {
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.35);
    ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.3, -s * 0.1, 0, s * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.2);
    ctx.bezierCurveTo(s * 0.35, s * 0.05, s * 0.3, s * 0.45, 0, s * 0.45);
    ctx.bezierCurveTo(-s * 0.3, s * 0.45, -s * 0.35, s * 0.05, 0, -s * 0.2);
    ctx.fill();
  } else {
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
