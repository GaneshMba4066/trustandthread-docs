# Module 8: Storage Controller Invariants & Flash Wear-Leveling
### Overview
- Low‑level NAND/NOR flash command set (ONFI).
- Page allocation table and wear‑leveling algorithm.
- ECC verification flow with BCH (24‑bit) correction.

### ONFI Command Set
| Command | Opcode | Description |
|---------|--------|-------------|
| READ | 0x00 | Load page data into data register |
| PAGE PROGRAM | 0x80 | Write data from buffer to page |
| BLOCK ERASE | 0x60 → 0xD0 | Erase entire block |
| GET FEATURES | 0xEE | Retrieve device parameters |

### Flash Controller Registers (STM32F7 FMC)
| Offset | Register | Bits | Meaning |
|--------|----------|------|---------|
| 0x00 | **FMC_Bank1_RSR** | 0 | **BUSY** – controller busy flag |
| 0x04 | **FMC_Bank1_CR** | 1:0 | **CMD** – operation (READ/WRITE/ERASE) |
| 0x08 | **FMC_Bank1_ADDR** | 31:0 | Target address |
| 0x0C | **FMC_Bank1_DATA** | 31:0 | Data register |

### ECC Verification (BCH, 24‑bit)
```c
/* Raw ECC syndrome from controller */
uint32_t ecc_syndrome = FMC->ECC;
/* BCH decoder returns corrected word or error code */
int status = bch_decode(ecc_syndrome, corrected_data);
if (status == BCH_ERR_UNCORRECTABLE) {
    // Trigger block‑level wear‑leveling relocation
    relocate_block(page_addr);
}
```
- Correctable up to 4 bit‑errors per 512 B sector.
- Uncorrectable error triggers immediate wear‑leveling move.

### Wear‑Leveling Table (example geometry)
| Block | Erase Count | Valid Pages |
|-------|-------------|-------------|
| 0x0000 | 12 | 128 |
| 0x0001 | 15 | 128 |
| … | … | … |
| 0x0FFF | 9 | 128 |

### Deterministic Write Sequence
```c
/* 1. Issue PAGE PROGRAM */
FMC->CR = (0x80 << 0);
FMC->ADDR = page_addr;
/* 2. Write data (aligned 32‑bit) */
for (i = 0; i < PAGE_SIZE/4; ++i)
    FMC->DATA = src[i];
/* 3. Start program */
FMC->CR |= (1 << 31);      // START bit
while (FMC->RSR & 0x1);    // Wait for BUSY clear
```
- Programming latency ≤ 1.6 ms per 256 KB page (160 µs/KB).
- Erase latency ≤ 30 ms per 128 KB block.

### Wear‑Leveling Algorithm (deterministic steps)
1. Scan `wear_table[]` for the block with the **minimum erase count** (`min_erase`).
2. Allocate a fresh page in that block.
3. **Copy‑on‑write**: read source page → program destination page.
4. Update mapping table atomically (single flash write).

| Step | Max latency |
|------|--------------|
| Block selection | 2 µs (RAM lookup) |
| Page copy (256 KB) | 1.6 ms |
| Mapping update | 120 µs |
---
