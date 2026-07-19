# Module 6: Cache Line Invalidation & Multi-Core Snooping
### Overview
- Shows ARMv8‑A `dsb`, `isb` barriers and explicit cache maintenance.
- Demonstrates SMP core synchronization with spinlocks.
- Provides precise timing for cache line operations.

### Memory Barriers (ARMv8‑A)
| Barrier | Instruction | Effect |
|---------|-------------|--------|
| Full system barrier | `dsb ish` | Order all memory accesses system‑wide |
| Instruction sync | `isb` | Flush pipeline, ensure subsequent instructions see updated state |
| Store barrier | `dmb ishst` | Order only stores before the barrier |

### Cache Maintenance API (Linux)
```c
void clean_invalidate_dcache_range(void *addr, size_t size)
{
    flush_cache_range(addr, size);
}
```

### SMP Core Synchronization Pattern
```c
/* Core 0 */
spin_lock(&sync_lock);
write_shared_data();
ds b ish;               /* Ensure write visible */
spin_unlock(&sync_lock);

/* Core 1 */
spin_lock(&sync_lock);
ds b ish;               /* Wait for prior stores */
read_shared_data();
spin_unlock(&sync_lock);
```

### Cache Line Table (ARM Cortex‑A53 64‑byte line)
| Line | Address Range | State (before) | State (after) |
|------|---------------|----------------|---------------|
| 0 | 0x8000_0000 – 0x8000_003F | Invalid | Modified |
| 1 | 0x8000_0040 – 0x8000_007F | Shared | Exclusive |
| … | … | … | … |

### Deterministic Invalidation Sequence
1. **Invalidate line**: `dc ivac, <addr>` → 30 ns.
2. **Clean line**: `dc cvac, <addr>` → 30 ns.
3. **Barrier**: `dsb ish` → 10 ns.

### Inline Assembly (C, no_std)
```c
static inline void invalidate_line(void *addr)
{
    __asm__ volatile ("dc ivac, %0" :: "r"(addr) : "memory");
    __asm__ volatile ("dsb ish");
}
```
---
