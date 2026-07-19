# Module 9: Hardware Cryptographic Acceleration Engines
### Overview
- Shows AES and SHA engine register maps, DMA handshakes, and deterministic latency.
- Includes cache‑coherent buffer preparation and key zeroisation.

### AES Engine Register Map (ARM CryptoCell)
| Offset | Register | Bits | Function |
|--------|----------|------|----------|
| 0x00   | **CR**   | 0    | Engine enable (1 = on) |
| 0x04   | **SR**   | 0    | Status (0 = idle, 1 = busy) |
| 0x08‑0x1C | **KEY0‑KEY3** | 128 bits | AES‑128 key slots |
| 0x20‑0x2C | **DATA_IN0‑DATA_IN3** | 128 bits | Plain‑text block |
| 0x30‑0x3C | **DATA_OUT0‑DATA_OUT3** | 128 bits | Cipher‑text output |
| 0x40   | **CTRL** | 2:0  | Mode (0=ECB,1=CBC,2=CTR) |

### DMA Hand‑off for AES Input
```c
/* Configure DMA channel for 16 B block */
DMA_Channel->CCR = DMA_CCR_EN | DMA_CCR_MINC | DMA_CCR_TCIE;
DMA_Channel->CMAR = (uint32_t)plaintext;
DMA_Channel->CPAR = (uint32_t)&AES->DATA_IN0;
/* Start transfer */
DMA_Channel->CNDTR = 4; // 4×32‑bit words
```
- Transfer latency ≤ 0.8 µs per 16 B block.

### Encryption Sequence (deterministic)
```c
/* 1. Load key */
for (int i=0;i<4;i++) AES->KEY[i] = key[i];
/* 2. Enable engine */
AES->CR = 1;
/* 3. Start DMA */
start_dma();
/* 4. Poll for completion */
while (!(AES->SR & 0x1)) {}
/* 5. Read ciphertext */
for (int i=0;i<4;i++) ciphertext[i] = AES->DATA_OUT[i];
/* 6. Zeroise key */
for (int i=0;i<4;i++) AES->KEY[i] = 0;
```
- Worst‑case total latency ≤ 2 µs per block.

### SHA‑256 Engine Register Map (ARM CryptoCell)
| Offset | Register | Bits | Description |
|--------|----------|------|-------------|
| 0x100  | **HASH_CTRL** | 0 | Start (1) / Reset (0) |
| 0x104  | **HASH_STATUS** | 0 | Ready flag |
| 0x108‑0x124 | **HASH_IN0‑HASH_IN15** | 32‑bit each | 512‑bit message block |
| 0x128‑0x144 | **HASH_OUT0‑HASH_OUT7** | 32‑bit each | 256‑bit digest |

### SHA‑256 Processing (deterministic)
```c
/* Load message block */
for (int i=0;i<16;i++) HASH->IN[i] = block[i];
HASH->CTRL = 1;               // Start
while (!(HASH->STATUS & 0x1)) {}
/* Retrieve digest */
for (int i=0;i<8;i++) digest[i] = HASH->OUT[i];
```
- Latency ≤ 3 µs for a full 512‑bit block.
---
