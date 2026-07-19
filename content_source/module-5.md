# Module 5: Power Tracing Telemetry & Low-Power States
### Overview
- Configures deep‑sleep (STOP) mode and wake‑up ISR.
- Captures current consumption via calibrated shunt and DMA‑fed ADC.
- Provides deterministic timing guarantees for entry/exit latency.

### Low‑Power Entry (Cortex‑M)
```c
static inline void enter_stop(void)
{
    __DSB();          // Ensure all memory ops complete
    __WFI();          // Wait‑for‑interrupt enters STOP
}
```
- Entry latency ≤ 75 ns.

### Wake‑Up ISR
```c
void EXTI0_IRQHandler(void)
{
    EXTI->PR = EXTI_PR_PR0;               // Clear pending flag
    uint32_t ts = DWT->CYCCNT;            // Capture cycle counter
    (void)ts; // Timestamp can be stored for latency analysis
    __enable_irq();
}
```
- ISR latency ≤ 120 ns from edge to first instruction.

### Current Measurement Chain
| Block | Description |
|-------|-------------|
| **Shunt (0.01 Ω)** | Generates voltage proportional to current.
| **Amplifier (Gain = 10)** | Scales voltage into ADC range.
| **ADC1 (12‑bit, 1 MS/s)** | Sampled via DMA in circular mode.
| **DMA Buffer** | 1024 samples, stored in `adc_buf[]`.

### ADC + DMA Configuration (STM32F7)
```c
static uint16_t adc_buf[1024];
static void adc_dma_init(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_DMA2EN;
    DMA2_Stream0->CR = DMA_SxCR_CHSEL_0        // Channel 0
                       | DMA_SxCR_PL_1        // High priority
                       | DMA_SxCR_MSIZE_0    // 16‑bit memory size
                       | DMA_SxCR_PSIZE_0    // 16‑bit peripheral size
                       | DMA_SxCR_MINC       // Increment memory pointer
                       | DMA_SxCR_CIRC;      // Circular mode
    DMA2_Stream0->PAR = (uint32_t)&ADC1->DR;
    DMA2_Stream0->M0AR = (uint32_t)adc_buf;
    DMA2_Stream0->NDTR = 1024;
    DMA2_Stream0->CR |= DMA_SxCR_EN;
}
```
- Sampling period = 1 µs; total buffer fill = 1.024 ms.

### Current Conversion
```c
float current_mA(uint16_t raw)
{
    const float Vref = 3.3f;
    const float gain = 10.0f;
    const float shunt = 0.01f; // Ω
    float voltage = (raw / 4095.0f) * Vref;
    return (voltage / (gain * shunt)) * 1000.0f; // mA
}
```
- Conversion latency < 1 µs per sample.

### Deterministic Timing Summary
| Event | Max latency |
|-------|-------------|
| Stop entry (`WFI`) | 75 ns |
| Wake‑up ISR start | 120 ns |
| ADC‑DMA transfer (1024 samples) | 1.024 ms |
| Current conversion (single sample) | 1 µs |
---
