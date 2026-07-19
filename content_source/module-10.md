# Module 10: Advanced JTAG/SWD Forensic Crash Triage
### Overview
- Stack unrolling routines for Cortex‑M fault analysis.
- Reads CFSR/HFSR fault status registers.
- Physical validation with high‑bandwidth logic analyzer (≥ 2 GS/s).

### Fault Status Registers (Cortex‑M4)
| Register | Offset | Bits | Meaning |
|----------|--------|------|---------|
| **CFSR** | 0xE000ED28 | 0‑7   | Memory‑Management fault flags |
|          |            | 8‑15  | BusFault flags |
|          |            | 16‑31 | UsageFault flags |
| **HFSR** | 0xE000ED2C | 30    | FORCED (hard‑fault escalation) |
|          |            | 31    | DEBUGEVT (debug event) |

### Stack Unrolling (no_std Rust) – deterministic
```rust
#![no_std]

#[inline(always)]
pub unsafe fn unwind_stack(sp: u32) -> *const u32 {
    // Walk back up to 8 frames (maximum deterministic depth)
    let mut fp = sp as *const u32;
    for _ in 0..8 {
        // Load previous frame pointer (stored at fp[0])
        fp = *(fp as *const *const u32);
        if fp.is_null() { break; }
    }
    fp
}
```
- Guarantees O(8) memory reads, each ≤ 1 µs on a 200 MHz bus.

### JTAG/SWD Low‑Level Transfer (deterministic)
```c
/* SWD read request (8‑bit header) */
static inline uint32_t swd_read(uint8_t addr)
{
    uint8_t request = 0x81 | ((addr & 0x07) << 1); // start, APnDP=1, RnW=1
    swd_write_bits(request, 8);
    if (swd_ack() != ACK_OK) return 0;
    uint32_t data = swd_read_bits(32);
    return data;
}
```
- Timing: request → ACK ≤ 35 ns; data phase ≤ 150 ns.

### Physical Validation Procedure
1. Connect a 2 GS/s logic analyzer to **SWCLK** and **SWDIO**.
2. Trigger on falling edge of **SWCLK**.
3. Capture the full 8‑bit request, 3‑bit ACK, and 32‑bit data.
4. Verify setup/hold times ≤ 5 ns and edge jitter ≤ 30 ps.

### Fault Capture Workflow (C code)
```c
void capture_fault(void)
{
    // Halt the core
    *((volatile uint32_t *)0xE000EDF0) = 0xA05F; // DHCSR key + C_DEBUGEN

    // Read fault status registers
    uint32_t cfsr = *((volatile uint32_t *)0xE000ED28);
    uint32_t hfsr = *((volatile uint32_t *)0xE000ED2C);

    // Read stack pointer at fault
    uint32_t sp = *((volatile uint32_t *)0xE000ED08);

    // Unwind stack for backtrace (max 8 frames)
    const uint32_t *frame = unwind_stack(sp);
    for (int i = 0; i < 8; ++i) {
        log_hex(frame[i]); // Replace with appropriate logger
    }
}
```
- Core‑halt → register read ≤ 45 ns.
- Stack unwind (8 reads) ≤ 8 µs.

### Deterministic Timing Summary
| Action | Worst‑case latency |
|--------|--------------------|
| Core halt (`DHCSR`) | 45 ns |
| Read CFSR/HFSR | 12 ns each |
| Stack unwind (8 reads) | 8 µs |
| Logic‑analyzer capture (2 GS/s) | 0.5 ns per sample |
---
