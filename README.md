<div align="center">

<img src="public/app-icon.png" width="120" alt="DBolt Logo"/>

# DBolt

**Cross-platform SQL database client and AI data assistant supporting 70+ databases.**

**Free and Open Source | Privacy-First | Local and BYOK AI Integration**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?logo=apache)](LICENSE)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](https://github.com/ilystack/DBolt)
[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)](https://github.com/ilystack/DBolt)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](https://github.com/ilystack/DBolt)
[![Tauri v2](https://img.shields.io/badge/Tauri_v2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Vue 3](https://img.shields.io/badge/Vue_3-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)

</div>

---

DBolt is a lightweight, high-performance database client engineered with Tauri v2 (Rust) and Vue 3 + TypeScript. It provides a native, memory-efficient alternative to traditional Java and Electron-based database managers.

All capabilities, including Data Studio AI, Visual ER Diagrams, Schema Migrations, Multi-hop SSH Tunneling, and Model Context Protocol (MCP) server support, are fully accessible with no paywalls or feature gating.

---

## Comparison & Benchmarks

| Metric / Capability | DBolt | DBeaver Community | DataGrip | Beekeeper Studio |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime & Core** | Tauri v2 + Rust | Java / Eclipse RCP | JVM (IntelliJ Platform) | Electron / Node.js |
| **Cold Startup Time** | < 0.4s | 6s - 14s | 5s - 12s | 2s - 4s |
| **Idle Memory Footprint** | ~38 MB | 500 MB - 1.2 GB | 800 MB - 1.8 GB | 180 MB - 350 MB |
| **Installer Size** | ~18 MB | ~120 MB | ~650 MB | ~95 MB |
| **AI Privacy Architecture** | Zero Data Leak (Schema-only, Air-gapped Ollama) | None / Cloud Plugin | Cloud Only (JetBrains AI) | None / Paid Plugin |
| **Smart Mock Data Seeder** | Built-in 1-Click | Complex Wizard | Available | Paid Ultimate |
| **Explain Plan AI Advisor** | Built-in | Text / Visual Tree only | Visual Tree only | Basic |
| **Model Context Protocol (MCP)** | Built-in Local Server | No | No | No |
| **Multi-hop SSH Bastion** | Built-in | Built-in | Built-in | Paid Ultimate |
| **License & Price** | Apache 2.0 (100% Free) | GPL / Paid Enterprise | Paid Commercial | Community / Paid ($99/yr) |

---

## Key Features

* **Data Studio AI Assistant**
  * Context-aware SQL generation based on live database schema.
  * Strict Zero Data Leak Guard: row data is never uploaded; only schema structure is shared.
  * Direct integration with OpenAI, Anthropic, Gemini, DeepSeek, Ollama, LM Studio, and custom endpoints.
  * 100% air-gapped local model support for offline environments.

* **Visual Explain Plan & Query Optimizer**
  * Interactive tree and cost summaries for PostgreSQL, MySQL, and SQLite execution plans.
  * Automated bottleneck detection for unindexed sequential scans, heavy sorts, and stale statistics.
  * One-click recommended index DDL generation and AI query rewrite prompt builder.

* **Smart Mock Data Generator (1-Click Seeder)**
  * Context menu action on any table to generate synthetic test data matching column types and constraints.
  * Realistic generators for names, emails, UUIDs, phone numbers, timestamps, prices, and status enums.
  * Immediate direct batch insertion or preview in a new SQL query tab.

* **Lightweight Architecture**
  * Native system webview rendering powered by Tauri v2 and Rust.
  * Fast startup speed and lower memory footprint compared to Electron wrappers.

* **Broad Database Ecosystem (70+ Supported)**
  * **Native & Wire Drivers**: PostgreSQL, MySQL, SQLite, SQL Server, ClickHouse, MariaDB, CockroachDB, DuckDB, TimescaleDB, YugabyteDB.
  * **Enterprise & Cloud (via JDBC/HTTP bridges)**: Oracle, IBM DB2, Snowflake, Google BigQuery, Databricks, Trino, Presto, Firebird, SAP HANA, Teradata, Vertica.

* **Visual ER Diagram**
  * Interactive relational diagrams automatically mapped from table foreign keys and schema metadata.

* **Cross-Engine Data Transfer**
  * Export, import, and bulk migrate data across heterogeneous database engines with automated data type translation.

* **Secure Connection Management**
  * Multi-hop SSH bastion tunnels, SSL/TLS parameter control, and secure credential handling.

* **Model Context Protocol (MCP) Bridge**
  * Embedded local MCP server allowing external AI clients (Claude Desktop, Cursor, and IDE extensions) to safely query configured connections.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Core** | Rust 2021, Tauri v2, Tokio, Rusqlite, MySQL Async, Deadpool Postgres, Tiberius |
| **Frontend UI** | Vue 3, TypeScript, Pinia, Monaco Editor, Tailwind CSS / UnoCSS, Radix Vue |
| **Extended Drivers** | Optional embedded Java JDBC bridge runner for legacy and enterprise database connectivity |

---

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) `>= 18`
* [Rust toolchain](https://rustup.rs/) (edition 2021)
* Platform build prerequisites:
  * **Windows**: Visual Studio C++ Build Tools
  * **macOS**: Command Line Tools (`xcode-select --install`)
  * **Linux**: `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libssl-dev`

### Development

```bash
# 1. Install frontend dependencies
npm install

# 2. Run Vite frontend dev server
npm run dev

# 3. Launch native desktop application in dev mode
npm run tauri dev
```

### Production Build

```bash
# Generate native platform installer and executables
npm run tauri build
```

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).  
Copyright (c) DBolt Contributors.
