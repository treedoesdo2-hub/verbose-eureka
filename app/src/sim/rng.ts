export type RngSnapshot = readonly [number, number, number, number];

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

export class Rng {
  private readonly s: Uint32Array;

  constructor(seed: number) {
    this.s = new Uint32Array(4);
    let x = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      z = (z ^ (z >>> 16)) >>> 0;
      this.s[i] = z;
    }
    if ((this.s[0] | this.s[1] | this.s[2] | this.s[3]) === 0) {
      this.s[0] = 1;
    }
  }

  nextU32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }

  next(): number {
    return this.nextU32() / 0x100000000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[this.int(0, arr.length)];
  }

  snapshot(): RngSnapshot {
    return [this.s[0], this.s[1], this.s[2], this.s[3]];
  }

  restore(snap: RngSnapshot): void {
    this.s[0] = snap[0];
    this.s[1] = snap[1];
    this.s[2] = snap[2];
    this.s[3] = snap[3];
  }
}
