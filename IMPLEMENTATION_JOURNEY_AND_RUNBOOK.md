# IndexFlow Implementation Journey and Runbook

## 1. Purpose of This Document

This file is the single source of truth for:

- What was implemented from start to current state
- Why certain design and deployment decisions were made
- Which commands to run for build, test, deployment, and local development
- What is fully on-chain versus what is fallback/off-chain analytics
- How to troubleshoot common issues
- What should be done next to reach production-grade reliability

This document is intentionally long and detailed so a new contributor can onboard without prior context.

## 2. Project Summary

IndexFlow is a duel platform for portfolio performance competition with a dual-track architecture:

- Encrypted track (fhEVM / privacy-preserving behavior)
- On-chain transparent track (Flow EVM + Pyth oracle updates)

The most recent sprint focused heavily on making the on-chain duel path work end-to-end and aligning backend + contracts + scripts + docs.

## 3. High-Level Timeline

### Phase A: Foundation and Architecture

- Designed duel lifecycle and dual-track architecture
- Defined asset/tier model and portfolio constraints
- Added initial docs and project skeleton

### Phase B: Contracts and Duel Lifecycle

- Added duel factory and duel contracts
- Added registry for asset metadata and tiers
- Implemented create/join/submit/activate/settle/payout lifecycle
- Added test scripts for fast validation

### Phase C: Oracle Integration

- Integrated Pyth price ids per asset
- Added Hermes fetch path for latest prices and update payloads
- Added on-chain Pyth update flow

### Phase D: Backend Integration

- Added backend service for on-chain duel interactions
- Added route handlers for all major duel operations
- Initialized on-chain service in backend app startup

### Phase E: Type and ABI Alignment

- Migrated price id typing to bytes32[] across factory/registry/service/script paths
- Fixed contract and TypeScript compile issues caused by mismatched signatures

### Phase F: Runtime Hardening

- Added stricter settlement guards
- Added batched Pyth update method for better reliability/gas behavior
- Updated deployment script to use correct Flow testnet Pyth address
- Added resilience in testing script for low-fund scenarios

### Phase G: Analytics UX in On-Chain Test Script

- Added clear start-price and end-price blocks
- Added portfolio return calculations and winner/outperformance banner
- Preserved analytics output even when chain settlement cannot complete

## 4. What Was Implemented (By Area)

### 4.1 Backend

#### Added/Updated

- Service to call on-chain duel contracts from backend
- Startup initialization for on-chain service
- New route endpoints:
  - create duel
  - join duel
  - submit portfolio
  - activate duel
  - settle duel
  - payout
  - get duel info
  - get participant portfolios
  - get user duels

#### Why It Matters

- Backend can now act as an API gateway for the full on-chain duel lifecycle
- Frontend can interact with standardized REST endpoints

### 4.2 Contracts

#### Type Consistency and ABI Corrections

- Standardized price ids as bytes32[] where appropriate
- Removed cross-layer ambiguity between address[] and bytes32[] price identifier forms

#### Settlement Robustness

- Added stronger preconditions before settlement
- Enforced lock ordering requirements (start prices before end prices)
- Improved deterministic behavior for price locking

#### Oracle Update Efficiency

- Added batch update method in consumer to reduce overhead and improve update success likelihood

### 4.3 Scripts

#### Deployment

- Updated on-chain deployment configuration for Flow testnet Pyth address
- Added env override to allow emergency switching without code changes

#### Testing

- Added and improved on-chain duel E2E script
- Added analytics output parity with 1-minute style reporting
- Added graceful fallback output when full settlement cannot run due operational constraints (for example insufficient gas)

### 4.4 Documentation

- Expanded root documentation set for deployment, quick start, roadmap, architecture, and summaries
- Added this file to provide long-form implementation narrative and operations handbook

## 5. Core Duel Lifecycle

1. Creator creates duel with entry amount and duration
2. Opponent joins with matching entry amount
3. Both participants submit portfolios
4. Duel activates
5. Start prices are locked
6. Duration elapses
7. End prices are locked and settlement executes
8. Winner determined
9. Payout executes

## 6. Important Clarification: On-Chain vs Hybrid vs Fallback

**STATUS: FULLY ON-CHAIN (PRECISION FIX VALIDATED)**

The current implementation is **100% on-chain end-to-end** with no fallback analytics.

### Historical Context (Why This Matters)
Earlier attempts showed hybrid behavior:
- Contract calls for create/join/submit/activate succeeded on-chain
- Start-price locking sometimes failed due to insufficient gas
- This fell back to off-chain analytics for settlement reporting

### Current Status (After Precision Fix - March 28, 2026)
All duels now execute fully on-chain:
- Create → Join → Submit × 2 → Activate → Lock Start → Lock End & Settle → Payout 
- **All 9 operations confirmed on-chain with transaction proofs** (tx hash, block, gas, explorer link)
- **Escrow properly held and released** on-chain (0.002 FLOW from contract to winner)
- **Winner determined by micro-precision comparison** (not basis-point truncation)
- **Preflight balance checks** prevent mid-test failures
- **Required factory address** prevents accidental use of old contracts

### Latest Verification Update (March 28, 2026 - Session Delta)
- Strict on-chain test script now prints **on-chain Pyth start/end snapshots** in the same run.
- Added per-asset price move output (start -> end and percentage change) for BTC, ETH, STRK, BNB, LINK.
- Fixed a decode bug that initially showed `$Infinity` values:
  - Cause: wrong tuple decode order for `PythConsumer.getPrice(...)`
  - Fix: decode as `(price, expo, timestamp)`
  - Result: Correct values such as `BTC: $66293.50` with `expo=-8`
- Settlement and payout remain strictly on-chain (no fallback analytics path reintroduced).

### Precise Return Demo Upgrade (March 28, 2026 - Final Delta)
- Added on-chain storage for precise returns in `DuelOnChain`:
  - `creatorReturnPrecise` (micro-bps)
  - `opponentReturnPrecise` (micro-bps)
- Added getter `getPreciseReturns()` so demos can show exact values used for winner selection.
- Updated strict test script to print precise returns first, with rounded bps shown second.
- Resolved the temporary `execution reverted` error in test output:
  - Cause: script called `getPreciseReturns()` against an older deployed factory.
  - Resolution: deployed updated contracts and refreshed `contracts/.env` addresses.

Latest deployment (supports precise getter):
- `FLOW_EVM_PYTH_CONSUMER=0x2cb43F3A3ad81CCe58B1Dd8EfbF4Fc2A508A3e2d`
- `FLOW_EVM_ASSET_REGISTRY=0xD65AAC9212079EA47190C276973B9D8Db72011Ce`
- `FLOW_EVM_DUEL_FACTORY=0xDed224d79666387036E5479Fe2Dc5eE025ec8b8d`

Validated strict on-chain result with precise output:
```
Final State: Settled
Winner: 0x509849Da53330510825D2E20555362B29a8a4100
Creator Return (Precise): 2373185 micro-bps
Opponent Return (Precise): 1305746 micro-bps
Creator Return (Rounded): 2 basis points
Opponent Return (Rounded): 1 basis points
```

Sample validated strict on-chain output after fix:
```
[DUEL TEST] Start Prices (Pyth On-Chain Snapshot)
  BTC: $66293.50 (raw=6629350000000, expo=-8)
  ETH: $1994.56 (raw=199455653402, expo=-8)
...
[DUEL TEST] End Prices (Pyth On-Chain Snapshot)
  BTC: $66301.47 (raw=6630147217378, expo=-8)
  ETH: $1994.43 (raw=199443000000, expo=-8)
...
[DUEL TEST] Pyth Price Changes During Duel:
  BTC: $66293.50 -> $66301.47 ↑ 0.0120%
  ETH: $1994.56 -> $1994.43 ↓ -0.0063%
```

### The Precision Bug (Now Fixed)
**Problem:** Settlement was comparing basis-point rounded values before winner determination, causing false ties when micro-differences truncated to the same basis points.

**Example of the bug:**
- Creator precise return: -1.3456 bps → rounds to -1
- Opponent precise return: -2.1234 bps → rounds to -2
- **Result: Creator won** (correctly)
- But in broken version, if both rounded to same bps, declared TIE (incorrectly)

**Solution:** Compare micro-basis-point values first (×1,000,000 precision), only round for display:
```solidity
int256 creatorReturnPrecise = calculatePortfolioReturnPrecise(creatorPortfolio);
int256 opponentReturnPrecise = calculatePortfolioReturnPrecise(opponentPortfolio);
if (creatorReturnPrecise > opponentReturnPrecise) {
  winner = creatorPortfolio.participant;  // Uses precise, not rounded
}
```

**Validated Test Run (Block 102196905):**
```
Creator Portfolio: BTC 30%, ETH 20%, STRK 10%, BNB 10%, LINK 30%
Opponent Portfolio: BTC 35%, ETH 15%, STRK 20%, BNB 15%, LINK 15%
---
Creator Return: -1 basis points  
Opponent Return: -2 basis points
Winner: Creator (0x509849Da53...)
Escrow Paid: 0.002 FLOW on-chain ✅
```

### Phrasing Going Forward
Use: "The duel executed fully on-chain with precision-based settlement (March 28, 2026). Winner was determined without fallback analytics."

## 7. Repository Structure (Operational View)

- backend: API layer and on-chain service integration
- contracts: Solidity contracts, deploy scripts, test scripts
- frontend: Next.js consumer-facing app
- docs: architecture, setup, API, contributing
- tests: contract lifecycle tests

## 8. Required Environment Variables

## 8.1 Root and Shared

- Keep chain RPC and private keys secure
- Never commit private keys

## 8.2 Contracts .env

- FLOW_EVM_RPC_URL
- FLOW_EVM_PRIVATE_KEY
- FLOW_EVM_PYTH_ADDRESS (optional override)
- FLOW_EVM_DUEL_FACTORY (for test scripts after deploy)

## 8.3 Backend .env

- PORT
- FLOW_EVM_RPC_URL
- FLOW_EVM_PRIVATE_KEY
- FLOW_EVM_DUEL_FACTORY
- PYTH_PRICE_SERVICE_URL

## 8.4 Frontend .env.local

- NEXT_PUBLIC_FLOW_EVM_RPC_URL
- NEXT_PUBLIC_DUEL_FACTORY
- NEXT_PUBLIC_CHAIN_ID
- Any wallet configuration fields used in app

## 9. Command Runbook

## 9.1 Install Dependencies

Root install (if needed):

npm install

Contracts:

cd contracts
npm install

Backend:

cd backend
npm install

Frontend:

cd frontend
npm install

## 9.2 Contracts Build and Test

Compile:

cd contracts
npm run compile

Unit tests:

cd contracts
npm run test

Create/join flow test:

cd contracts
npm run test-create-join-flow

One-minute duel style test:

cd contracts
npm run test-1min-duel

On-chain duel test:

cd contracts
npm run test-on-chain-duel

## 9.3 Deploy Commands

Deploy Flow EVM stack:

cd contracts
npm run deploy-flow-evm

Deploy on-chain flow stack:

cd contracts
npm run deploy-on-chain

Deploy encrypted flow (Zama track):

cd contracts
npm run deploy-zama-encrypted

Verify setup:

cd contracts
npm run verify-setup

Verify contracts on Flow testnet explorer (if configured):

cd contracts
npm run verify-flow-evm

## 9.4 Backend Run Commands

Development:

cd backend
npm run dev

Build:

cd backend
npm run build

Production run:

cd backend
npm start

Lint:

cd backend
npm run lint

## 9.5 Frontend Run Commands

Development:

cd frontend
npm run dev

Build:

cd frontend
npm run build

Production run:

cd frontend
npm run start

Lint:

cd frontend
npm run lint

## 10. API Workflow Validation

Use these endpoint flows in order when validating backend duel behavior:

1. Create duel
2. Join duel
3. Submit creator portfolio
4. Submit opponent portfolio
5. Activate duel
6. Wait for duration
7. Settle duel
8. Execute payout
9. Query duel info and user duel history

Recommended validation checks:

- State transition correctness
- Revert message quality for invalid states
- Funds movement correctness
- Winner consistency against expected return calculations

## 11. Known Issues and Observed Failure Modes

### 11.1 Insufficient Gas for Oracle Update

Symptoms:

- Start-price lock fails
- Error mentions insufficient funds for gas and transaction cost

Impact:

- On-chain settlement cannot proceed
- Script falls back to analytics mode

Resolution:

- Fund the signer used for oracle update and settlement operations
- Add preflight balance checks in script before execution

### 11.2 ABI Mismatch Between Script and Deployed Contract

Symptoms:

- Method invocation fails
- Incorrect parameter decoding or transaction revert

Impact:

- Duel creation or interaction breaks

Resolution:

- Ensure script ABI exactly matches deployed contract interface
- Re-deploy after signature updates
- Update all dependent service files

### 11.3 Oracle Address Misconfiguration

Symptoms:

- Price update calls fail despite valid payload

Resolution:

- Use documented Flow testnet Pyth address
- Keep env override for emergency migration

## 12. Troubleshooting Checklist

Before running tests:

1. Confirm correct network in Hardhat config
2. Confirm private key has enough FLOW for all test transactions
3. Confirm duel factory address in env points to latest deployment
4. Confirm Pyth address is correct for selected network
5. Confirm contracts compile cleanly
6. Confirm backend build passes

If on-chain settlement fails:

1. Check funding for creator and updater/opponent accounts
2. Check Hermes endpoint availability
3. Check Pyth update fee and payload compatibility
4. Re-run with additional gas buffer/funding
5. Verify start lock state was actually completed

## 13. Production Hardening Recommendations

1. Add strict mode to test scripts where fallback output is disabled and failure is immediate
2. Add preflight account balance enforcement for all required signers
3. Add retry strategy around oracle update retrieval and transaction submission
4. Add structured JSON logs for CI parsing
5. Add invariant tests for all state transitions
6. Add end-to-end regression suite with deterministic fixtures
7. Add health endpoints for backend dependency checks
8. Add dashboard metrics for settlement success ratio and oracle update latency
9. Add secure key management (vault or signer service)
10. Add CI pipeline with compile, test, lint, deployment sanity checks

## 14. Future Work Roadmap

## 14.1 Short-Term

- Finalize strict mode behavior in on-chain script
- Ensure 100 percent deterministic settlement in funded environment
- Add tests for failure conditions and revert reasons

## 14.2 Mid-Term

- Integrate frontend with full backend duel operations
- Add richer portfolio analytics and history views
- Add admin tools for asset and oracle configuration

## 14.3 Long-Term

- Multi-user tournament mode
- Leaderboards and seasonal competition
- Cross-chain expansion strategy
- Enhanced compliance and audit workflows

## 15. What to Include in Main README

If the main README is updated, include at minimum:

1. One-screen project overview with dual-track architecture
2. Quick start for all three layers: contracts, backend, frontend
3. Required env vars with examples
4. End-to-end command flow to run local validation
5. On-chain versus hybrid mode explanation
6. Common troubleshooting section
7. Link to full runbook (this file)
8. Security and key management warnings
9. Current status and known limitations
10. Future roadmap summary

## 16. Recommended Git Commit Strategy

For clean history and reviewability:

- Keep commit messages action-oriented
- Separate docs, backend, contracts, frontend, and test updates
- Avoid huge mixed commits
- Tag deployment and integration milestones clearly

Suggested commit title styles:

- docs: add dual-track implementation runbook
- backend: add on-chain duel service initialization
- contracts: standardize price ids as bytes32 arrays
- scripts: add resilient on-chain duel analytics output
- deploy: update flow testnet pyth configuration

## 17. Verification Matrix

Use this matrix for release readiness.

Contracts:

- Compile: pass
- Unit tests: pass
- On-chain duel script: pass in strict funded mode

Backend:

- Build: pass
- API smoke tests: pass
- Contract call flow: pass

Frontend:

- Build: pass
- Wallet connect: pass
- Duel API integration: pass

Infrastructure:

- Correct RPC and chain id: pass
- Oracle endpoint availability: pass
- Signer funding checks: pass

## 18. Communication Template for Current Status

Use this exact status statement when reporting latest observed run:

The run was hybrid. Contract operations succeeded through activation, but start-price lock failed due insufficient gas for oracle update. Because start lock did not complete, settlement and payout did not execute on-chain. The displayed winner/outperformance section came from off-chain analytics based on Hermes market prices.

## 19. Security Notes

1. Never commit private keys or seed phrases
2. Use separate funded wallets for deployer, updater, and test actors
3. Enforce least privilege on backend service keys
4. Validate all user input on API layer
5. Rate-limit sensitive endpoints

## 20. Final Checklist Before Push

1. Run contracts compile
2. Run backend build
3. Run targeted duel test script
4. Verify env addresses are current
5. Review git diff for secrets
6. Commit in clean logical groups
7. Push to remote branch
8. Create PR with summary and test evidence

## 21. Closing Summary

This implementation now has:

- End-to-end duel lifecycle support across contracts and backend
- Improved oracle update pathways with batch support
- Better settlement guardrails
- Better operational diagnostics
- Better reporting and analytics in the on-chain test script

The main remaining gap is operational reliability under low-balance conditions. Once funded strict mode consistently settles and executes payout on-chain, the path can be marked production-ready for beta.
