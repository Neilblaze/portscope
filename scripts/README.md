# Utility Scripts

This directory contains utility scripts to start and manage dummy TCP listeners for testing or local development environments. They are specifically useful for testing how PortScope interacts with different process states.

## General Scripts

### `start-listener.sh`
Spawns a background or foreground listener and manages its PID via a file.
**Usage:** `./start-listener.sh [PORT] [NAME] [FOREGROUND]`

### `stop-listener.sh`
Kills the listener spawned by `start-listener.sh` using its saved PID file.
**Usage:** `./stop-listener.sh [NAME]`

---

## State Simulation Scripts

PortScope is designed to detect and manage different process states (like orphaned servers or paused ML environments). The following mock scripts allow you to simulate these exact conditions instantly:

### 1. `mock-healthy.sh`
Spawns a standard listener in the foreground. Since it is attached directly to the terminal, PortScope flags it correctly as `● healthy`.
**Usage:** `./mock-healthy.sh [PORT]` *(Defaults to 3010)*

### 2. `mock-orphaned.sh`
Spawns a listener inside a subshell and completely detaches it. Its Parent PID (PPID) becomes `1` (init/launchd), tricking PortScope into correctly categorizing it as `● orphaned`.
**Usage:** `./mock-orphaned.sh [PORT]` *(Defaults to 3020)*

### 3. `mock-multiple.sh`
Spawns a burst of multiple consecutive background listeners to easily test ranges and bulk actions like `portscope kill all`.
**Usage:** `./mock-multiple.sh [START_PORT] [COUNT]` *(Defaults to 3030 and 3 ports)*

### 4. `mock-paused.sh`
Spawns a background listener and immediately sends a `SIGSTOP` signal to freeze it. It simulates a suspended process (like a hibernated docker container) holding a port but consuming 0 CPU.
**Usage:** `./mock-paused.sh [PORT]` *(Defaults to 3040)*
