# Threads Ops - Desktop Warehouse Management

Threads Ops is a powerful desktop application for warehouse management, built with Electron, React, and TypeScript. It provides multi-brand Shopify operations, KDS-style queue management, offline-first capabilities, and integrated hardware support for barcode scanners and thermal label printers.

## Features

- 🏪 **Multi-brand Shopify Integration** - Manage multiple stores from one app
- 📱 **KDS-style Queue** - Pick and pack with timers and SLA management
- 🖨️ **Hardware Integration** - Barcode scanners and thermal label printers
- 🔌 **Offline-first** - Local job queue with safe retries and idempotency
- 🏷️ **Label Management** - Shopify native labels with fallback to Shippo/EasyPost
- 📊 **Real-time Dashboards** - Master and brand-specific views with KPIs
- 🔒 **Secure** - OS keychain storage, encrypted local database

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your Supabase credentials
3. Install dependencies: `npm install`
4. Start development: `npm run dev:renderer`

## Dev Commands

```bash
# Start renderer (frontend)
npm run dev:renderer

# Start cloud server
npm run dev:cloud

# Start both (full stack)
npm run dev:full

# Run self-check
npm run selfcheck

# Lint and type check
npm run check

# Build for production
npm run build
```

## Environment Variables

Required environment variables (see `.env.example`):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key (for cloud)

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron with hardware integration
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Local Storage**: SQLite with encryption
- **Hardware**: ZPL/PDF printing, HID barcode scanning

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run check` to ensure quality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
