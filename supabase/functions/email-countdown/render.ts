// Desenha o cronômetro como GIF animado de 60 s (1 quadro por segundo). Depois do primeiro
// quadro, cada quadro redesenha só as caixas que mudaram, para o arquivo ficar leve.
import { Frame, GIF, Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { countdownParts, type CountdownState } from "../_shared/email-countdown.ts";
import { POPPINS_600_B64, POPPINS_800_B64 } from "./fonts.ts";

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const BOLD = b64(POPPINS_800_B64);
const SEMI = b64(POPPINS_600_B64);

export const W = 560;
export const H = 150;
const PAD = 16, GAP = 8, CELL_Y = 40, CELL_H = 70;
const CELL_W = Math.floor((W - PAD * 2 - GAP * 3) / 4);
const BG = 0x0b0d15ff, CELL = 0x141726ff, LINE = 0x2a2f45ff, LINE_URGENT = 0x8a2d36ff;
const LABEL = 0xfcb58fff, NUM = 0xffffffff, NUM_URGENT = 0xff9a9aff, UNIT = 0x9aa3b8ff, NEXT = 0xc3c8d6ff, DOT = 0xff4d4dff;
const UNITS = ["dias", "horas", "min", "seg"] as const;

const textCache = new Map<string, Image>();
function text(font: Uint8Array, size: number, value: string, color: number): Image {
  const key = `${font === BOLD ? "b" : "s"}|${size}|${color}|${value}`;
  let img = textCache.get(key);
  if (!img) {
    img = Image.renderText(font, size, value, color);
    if (textCache.size > 400) textCache.clear();
    textCache.set(key, img);
  }
  return img;
}

function fitText(font: Uint8Array, size: number, value: string, color: number, maxW: number): Image {
  let s = size;
  let img = text(font, s, value, color);
  while (img.width > maxW && s > 9) { s -= 1; img = text(font, s, value, color); }
  return img;
}

const cellX = (i: number) => PAD + i * (CELL_W + GAP);
const two = (n: number) => String(n).padStart(2, "0");

function drawCell(target: Image, i: number, value: number, urgent: boolean, ox = 0, oy = 0) {
  const x = cellX(i) - ox, y = CELL_Y - oy;
  target.drawBox(x, y, CELL_W, CELL_H, CELL);
  const num = text(BOLD, 34, two(value), urgent ? NUM_URGENT : NUM);
  target.composite(num, x + Math.round((CELL_W - num.width) / 2), y + 2);
  const unit = text(SEMI, 11, UNITS[i], UNIT);
  target.composite(unit, x + Math.round((CELL_W - unit.width) / 2), y + CELL_H - unit.height - 6);
}

function baseFrame(state: CountdownState, urgent: boolean): Image {
  const img = new Image(W, H).fill(BG);
  const line = urgent ? LINE_URGENT : LINE;
  img.drawBox(0, 0, W, 1, line); img.drawBox(0, H - 1, W, 1, line);
  img.drawBox(0, 0, 1, H, line); img.drawBox(W - 1, 0, 1, H, line);
  const lbl = fitText(BOLD, 15, state.label.toUpperCase(), LABEL, W - PAD * 2 - 16);
  const nxt = fitText(SEMI, 13, state.next, NEXT, W - PAD * 2);
  if (state.over) {
    img.composite(lbl, Math.round((W - lbl.width) / 2), 48);
    img.composite(nxt, Math.round((W - nxt.width) / 2), 80);
    return img;
  }
  img.drawCircle(PAD + 4, 20, 4, DOT);
  img.composite(lbl, PAD + 14, 10);
  img.composite(nxt, PAD, CELL_Y + CELL_H + 12);
  return img;
}

export async function renderCountdownGif(state: CountdownState, now: number, frames = 60): Promise<Uint8Array> {
  const out: Frame[] = [];
  const remaining = state.over ? 0 : Math.max(0, state.end - now);
  const urgentAt = (ms: number) => ms < 6 * 3600e3;
  let prev: ReturnType<typeof countdownParts> | null = null;
  let prevUrgent = false;
  const total = state.over ? 1 : Math.min(frames, Math.floor(remaining / 1000) + 1);
  for (let i = 0; i < total; i++) {
    const ms = remaining - i * 1000;
    const p = countdownParts(ms);
    const urgent = urgentAt(ms);
    const vals = [p.d, p.h, p.m, p.s];
    if (!prev || urgent !== prevUrgent) {
      const img = baseFrame(state, urgent);
      if (!state.over) vals.forEach((v, c) => drawCell(img, c, v, urgent));
      out.push(Frame.from(img, 1000, 0, 0, Frame.DISPOSAL_KEEP));
    } else {
      const pv = [prev.d, prev.h, prev.m, prev.s];
      const first = vals.findIndex((v, c) => v !== pv[c]);
      if (first < 0) continue;
      const x0 = cellX(first), w = cellX(3) + CELL_W - x0;
      const img = new Image(w, CELL_H).fill(BG);
      for (let c = first; c < 4; c++) drawCell(img, c, vals[c], urgent, x0, CELL_Y);
      out.push(Frame.from(img, 1000, x0, CELL_Y, Frame.DISPOSAL_KEEP));
    }
    prev = p;
    prevUrgent = urgent;
  }
  // loopCount 0: toca uma vez e para no último segundo (não volta a contar para trás).
  return await new GIF(out, 0).encode(95);
}
