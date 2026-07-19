# Module 3: Linux Driver Hooks & DMA Ring Buffers
### Overview
- Register a character device with `cdev_add`.
- Implement `mmap` to expose a DMA‑capable buffer to user space.
- Ensure cache coherency with `dma_map_*`/`dma_unmap_*`.

### Device Registration
```c
static dev_t dev_num;
static struct cdev dma_cdev;
static struct class *dma_class;

/* Probe called by platform driver */
static int dma_probe(struct platform_device *pdev)
{
    int ret;
    struct device *dev = &pdev->dev;

    /* Allocate device numbers */
    ret = alloc_chrdev_region(&dev_num, 0, 1, "dma_char");
    if (ret) return ret;

    cdev_init(&dma_cdev, &dma_fops);
    dma_cdev.owner = THIS_MODULE;
    ret = cdev_add(&dma_cdev, dev_num, 1);
    if (ret) goto err_unreg;

    dma_class = class_create(THIS_MODULE, "dma_class");
    if (IS_ERR(dma_class)) { ret = PTR_ERR(dma_class); goto err_cdev; }

    device_create(dma_class, dev, dev_num, NULL, "dma0");
    return 0;

err_cdev:
    cdev_del(&dma_cdev);
err_unreg:
    unregister_chrdev_region(dev_num, 1);
    return ret;
}
```

### `mmap` Implementation
```c
static int dma_mmap(struct file *filp, struct vm_area_struct *vma)
{
    unsigned long phys_addr;
    unsigned long size = vma->vm_end - vma->vm_start;

    /* Physical address of pre‑allocated DMA buffer */
    phys_addr = virt_to_phys(dma_buffer);

    /* Align to page size */
    if (size > DMA_BUFFER_SIZE) return -EINVAL;

    /* Map to user space */
    if (remap_pfn_range(vma,
                        vma->vm_start,
                        phys_addr >> PAGE_SHIFT,
                        size,
                        vma->vm_page_prot))
        return -EAGAIN;

    /* Ensure CPU sees latest data */
    dma_sync_single_for_cpu(&pdev->dev,
                            phys_addr,
                            size,
                            DMA_FROM_DEVICE);

    return 0;
}
```

### Register Layout (STM32F7 DMA Controller)

| Offset | Register | Bits | Description |
|--------|----------|------|-------------|
| 0x00   | **DMA_SxCR** | 31:0 | Stream control (EN, DIR, PSIZE, MSIZE, MINC, CIRC) |
| 0x04   | **DMA_SxNDTR** | 15:0 | Number of data items to transfer |
| 0x08   | **DMA_SxPAR** | 31:0 | Peripheral address |
| 0x0C   | **DMA_SxM0AR** | 31:0 | Memory 0 address |
| 0x10   | **DMA_SxFCR** | 31:0 | FIFO control & threshold |

### Cache Coherency Fence (ARMv8‑A)
```c
/* Flush CPU cache lines that back the DMA buffer */
static inline void dma_flush_cache(void *addr, size_t size)
{
    __asm__ volatile ("dc cvac, %0" :: "r"(addr) : "memory");
    __asm__ volatile ("dsb ish");
    __asm__ volatile ("isb");
}
```

### Execution Timing
- **DMA Transfer Initiation**: ≤ 2 µs (programming registers).
- **Data Arrival Interrupt**: ≤ 150 ns latency from peripheral request.
- **User‑Space Read**: `mmap` returns in ≤ 5 µs on a 3 GHz Cortex‑A57.
