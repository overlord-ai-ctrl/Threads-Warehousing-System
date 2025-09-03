# Printer Down Runbook

## Overview
This runbook covers the steps to take when a thermal label printer goes offline or fails during operations.

## Immediate Actions

### 1. Check Printer Status
- Look for printer offline banner in the UI
- Verify printer is powered on and connected
- Check USB/network connection

### 2. Queue Management
- Labels will automatically queue when printer is offline
- Monitor queue depth in the status bar
- No duplicate labels will be created due to idempotency

### 3. User Experience
- Continue picking and packing orders
- Completed orders will show "Queued for Print" status
- Reprint button available for completed orders

## Recovery Steps

### 1. Printer Reconnection
- Reconnect USB cable or restart network connection
- Printer health check runs every 30 seconds
- UI will automatically update when printer comes back online

### 2. Queue Processing
- Queued labels will print automatically when printer is available
- Labels print in order of completion (FIFO)
- No manual intervention required

### 3. Verification
- Check that labels printed correctly
- Verify no duplicate labels were created
- Confirm order status updated to "Fulfilled"

## Fallback Options

### 1. Backup Printer
- If primary printer is permanently down, reroute to backup
- Use printer settings to change default printer
- All queued labels will print to new printer

### 2. Manual Reprint
- Use reprint function for any failed labels
- Labels cached locally for 24 hours
- No need to regenerate from Shopify

## Prevention

- Regular printer health monitoring
- Keep spare thermal labels on hand
- Test printer before high-volume operations
- Maintain printer firmware updates
