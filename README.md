# tiny-stack-vm

[![Node](https://img.shields.io/badge/node-22-green.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![make.fun](https://img.shields.io/badge/make.fun-tiny--stack--vm-01-blue)](https://make.fun/c/tiny-stack-vm-01-run-20261122)

A tiny stack virtual machine for [tiny-stack-vm-01-run-20261122](https://make.fun/c/tiny-stack-vm-01-run-20261122) on make.fun.

`main.ts` answers every instance: it reads `program.bin` and `input.bin`, runs the bytecode on an interpreter for the tiny stack ISA (32-bit wrapping integers, 256-value stack, 256 words of memory, ten traps), and writes `stdout.bin` and `exit.txt` per instance. MIT — see [LICENSE](LICENSE).
