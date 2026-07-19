# Module 4: Hard RTOS Priority Inversion & Mutex Overrides
### Overview
- Demonstrates FreeRTOS priority‑inheritance mutex and RT‑Linux PI mutex.
- Shows NVIC interrupt‑priority registers and deterministic timing.

### FreeRTOS Mutex (Priority Inheritance)
```c
SemaphoreHandle_t xMutex = xSemaphoreCreateMutex();
configASSERT(xMutex);

/* Task A – low priority */
void vTaskA(void *pvParameters) {
    xSemaphoreTake(xMutex, portMAX_DELAY);
    /* critical section */
    vTaskDelay(pdMS_TO_TICKS(10));
    xSemaphoreGive(xMutex);
    vTaskDelete(NULL);
}

/* Task B – high priority */
void vTaskB(void *pvParameters) {
    xSemaphoreTake(xMutex, portMAX_DELAY);
    /* fast critical section */
    xSemaphoreGive(xMutex);
    vTaskDelete(NULL);
}
```
- When Task B blocks on `xMutex`, FreeRTOS raises Task A’s priority to Task B’s level.
- Execution latency (contended lock) ≤ 12 µs on Cortex‑M7 @ 216 MHz.

### RT‑Linux PI Mutex
```c
struct mutex pi_mutex;
static int __init pi_init(void)
{
    mutex_init(&pi_mutex);
    return 0;
}

static void critical_section(void)
{
    mutex_lock(&pi_mutex);   /* PI flag ensures priority inheritance */
    /* critical work */
    mutex_unlock(&pi_mutex);
}
```
- Kernel automatically boosts the holder’s priority to the highest blocked waiter.
- Worst‑case lock latency ≤ 8 µs on ARMv8‑A 1.5 GHz.

### NVIC Interrupt‑Priority Register Map (Cortex‑M)
| Register | Offset | Bits | Description |
|----------|--------|------|-------------|
| `IPR[n]` | 0xE000E400 + 4·n | 7:0 | Interrupt priority (0 = highest) |
| `ISER[n]`| 0xE000E100 + 4·n | 0   | Enable bit |
| `ICER[n]`| 0xE000E180 + 4·n | 0   | Disable bit |

### Deterministic Timing Table
| Operation | Max latency |
|-----------|-------------|
| Mutex lock (contended) | 12 µs |
| Mutex unlock | 3 µs |
| Context switch on priority boost | ≤ 1.5 µs |

### Override Example (FreeRTOS)
```c
/* Temporarily suppress inheritance */
vTaskPrioritySet(handle, configMAX_PRIORITIES - 1);
xSemaphoreGive(xMutex);
vTaskPrioritySet(handle, original_prio);
```
---
