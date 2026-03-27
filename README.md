# 🛡️ ShieldVault - Confidential Portfolio Duels on fhEVM

**Confidential Portfolio Duels for Onchain Finance**

ShieldVault is a privacy-preserving DeFi platform where two traders compete by building weighted asset portfolios. Using Zama's fhEVM (Fully Homomorphic Encryption), all portfolio compositions remain encrypted on-chain, and only the final duel winner is revealed.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/solidity-0.8.24-green.svg)
![Network](https://img.shields.io/badge/network-Zama_Devnet-purple.svg)

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Smart Contracts](#-smart-contracts)
- [Backend API](#-backend-api)
- [How It Works](#-how-it-works)
- [Privacy Model](#-privacy-model)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Functionality
- **🔒 Confidential Portfolios**: All asset weights encrypted using fhEVM's euint types
- **⚔️ 1v1 Duels**: Head-to-head portfolio performance competitions
- **🎯 Tiered Assets**: 50/50 split between Tier 1 (blue-chips) and Tier 2 (altcoins)
- **🏆 Encrypted Settlement**: Winner computed on encrypted data
- **👁️ Selective Disclosure**: Only final results revealed, strategies stay private
- **📊 Real-time Prices**: Pyth Network oracle integration for asset pricing

### Privacy Features
- Client-side encryption before submission
- On-chain encrypted storage (no plaintext exposure)
- FHE arithmetic for performance computation
- ACL-based selective decryption
- Compliance-aware privacy controls

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Future)                     │
│              React + fhEVM Client SDK + Wallet               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js)                     │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Event Indexer│  │ Pyth Oracle │  │  REST API        │   │
│  │   Service    │  │  Service    │  │  Endpoints       │   │
│  └──────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Smart Contracts (fhEVM Solidity)                │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ DuelFactory  │  │    Duel     │  │ AssetRegistry    │   │
│  │              │  │  (euint32)  │  │  (Tier Mgmt)     │   │
│  └──────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         Zama fhEVM (Devnet)  +  Pyth Network                │
│         Encrypted Computation  +  Price Feeds                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Tech Stack

### Smart Contracts
- **Solidity**: 0.8.24
- **fhEVM**: Zama's Fully Homomorphic Encryption library
- **Hardhat**: Development environment
- **TypeChain**: TypeScript bindings
- **OpenZeppelin**: Standard contract utilities

### Backend
- **Node.js**: 20.x with TypeScript
- **Express**: RESTful API framework
- **ethers.js**: Blockchain interaction
- **Pyth Network**: Decentralized oracle for price feeds
- **Node-Cache**: In-memory caching

### Testing
- **Chai**: Assertion library
- **Hardhat Test Runner**: Contract testing

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ShieldVault.git
cd ShieldVault
```

2. **Install contract dependencies**
```bash
cd contracts
npm install
```

3. **Install backend dependencies**
```bash
cd ../backend
npm install
```

4. **Configure environment variables**

Contracts:
```bash
cd contracts
cp .env.example .env
# Edit .env with your private key
```

Backend:
```bash
cd backend
cp .env.example .env
# Edit .env with deployed contract addresses
```

---

## 📜 Smart Contracts

### Contract Overview

#### **DuelFactory.sol**
Main factory contract for creating and managing duels.

**Key Functions:**
- `createDuel()`: Deploy a new duel with custom asset tiers
- `getDuelDetails()`: Query duel information
- `getUserDuels()`: Get all duels for a user

#### **Duel.sol**
Individual duel contract with encrypted portfolio logic.

**Key Functions:**
- `joinDuel()`: Opponent joins the duel
- `submitWeights()`: Submit encrypted portfolio weights
- `startSettlement()`: Trigger encrypted settlement computation
- `decryptWinnerCallback()`: Gateway callback to reveal winner

**Encrypted Data:**
- `euint32` for asset weights (basis points)
- `euint64` for performance scores
- `ebool` for winner determination

#### **AssetRegistry.sol**
Manages asset classifications and tier requirements.

**Key Functions:**
- `registerAssets()`: Register assets with tier classifications
- `getAssetInfo()`: Query asset metadata
- `getTierCounts()`: Get tier distribution

---

## 🖥️ Backend API

### Starting the Backend

```bash
cd backend
npm run dev  # Development mode with hot reload
npm run build  # Production build
npm start  # Production mode
```

### Environment Configuration

Required environment variables:
```env
# Server
PORT=3000
NODE_ENV=development

# Blockchain
ZAMA_RPC_URL=https://devnet.zama.ai
DUEL_FACTORY_ADDRESS=<deployed_address>

# Pyth Network
PYTH_PRICE_SERVICE_URL=https://hermes.pyth.network
```

---

## 🎮 How It Works

### Duel Lifecycle

```
1. CREATE ──→ 2. JOIN ──→ 3. SUBMIT ──→ 4. LOCK ──→ 5. SETTLE ──→ 6. PAYOUT
   │             │          WEIGHTS       │           │              │
Creator     Opponent      (encrypted)   Both      Encrypted      Winner
deploys      joins        portfolios   submitted  computation   receives
contract                   remain         ↓        on-chain       prize
                          private      Start             ↓
                                       timer       Decrypt
                                                   winner only
```

### Detailed Flow

1. **Duel Creation**
   - Creator defines entry amount, duration, and allowed assets
   - Assets are classified into Tier 1 (50%) and Tier 2 (50%)
   - Entry fee locked in contract

2. **Opponent Joins**
   - Opponent deposits matching entry amount
   - Both participants can now submit portfolios

3. **Weight Submission**
   - Each user encrypts their portfolio weights client-side
   - Weights submitted as encrypted integers (euint32)
   - Contract validates: total = 100%, Tier 1 = 50%, Tier 2 = 50%
   - Strategies never exposed in plaintext

4. **Duel Lock**
   - Auto-locks when both participants submit
   - Start and end timestamps recorded
   - No further modifications allowed

5. **Settlement**
   - After duration expires, anyone can trigger settlement
   - Contract fetches price snapshots from Pyth oracle
   - Computes encrypted weighted scores for both participants
   - Compares scores under encryption
   - Requests selective decryption of winner only

6. **Payout**
   - Winner receives total prize pool (2x entry amount)
   - Portfolio compositions remain encrypted forever

---

## 🔐 Privacy Model

### What Stays Private
✅ Individual asset weights (encrypted as euint32)
✅ Portfolio composition and strategy
✅ Intermediate performance calculations
✅ Individual scores (encrypted as euint64)

### What Gets Revealed
❌ Final duel winner (single decryption)
❌ Entry amounts (public)
❌ Duel metadata (duration, timestamps)

### Technical Implementation
- **Client-side encryption**: Uses fhEVM relayer SDK
- **On-chain storage**: euint types ensure ciphertext-only storage
- **FHE arithmetic**: Addition, multiplication on encrypted values
- **Gateway decryption**: Threshold KMS for selective reveal
- **ACL enforcement**: Access control lists prevent unauthorized decryption

---

## 🛠️ Development

### Compile Contracts

```bash
cd contracts
npm run compile
```

### Run Tests

```bash
npm run test
```

Expected output:
```
ShieldVault - Core Duel Lifecycle
  ✓ Should deploy with correct initial parameters
  ✓ Should create a duel with valid parameters
  ✓ Should allow opponent to join
  ✓ Should register assets with correct tiers
  ... (more tests)
```

### Local Development

1. **Start local fhEVM node** (if using local setup):
```bash
# Follow Zama's local fhEVM setup guide
```

2. **Deploy contracts**:
```bash
npm run deploy:local
```

3. **Start backend**:
```bash
cd ../backend
npm run dev
```

---

## 🚀 Deployment

### Deploy to Zama Devnet

1. **Configure private key**:
```bash
cd contracts
echo "PRIVATE_KEY=your_private_key_here" >> .env
```

2. **Deploy**:
```bash
npm run deploy:devnet
```

3. **Copy deployed addresses to backend**:
```bash
cd ../backend
echo "DUEL_FACTORY_ADDRESS=<factory_address>" >> .env
echo "ASSET_REGISTRY_ADDRESS=<registry_address>" >> .env
```

4. **Start backend**:
```bash
npm run build
npm start
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Endpoints

#### Health Check
```http
GET /health
```

#### Get Supported Assets
```http
GET /api/prices/supported

Response:
{
  "success": true,
  "symbols": ["BTC", "ETH", "SOL", ...],
  "count": 13
}
```

#### Get Asset Price
```http
GET /api/prices/:symbol

Example: GET /api/prices/BTC

Response:
{
  "success": true,
  "price": {
    "symbol": "BTC",
    "price": 67234.55,
    "publishTime": 1234567890
  }
}
```

#### Get Batch Prices
```http
POST /api/prices/batch
Content-Type: application/json

Body:
{
  "symbols": ["BTC", "ETH", "SOL"]
}

Response:
{
  "success": true,
  "prices": {
    "BTC": { "price": 67234.55, ... },
    "ETH": { "price": 3456.78, ... },
    "SOL": { "price": 123.45, ... }
  }
}
```

#### Get Duel Details
```http
GET /api/duels/:duelId

Response:
{
  "success": true,
  "duel": {
    "duelId": "0x...",
    "state": "Locked",
    "creator": "0x...",
    "opponent": "0x...",
    "entryAmount": "100000000000000000",
    "entryAmountFormatted": "0.1",
    "startTime": 1234567890,
    "endTime": 1234654290,
    "winner": null
  }
}
```

#### Check Settlement Status
```http
GET /api/duels/:duelId/can-settle

Response:
{
  "success": true,
  "canSettle": true,
  "duelId": "0x...",
  "state": "Locked",
  "endTime": 1234654290
}
```

---

## 🔒 Security

### Threat Model

**Mitigated Risks:**
- ✅ Front-running: Encrypted intent prevents MEV exploitation
- ✅ Strategy copying: Portfolios never revealed
- ✅ Data harvesting: No public alpha leakage

**Security Measures:**
- Reentrancy guards on payouts
- Access control on decryption pathways
- Input validation on weights
- Timeout and cancellation mechanisms

### Auditing Considerations
- Encrypted state validation
- Decryption request authorization
- Oracle manipulation safeguards
- Edge case state transitions

---

## 🗺️ Roadmap

### ✅ Phase 1: MVP (Current)
- [x] Core duel contracts with fhEVM
- [x] Tiered asset system (50/50 split)
- [x] Encrypted settlement logic
- [x] Pyth oracle integration
- [x] Backend API with event indexing
- [x] Comprehensive tests

### 🚧 Phase 2: Enhanced Features
- [ ] Frontend web application
- [ ] Multi-round tournaments
- [ ] Team duels (3v3, 5v5)
- [ ] Leaderboard system
- [ ] Historical analytics

### 🔮 Phase 3: Advanced Privacy
- [ ] Dynamic rebalancing (encrypted)
- [ ] Conditional strategies
- [ ] Privacy-preserving reputation
- [ ] Institutional compliance tools

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Zama** - fhEVM technology and development support
- **Pyth Network** - Decentralized oracle infrastructure
- **OpenZeppelin** - Secure contract libraries

---

## 📞 Contact & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/ShieldVault/issues)
- **Documentation**: See `docs/` directory for detailed guides
- **Demo Video**: Coming soon

---

Built with ❤️ for privacy-preserving DeFi

**ShieldVault** - *Where strategies stay secret, winners stay public*
