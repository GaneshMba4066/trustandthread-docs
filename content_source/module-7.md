# Module 7: Zero-Copy Network Stack Network Drivers
### Overview
- DMA ring buffer layout for Rx/Tx.
- Zero‑copy packet delivery to the Linux network stack.
- Interrupt throttling configuration.

### DMA Ring Buffer Descriptor (generic)
| Field | Size (bytes) | Description |
|-------|--------------|-------------|
| `buf_addr` | 8 | Physical address of packet buffer |
| `len`      | 2 | Length of received/transmitted frame |
| `status`   | 2 | Ownership and error flags |

### Rx Path (Zero‑Copy) – kernel driver snippet
```c
static int rx_poll(struct napi_struct *napi, int budget)
{
    while (budget--) {
        struct rx_desc *desc = &rx_ring[rx_head];
        if (desc->status & OWNED_BY_DMA) break;

        /* Hand buffer directly to networking core */
        netif_receive_skb(desc->skb);
        desc->status = OWNED_BY_DMA;
        rx_head = (rx_head + 1) % RX_RING_SIZE;
    }
    napi_complete_done(napi, budget);
    return 0;
}
```
- No memcpy; the skb points to the DMA buffer.

### Tx Path – zero‑copy submit
```c
static netdev_tx_t tx_submit(struct sk_buff *skb, struct net_device *dev)
{
    struct tx_desc *desc = &tx_ring[tx_tail];
    desc->buf_addr = virt_to_phys(skb->data);
    desc->len = skb->len;
    desc->cmd = CMD_EOP | CMD_IC;   // End‑of‑packet, interrupt on completion
    desc->status = OWNED_BY_DMA;
    tx_tail = (tx_tail + 1) % TX_RING_SIZE;
    writel(TX_START, DMA_TX_START_REG); // Kick DMA engine
    return NETDEV_TX_OK;
}
```

### Interrupt Throttling (Intel 82599 example)
```c
/* REG_RINT_DELAY controls interrupt delay in 2 µs units */
writel(0x3C, REG_RINT_DELAY);   // 120 µs delay
```
- Guarantees ≤ 1.2 µs per packet after throttling.

### Deterministic Performance Bounds
| Metric | Max latency |
|--------|-------------|
| Packet Rx → socket queue | ≤ 3 µs |
| Packet Tx completion | ≤ 4 µs |
| Interrupt handling (post‑throttle) | ≤ 1.2 µs |
---
