// Tiny stack VM for make.fun's tiny stack ISA v1. One run answers every
// instance in MAKEFUN_INPUT_DIR and writes stdout.bin + exit.txt per <id>
// under MAKEFUN_OUTPUT_DIR. Plain JavaScript, so Node 22 runs it as-is.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode table [byte, immediate bytes, pops, pushes]; KNOWN marks named bytes.
const IMM = new Uint8Array(256), POPN = new Uint8Array(256), PUSHN = new Uint8Array(256), KNOWN = new Uint8Array(256);
for (const [o, i, p, u] of [
  [0,0,0,0],[1,1,0,1],[2,4,0,1],[3,0,1,0],[4,0,1,2],[5,0,2,2],[6,0,2,3],[7,0,3,3],
  [16,0,2,1],[17,0,2,1],[18,0,2,1],[19,0,2,1],[20,0,2,1],[21,0,2,1],[22,0,2,1],
  [23,0,1,1],[24,0,2,1],[25,0,2,1],[26,0,2,1],[27,0,1,1],[28,0,2,1],[29,0,2,1],
  [30,0,2,1],[32,0,2,1],[33,0,2,1],[34,0,2,1],[48,2,0,0],[49,2,1,0],[50,2,1,0],
  [51,2,0,0],[52,0,0,0],[64,0,1,1],[65,0,2,0],[80,0,1,0],[81,0,1,0],[82,0,0,1],[83,0,1,0],
]) { KNOWN[o] = 1; IMM[o] = i; POPN[o] = p; PUSHN[o] = u; }

// Runs one program on its input; returns the bytes it wrote and its exit code.
function run(prog, input) {
  const n = prog.length;
  const d = new Int32Array(256), c = new Int32Array(64), m = new Int32Array(256);
  const out = new Uint8Array(65536), sc = new Uint8Array(12);
  let sp = 0, cp = 0, pc = 0, steps = 0, olen = 0, inPos = 0;
  const end = (e) => ({ stdout: out.slice(0, olen), exit: e });
  for (;;) {
    // ISA "One step", in order: step limit, pc bounds, unknown opcode,
    // cut-off immediate, then the step counts and the stack needs.
    if (steps === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = prog[pc];
    if (!KNOWN[op]) return end(5);
    const imm = IMM[op];
    if (pc + imm >= n) return end(9);
    steps++;
    const pops = POPN[op], pushes = PUSHN[op];
    if (sp < pops) return end(2);
    if (sp - pops + pushes > 256) return end(3);
    const nx = pc + 1 + imm;
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1: d[sp++] = (prog[nx - 1] << 24) >> 24; break;
      case 2:
        d[sp++] = prog[nx - 4] | (prog[nx - 3] << 8) | (prog[nx - 2] << 16) | (prog[nx - 1] << 24);
        break;
      case 3: sp--; break;
      case 4: d[sp] = d[sp - 1]; sp++; break;
      case 5: { const t = d[sp - 1]; d[sp - 1] = d[sp - 2]; d[sp - 2] = t; break; }
      case 6: d[sp] = d[sp - 2]; sp++; break;
      case 7: { const a = d[sp - 3]; d[sp - 3] = d[sp - 2]; d[sp - 2] = d[sp - 1]; d[sp - 1] = a; break; }
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24: case 25: case 26:
      case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = d[sp - 1], a = d[sp - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) {
          if (b === 0) return end(4);
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 20) {
          if (b === 0) return end(4);
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 21) {
          if (b === 0) return end(4);
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 22) {
          if (b === 0) return end(4);
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        d[sp++] = r;
        break;
      }
      case 23: d[sp - 1] = (-d[sp - 1]) | 0; break;
      case 27: d[sp - 1] = ~d[sp - 1]; break;
      case 48: case 49: case 50: {
        const rel = ((prog[nx - 2] | (prog[nx - 1] << 8)) << 16) >> 16;
        let take = op === 48;
        if (op !== 48) {
          const v = d[--sp];
          take = op === 49 ? v === 0 : v !== 0;
        }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (cp === 64) return end(7);
        c[cp++] = nx;
        pc = prog[nx - 2] | (prog[nx - 1] << 8);
        break;
      case 52:
        if (cp === 0) return end(8);
        pc = c[--cp];
        break;
      case 64: {
        const a = d[sp - 1];
        if (a < 0 || a >= 256) return end(6);
        d[sp - 1] = m[a];
        break;
      }
      case 65: {
        const a = d[sp - 1];
        if (a < 0 || a >= 256) return end(6);
        const v = d[sp - 2];
        sp -= 2;
        m[a] = v;
        break;
      }
      case 80: {
        const v = d[sp - 1];
        let x = v < 0 ? -v : v, k = 0;
        if (x === 0) sc[k++] = 48;
        while (x > 0) { sc[k++] = 48 + (x % 10); x = Math.floor(x / 10); }
        const len = k + (v < 0 ? 1 : 0);
        if (olen + len > 65536) return end(11);
        sp--;
        if (v < 0) out[olen++] = 45;
        while (k > 0) out[olen++] = sc[--k];
        break;
      }
      case 81:
        if (olen + 1 > 65536) return end(11);
        out[olen++] = d[--sp] & 255;
        break;
      case 82:
        d[sp++] = inPos < input.length ? input[inPos++] : -1;
        break;
      case 83:
        return end(d[--sp] & 255);
    }
  }
}

// Driver: answer every instance in one run.
const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const e of readdirSync(IN, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
  if (!e.isDirectory()) continue;
  const id = e.name;
  const { stdout, exit } = run(readFileSync(join(IN, id, 'program.bin')), readFileSync(join(IN, id, 'input.bin')));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), stdout);
  writeFileSync(join(OUT, id, 'exit.txt'), String(exit) + '\n');
}
