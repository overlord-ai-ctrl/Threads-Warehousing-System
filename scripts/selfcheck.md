# Threads Ops Self-Check Commands

This document contains the self-check commands that Cursor can run to verify system health and functionality.

## 1. Desktop Persistence and Encryption Audit

### Check OS Keychain Integration
```bash
# macOS
security find-generic-password -s "threads-ops" -a "threads-alliance" 2>/dev/null && echo "✅ Keychain accessible" || echo "❌ Keychain not accessible"

# Windows (PowerShell)
Get-StoredCredential -Target "threads-ops" | Select-Object UserName, Password | Format-List
```

### Verify Database Encryption
```bash
# Check if SQLite database is encrypted
sqlite3 threads-ops.db "PRAGMA cipher_version;" 2>/dev/null && echo "✅ Database encrypted" || echo "❌ Database not encrypted"
```

### Check Log Redaction
```bash
# Search for potential PII in logs
grep -r "email\|phone\|address\|credit" logs/ | head -10
# Should return no results or only redacted data
```

## 2. Printer Offline Simulation Test

### Simulate Printer Offline
```bash
# Stop print spooler (Windows)
net stop spooler

# Or disconnect printer
# Then attempt to print a test label
npm run simulate:printerdown
```

### Verify Offline Behavior
- [ ] Banner shows printer offline
- [ ] Labels are queued
- [ ] No duplicate side effects
- [ ] Manual re-route to backup printer works

## 3. Network Offline Simulation

### Simulate Network Disconnection
```bash
# Disconnect network
# macOS
sudo ifconfig en0 down

# Windows
netsh interface set interface "Wi-Fi" admin=disable
```

### Test Offline Functionality
- [ ] App continues to work
- [ ] Orders can be picked offline
- [ ] Changes are queued locally
- [ ] Sync resumes when online

## 4. Upgrade and Rollback Test

### Force Crash Loop
```bash
# Simulate repeated crashes
npm run simulate:crashloop
```

### Verify Rollback
- [ ] App rolls back to previous version
- [ ] No data loss occurs
- [ ] Migrations are idempotent
- [ ] User is notified of rollback

## 5. Scanner Performance Test

### High-Volume Scan Test
```bash
# Generate 100 test scans
npm run simulate:scanflood
```

### Verify Performance
- [ ] No UI freeze during scanning
- [ ] Correct order locking
- [ ] Scan rate: 100+ scans/minute
- [ ] Memory usage stable

## 6. Kiosk Mode Verification

### Windows Kiosk Mode
```bash
# Check kiosk mode registry
reg query "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "EnableAutoTray"
```

### macOS Kiosk Mode
```bash
# Check launch agent
launchctl list | grep threads-ops
```

### Verify Kiosk Features
- [ ] Full screen mode
- [ ] Hotkeys work (N, D, I, S, P, numbers)
- [ ] Auto-launch on startup
- [ ] No escape from kiosk mode

## 7. Multi-Tenant Security Check

### Verify Shop Domain Isolation
```bash
# Check database queries include shop_domain
grep -r "shop_domain" src/ --include="*.ts" --include="*.tsx"
```

### Test Brand Isolation
- [ ] User can only access assigned brands
- [ ] Queries filter by brand_id
- [ ] No cross-brand data leakage
- [ ] Proper role-based access control

## 8. Hardware Integration Test

### Printer Health Check
```bash
# Test printer connectivity
npm run test:printer
```

### Scanner Health Check
```bash
# Test scanner functionality
npm run test:scanner
```

### Verify Hardware Status
- [ ] Printer heartbeat working
- [ ] Scanner auto-detection
- [ ] Fallback mechanisms
- [ ] Error handling

## 9. Offline Queue Test

### Test Offline Operations
```bash
# Disconnect network and perform operations
npm run simulate:offline
```

### Verify Queue Behavior
- [ ] Jobs are queued locally
- [ ] Retry logic works
- [ ] No duplicate submissions
- [ ] Sync prioritization

## 10. Performance Benchmark

### Run Performance Tests
```bash
npm run test:performance
```

### Check Metrics
- [ ] Order processing: 50+ orders/hour
- [ ] Label generation: <5 seconds
- [ ] Memory usage: <500MB
- [ ] CPU usage: <30% average

## 11. Security Validation

### Check Code Signing
```bash
# macOS
codesign -dv --verbose=4 Threads\ Ops.app

# Windows
signtool verify /pa "Threads Ops.exe"
```

### Verify Notarization (macOS)
```bash
spctl --assess --type exec --verbose Threads\ Ops.app
```

## 12. Integration Test

### End-to-End Test
```bash
npm run test:e2e
```

### Test Complete Workflow
- [ ] Order received from Shopify
- [ ] Pick and pack process
- [ ] Label generation and printing
- [ ] Order fulfillment
- [ ] Inventory update

## Running All Tests

To run the complete self-check suite:

```bash
npm run selfcheck
```

This will execute all tests and generate a comprehensive report.

## Expected Results

All tests should pass with:
- ✅ Green checkmarks for success
- ❌ Red X marks for failures
- 📊 Performance metrics within acceptable ranges
- 🔒 Security validations passed
- 🖨️ Hardware integrations working
- 🌐 Offline functionality operational

## Troubleshooting

If any test fails:
1. Check the error logs
2. Verify environment configuration
3. Ensure all services are running
4. Check hardware connections
5. Review network connectivity
6. Consult the troubleshooting guide
