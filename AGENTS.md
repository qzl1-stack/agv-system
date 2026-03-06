# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

AGV (Automated Guided Vehicle) Real-Time Diagnosis & Remote Management System.
Four services must run for end-to-end development: **Redis**, **Backend** (Node.js/Express :3000), **Rule Engine** (C++ binary), and **Frontend** (Vite dev :5173). An optional AGV simulator (`backend/simulate_agv.js`) generates test data.

### Local dev environment configuration

Before starting the frontend dev server, update `frontend/env.development` to point to localhost:

```
VITE_API_TARGET=http://127.0.0.1:3000
VITE_MEDIA_HOST=127.0.0.1
```

Without this change, the Vite proxy forwards `/api` requests to the hardcoded remote IP in the file and SSE alerts will not appear in the UI.

### Starting services (order matters)

1. **Redis**: `redis-server --daemonize yes`
2. **Backend**: `cd backend && node server.js` (port 3000)
3. **Rule Engine**: `cd rule_engine_cpp/build && LD_LIBRARY_PATH=$PWD/_deps/hiredis-build:$LD_LIBRARY_PATH ./rule_engine`
4. **Frontend**: `cd frontend && npm run dev` (port 5173)
5. **Simulator** (optional): `cd backend && AGV_LOCAL_MODE=true node simulate_agv.js`

### Build caveats

- The C++ rule engine must be built with **GCC** (not Clang) because the default Clang in this environment cannot find C++ standard library headers. Use: `cmake .. -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++`
- The rule engine binary needs `LD_LIBRARY_PATH` set to find the hiredis shared library built by CMake FetchContent (located in `build/_deps/hiredis-build/`).
- A `libstdc++.so` symlink may be missing; fix with: `sudo ln -sf /usr/lib/x86_64-linux-gnu/libstdc++.so.6 /usr/lib/x86_64-linux-gnu/libstdc++.so`

### Standard commands

See `backend/package.json` (`npm start`) and `frontend/package.json` (`npm run dev`, `npm run build`) for standard scripts. The root `package.json` only holds shared dependencies (three, fast-xml-parser).

### Data flow

```
AGV Simulator → WebSocket → Backend → Redis queue (agv:raw_queue)
                                         ↓ (BLPOP)
                                   Rule Engine (C++)
                                         ↓ (PUBLISH agv:alert_channel)
                                   Redis pub/sub
                                         ↓ (SUBSCRIBE)
                                   Backend → SSE (/api/alerts) → Frontend
```
