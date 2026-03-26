# ShieldVault Development Roadmap

## 1. Goal and Constraints

### Goal
Deliver a hackathon-ready, working prototype of ShieldVault on Zama fhEVM that demonstrates confidential portfolio duels with selective reveal of final outcome.

### Time Constraint
Submission deadline: March 31, 2026
Current planning date: March 26, 2026

### Build Strategy
Focus on a narrow but complete vertical slice:
- Encrypted inputs
- Encrypted settlement logic
- Selective decryption of final result
- Usable frontend and clear demo narrative

## 2. MVP Definition

### Required MVP Features
1. Create duel with fixed parameters
   - Duel duration
   - Allowed assets list
   - Entry amount

2. Join duel and submit encrypted weights
   - Weights sum validation (either exact sum or normalized model)
   - Inputs encrypted client-side

3. Lock allocations at duel start

4. Settlement using encrypted computation
   - Compute encrypted PnL comparison
   - Determine encrypted winner flag

5. Decrypt only final winner output

6. Payout execution and duel finalization

7. Basic web UI
   - Create duel
   - Join duel
   - View status and result

### Explicitly Out of Scope for MVP
- Multi-party tournaments
- Frequent rebalance actions
- Advanced social features
- Complex referral systems

## 3. Workstreams

### A. Smart Contracts (fhEVM)
- Duel state machine and storage
- Encrypted weight storage (euint)
- Settlement compute path
- ACL and decryption permissions
- Payout and safety guards

### B. Frontend + Relayer Integration
- Duel creation and join forms
- Asset weight builder component
- Local encryption before tx submission
- Status and result display

### C. Data and Oracle Layer
- Price source abstraction
- Start/end snapshot retrieval
- Deterministic settlement inputs

### D. DevOps and QA
- Local environment scripts
- Test suite (happy paths + negative paths)
- Deployment scripts
- Demo environment prep

### E. Submission Assets
- README and architecture docs
- Threat model section
- Demo video script and recording

## 4. Day-by-Day Plan (March 26 to March 31)

## Day 1 - March 26: Foundation and Architecture Freeze

### Deliverables
- Final MVP scope locked
- Contract interfaces drafted
- Storage schema and duel lifecycle documented
- Repo scaffold complete

### Tasks
1. Create monorepo structure
   - contracts/
   - frontend/
   - docs/
   - scripts/

2. Define duel state machine
   - Created
   - Joined
   - Locked
   - Settling
   - Settled
   - Cancelled

3. Define encrypted data model
   - encrypted weights
   - encrypted score outputs
   - decryption request IDs

4. Write technical decision record for:
   - Weight precision standard (for example basis points)
   - Oracle source selection
   - Tie-break behavior

### Exit Criteria
- Team alignment on architecture
- No unresolved MVP scope questions

## Day 2 - March 27: Core Contract Implementation

### Deliverables
- Deployable duel contract skeleton
- Encrypted input storage and lifecycle actions

### Tasks
1. Implement createDuel and joinDuel logic
2. Add encrypted weight submission path
3. Enforce one submission per user
4. Implement duel start lock logic
5. Add events for frontend sync

### Exit Criteria
- End-to-end create/join flow works on local test network

## Day 3 - March 28: Encrypted Settlement + Selective Decryption

### Deliverables
- Encrypted PnL comparison pipeline operational
- Decrypt-final-result-only flow implemented

### Tasks
1. Implement settlement trigger
2. Integrate encrypted arithmetic and comparison
3. Add ACL checks for decryption rights
4. Connect KMS decryption request for final outcome
5. Implement payout distribution

### Exit Criteria
- At least one duel settles with correct winner and payout
- Strategies remain encrypted in chain-visible state

## Day 4 - March 29: Frontend Vertical Slice

### Deliverables
- Functional UI for complete duel lifecycle
- Relayer integration for client-side encryption

### Tasks
1. Build duel create/join screens
2. Build weight selection component
3. Add encryption hook before submit
4. Show duel progress and final result
5. Add robust error handling and loading states

### Exit Criteria
- Non-technical user can complete a duel flow in under 3 minutes

## Day 5 - March 30: QA, Hardening, and Documentation

### Deliverables
- Stable demo branch
- Complete README and technical docs

### Tasks
1. Test matrix execution
   - happy paths
   - malformed weights
   - duplicate submissions
   - timeout/cancellation path

2. Security pass
   - access controls
   - payout safety
   - edge-case state transitions

3. Write documentation
   - setup
   - architecture
   - privacy model
   - limitations and future work

4. Prepare demo script

### Exit Criteria
- No critical blockers
- Fresh-machine setup validated

## Day 6 - March 31: Submission and Demo Packaging

### Deliverables
- Final GitHub repository
- Demo video
- Submission form complete

### Tasks
1. Record demo:
   - duel creation
   - encrypted submissions
   - settlement
   - winner reveal only

2. Validate all links and instructions
3. Final polish of README and diagrams
4. Submit before deadline buffer (target at least 4 hours early)

### Exit Criteria
- Submission successfully accepted

## 5. Technical Milestones

### Milestone M1 - Encrypted Inputs Stored
Definition:
- User can submit encrypted weights and contract persists them without plaintext leakage.

### Milestone M2 - Encrypted Settlement Works
Definition:
- Contract computes winner from encrypted values and produces decryptable final result token.

### Milestone M3 - Full UX Loop
Definition:
- Frontend supports full duel flow and correctly reflects contract state.

### Milestone M4 - Submission-Ready Artifact
Definition:
- Repo, docs, and demo satisfy all challenge requirements.

## 6. Task Ownership Template

Use this minimal ownership model during execution:
- Lead Smart Contract Engineer: Contract logic, settlement pipeline, ACL
- Frontend Engineer: UX flow, relayer integration, wallet interactions
- Full-Stack/Infra Engineer: Deployments, scripts, QA automation
- Product/Documentation Lead: README, demo script, judging narrative

If team size is small, one person may hold multiple roles.

## 7. Risk Register and Mitigations

1. Risk: FHE settlement complexity delays implementation
   - Mitigation: Keep settlement formula minimal in MVP, avoid advanced rebalance logic.

2. Risk: Oracle integration instability
   - Mitigation: Predefine small supported asset list and deterministic pricing window.

3. Risk: Frontend encryption edge cases
   - Mitigation: Add strict input validation and deterministic weight encoding.

4. Risk: Submission-quality docs lag behind build
   - Mitigation: Document daily, not at the end.

5. Risk: Last-day regressions
   - Mitigation: Freeze features after Day 5 and only fix blockers.

## 8. Quality Gates

Before submission, require all checks:
- Contracts compile cleanly
- Core tests pass
- One command setup documented and verified
- Demo path runnable without manual patching
- README includes architecture, privacy model, and known limitations

## 9. Repository Deliverables Checklist

### Code
- contracts with fhEVM integration
- frontend with encryption flow
- deployment and utility scripts

### Documentation
- README with project overview and setup
- Architecture summary
- Threat model and privacy guarantees
- Tradeoffs and future roadmap

### Demo
- 3-5 minute video
- Optional live deployment link

## 10. Demo Script Outline (Suggested)

1. Introduce the privacy problem in public DeFi.
2. Create a duel with fixed assets.
3. Submit hidden allocations from two wallets.
4. Show that onchain state is encrypted.
5. Run settlement and reveal only winner.
6. Explain compliance-friendly selective disclosure model.
7. Close with next steps beyond hackathon.

## 11. Post-Hackathon Continuation Plan

If selected for accelerator or follow-on support:
- Add multi-player tournaments
- Add encrypted strategy vault templates
- Add institution-ready reporting endpoints
- Add deeper automation and autopilot rules

## 12. Definition of Done

ShieldVault is done for hackathon submission when:
1. The prototype demonstrates end-to-end confidential duel settlement.
2. Sensitive strategy details remain encrypted before, during, and after settlement.
3. The repository is clean, reproducible, and documented.
4. The demo clearly proves technical novelty and real-world relevance.
