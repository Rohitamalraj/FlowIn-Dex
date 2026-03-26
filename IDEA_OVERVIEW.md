# ShieldVault - Confidential Portfolio Duels on fhEVM

## 1. Executive Summary

ShieldVault is a confidential onchain competition platform where two traders build weighted asset indexes and duel based on performance over a fixed time window. Unlike traditional DeFi apps, each trader's portfolio composition, weights, and collateral-sensitive parameters remain encrypted at all times.

The protocol computes performance and determines a winner directly on ciphertext using Zama Protocol (fhEVM), then selectively decrypts only the final duel outcome.

This combines:
- Confidential compute (FHE)
- Solidity-native development flow
- Consumer-grade DeFi UX (simple index builder, low cognitive load)
- Compliance-aware privacy controls

## 2. Problem Statement

Public blockchains expose financial behavior by default. This creates major adoption barriers:

1. Front-running risk
   - Bots can monitor pending transactions and exploit exposed intent.

2. Strategy leakage
   - Portfolio composition and timing become public alpha for competitors.

3. Institutional and regulated-user exclusion
   - Asset managers and regulated entities often require confidentiality by law or policy.

Existing approaches are incomplete:
- Mixer-style privacy can break compliance and auditability requirements.
- Some ZK approaches hide parts of data flow, but protocol logic is often circuit-constrained and not naturally flexible for iterative product logic.

## 3. Core Product Concept

### Product Name
ShieldVault

### Tagline
Confidential Portfolio Duels for Onchain Finance.

### User Flow
1. Two users enter a duel market.
2. Each user builds a weighted index (example: 40% BTC, 30% ETH, 30% stables).
3. All sensitive inputs are encrypted client-side before submission.
4. Smart contracts store encrypted allocations and execute encrypted PnL computation.
5. At settlement, only the final duel result is decrypted (winner, optional score delta).
6. Individual strategies remain private.

### Why It Is Novel
Most DeFi games and index products are transparent by default. ShieldVault provides competitive finance primitives without exposing strategies, enabling new behavior from:
- Serious retail users
- Quant communities
- Treasury teams
- Institutional participants

## 4. Technical Design Using Zama fhEVM

ShieldVault is architected around native fhEVM components:

### 4.1 Encrypted Onchain State via euint Types
- Store index weights and selected duel parameters as encrypted integers (for example euint32).
- No plaintext strategy data is ever written to public state.
- Contract operations use FHE operators directly on encrypted values.

Example conceptual state:
- encryptedWeight[user][asset] -> euint32
- encryptedCollateral[user] -> euint64
- encryptedPnL[user] -> euint64

### 4.2 Encrypted Arithmetic and Comparison
The contract computes weighted performance under encryption:
- Weighted returns aggregation
- Relative performance comparison
- Winner flag generation

All performed on encrypted values until authorized decryption of final output.

### 4.3 Coprocessor for Heavy FHE Operations
Complex FHE operations are delegated through the fhEVM coprocessor path:
- Off-chain cryptographic compute execution
- Verifiable result return to chain
- Practical performance for multi-asset encrypted calculations

### 4.4 KMS + Threshold MPC for Selective Reveal
At settlement, the contract requests decryption only for approved outputs:
- Final duel winner
- Optional aggregate duel score

Not decrypted:
- Raw index composition
- Per-asset user weights
- Full strategy traces

### 4.5 ACL-Governed Data Access
Access Control List policies define who can decrypt which outputs:
- Trader: optional access to their own summary metrics
- Protocol: only approved settlement outputs
- Auditor/regulator role (if enabled): restricted aggregate reporting

This creates privacy with controlled accountability.

### 4.6 Relayer SDK for Client-Side Encryption
The frontend encrypts duel inputs before contract submission:
- Users interact with a clean UI
- Encryption happens behind the scenes
- Sensitive values never leave client plaintext context

## 5. System Architecture

### Components
1. Frontend App
   - Index builder UX
   - Duel creation/join flows
   - Local encryption and tx orchestration

2. ShieldVault Smart Contracts (fhEVM Solidity)
   - Duel lifecycle management
   - Encrypted state storage
   - Encrypted settlement logic
   - ACL and decryption request policies

3. Price and Oracle Adapter Layer
   - Reliable asset pricing snapshots for start/end windows
   - Deterministic duel settlement inputs

4. Off-chain Services
   - Matchmaking indexer
   - Notification service
   - Analytics layer with privacy-preserving aggregates

## 6. Duel Lifecycle

1. Duel Creation
   - Creator chooses universe, duration, entry constraints.

2. Duel Entry
   - Opponent joins and submits encrypted weights.

3. Lock Phase
   - Inputs become immutable after duel start.

4. Evaluation Window
   - Oracle snapshots track market movement.

5. Encrypted Settlement
   - Contract computes encrypted PnL and encrypted winner indicator.

6. Selective Decryption
   - KMS decrypts only authorized final result.

7. Payout and Record
   - Rewards distributed, duel finalized, strategy remains confidential.

## 7. Security and Threat Model

### Targeted Risks Mitigated
- Public strategy copying
- Mempool opportunistic exploitation tied to visible intent
- Data harvesting by passive observers

### Additional Security Considerations
- Reentrancy protection in payout flows
- Oracle manipulation safeguards and time-weighted validation
- Duel timeout and dispute resolution mechanisms
- Anti-griefing deposits and cancellation rules

### Privacy Integrity Goals
- Never persist sensitive allocations in plaintext onchain
- Minimize decryption surface to outcome-level data
- Enforce ACL checks on every decryption pathway

## 8. Compliance and Regulatory Positioning

ShieldVault is designed for compliance-aware privacy:
- Confidential user strategy by default
- Selective disclosure for legitimate oversight paths
- Audit-friendly settlement proofs without public strategy exposure

This aligns with challenge emphasis on compliance awareness and practical confidentiality models in onchain finance.

## 9. Why This Stands Out vs Alternatives

### Public DeFi Products
- Expose full strategy and balances
- High alpha leakage
- Weak institutional suitability

### Typical Privacy Wrappers
- Often difficult to integrate with standard Solidity workflows
- May limit programmability or UX flexibility

### ShieldVault + fhEVM
- Solidity-native development model
- Compute directly on encrypted state
- Flexible application logic over time
- Better path to real consumer and institutional adoption

## 10. Fit for Hackathon Judging Criteria

### Innovation
- Confidential competitive index finance, not only private transfers.

### Compliance Awareness
- ACL-based selective disclosure and role-aware decryption boundaries.

### Real-World Potential
- Applicable to copy-trading resistance, managed products, and private strategy contests.

### Technical Implementation
- Direct use of euint types, encrypted arithmetic, KMS decryption gating, and relayer-based encryption.

### Production Readiness
- Modular architecture, explicit threat model, and extensible duel framework.

### Usability
- Consumer-first UI abstractions with cryptography hidden from end users.

## 11. Consumer DeFi UX Layer (IndexForge Synergy)

ShieldVault can ship with a mainstream UX wrapper:
- Playlist-like index construction
- Plain-language goals and presets
- Minimal signing friction
- Optional sponsored gas path
- Progress and confidence indicators instead of cryptography terms

Result: users experience simple finance actions while privacy guarantees are enforced under the hood.

## 12. Demo Narrative for Judges

A strong demo sequence:
1. Two traders create duels with different hidden allocations.
2. Show chain explorer state proving encrypted values only.
3. Run settlement.
4. Reveal only final winner and payout.
5. Confirm no plaintext strategy data is exposed before or after settlement.

Key message:
"The protocol can evaluate financial competition without ever revealing the underlying strategies."

## 13. Suggested Scope for Hackathon Submission

### In Scope for MVP
- 1v1 duel contract
- 3-5 asset universe
- Encrypted weights and encrypted winner computation
- Final winner decryption only
- Basic web app for duel creation and participation

### Optional Stretch Goals
- Multi-round tournaments
- Team duels
- Dynamic rebalancing under encrypted constraints
- Reputation and leaderboard system using privacy-preserving aggregates

## 14. Submission Checklist Alignment

For a strong Zama track submission:
- Working fhEVM prototype
- Public GitHub repo with source code
- Setup instructions and full README
- Clear architecture docs and threat model
- Demo video or live demo showing encrypted lifecycle end-to-end

## 15. One-Line Pitch

ShieldVault enables private-by-default onchain portfolio competition by computing duel outcomes directly on encrypted strategies with fhEVM, revealing only what must be known and nothing else.
