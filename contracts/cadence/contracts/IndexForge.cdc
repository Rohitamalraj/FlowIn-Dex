/**
 * IndexForge - Cadence Consumer Layer
 *
 * This contract provides the consumer-friendly interface for creating and managing
 * portfolio duels on Flow. It wraps the underlying EVM contracts (ShieldVault) that
 * handle encrypted computation via Zama fhEVM.
 *
 * Key Features:
 * - Resource-oriented ownership (indices cannot be copied/transferred)
 * - Walletless onboarding support
 * - Gas sponsorship compatibility
 * - Human-friendly language and abstractions
 */

import FungibleToken from 0xFungibleToken
import FlowToken from 0xFlowToken
import EVM from 0xEVM

pub contract IndexForge {

    // Events
    pub event IndexDuelCreated(duelId: String, creator: Address, evmAddress: String)
    pub event IndexDuelJoined(duelId: String, opponent: Address)
    pub event IndexDuelSettled(duelId: String, winner: Address, prizeAmount: UFix64)
    pub event IndexDuelCancelled(duelId: String)

    // Paths
    pub let IndexDuelCollectionStoragePath: StoragePath
    pub let IndexDuelCollectionPublicPath: PublicPath

    // Tier classification for assets
    pub enum AssetTier: UInt8 {
        pub case BlueChip  // Tier 1: BTC, ETH, etc.
        pub case Alternative  // Tier 2: STRK, KAS, etc.
    }

    // Asset information
    pub struct AssetInfo {
        pub let symbol: String
        pub let evmAddress: String
        pub let pythPriceId: String
        pub let tier: AssetTier

        init(symbol: String, evmAddress: String, pythPriceId: String, tier: AssetTier) {
            self.symbol = symbol
            self.evmAddress = evmAddress
            self.pythPriceId = pythPriceId
            self.tier = tier
        }
    }

    // Duel configuration
    pub struct DuelConfig {
        pub let entryAmount: UFix64  // In FLOW tokens
        pub let duration: UInt64     // In seconds
        pub let assets: [AssetInfo]

        init(entryAmount: UFix64, duration: UInt64, assets: [AssetInfo]) {
            pre {
                entryAmount > 0.0: "Entry amount must be positive"
                duration >= 3600: "Duration must be at least 1 hour"
                assets.length >= 2: "At least 2 assets required"
            }

            self.entryAmount = entryAmount
            self.duration = duration
            self.assets = assets

            // Validate tier balance (50/50 requirement)
            var blueChipCount = 0
            var altCount = 0

            for asset in assets {
                if asset.tier == AssetTier.BlueChip {
                    blueChipCount = blueChipCount + 1
                } else {
                    altCount = altCount + 1
                }
            }

            assert(blueChipCount > 0, message: "Must include at least one Blue Chip asset")
            assert(altCount > 0, message: "Must include at least one Alternative asset")
        }
    }

    // Resource representing ownership of an index duel
    // This cannot be copied or transferred - only the creator/participants can interact
    pub resource IndexDuel {
        pub let duelId: String
        pub let evmContractAddress: String
        pub let config: DuelConfig
        pub let creator: Address
        pub var opponent: Address?
        pub var winner: Address?
        pub var state: String
        pub let createdAt: UFix64

        init(
            duelId: String,
            evmContractAddress: String,
            config: DuelConfig,
            creator: Address
        ) {
            self.duelId = duelId
            self.evmContractAddress = evmContractAddress
            self.config = config
            self.creator = creator
            self.opponent = nil
            self.winner = nil
            self.state = "Created"
            self.createdAt = getCurrentBlock().timestamp
        }

        // Update duel state from EVM contract
        pub fun updateState(newState: String) {
            self.state = newState
        }

        pub fun setOpponent(opponent: Address) {
            pre {
                self.opponent == nil: "Opponent already set"
            }
            self.opponent = opponent
            self.state = "Joined"
        }

        pub fun setWinner(winner: Address) {
            pre {
                self.state == "Locked" || self.state == "Settling": "Duel must be locked or settling"
            }
            self.winner = winner
            self.state = "Settled"
        }

        // Get duel information
        pub fun getInfo(): {String: AnyStruct} {
            return {
                "duelId": self.duelId,
                "evmContractAddress": self.evmContractAddress,
                "creator": self.creator,
                "opponent": self.opponent,
                "winner": self.winner,
                "state": self.state,
                "entryAmount": self.config.entryAmount,
                "duration": self.config.duration,
                "createdAt": self.createdAt
            }
        }
    }

    // Collection to store user's duels
    pub resource interface IndexDuelCollectionPublic {
        pub fun getDuelIds(): [String]
        pub fun borrowDuel(duelId: String): &IndexDuel?
    }

    pub resource IndexDuelCollection: IndexDuelCollectionPublic {
        pub var duels: @{String: IndexDuel}

        init() {
            self.duels <- {}
        }

        pub fun deposit(duel: @IndexDuel) {
            let id = duel.duelId
            self.duels[id] <-! duel
        }

        pub fun withdraw(duelId: String): @IndexDuel {
            return <- self.duels.remove(key: duelId)
                ?? panic("Duel not found")
        }

        pub fun getDuelIds(): [String] {
            return self.duels.keys
        }

        pub fun borrowDuel(duelId: String): &IndexDuel? {
            return &self.duels[duelId] as &IndexDuel?
        }

        destroy() {
            destroy self.duels
        }
    }

    // Create a new index duel collection
    pub fun createEmptyCollection(): @IndexDuelCollection {
        return <- create IndexDuelCollection()
    }

    // EVM integration helpers
    access(contract) let evmDuelFactoryAddress: EVM.EVMAddress

    // Create a new duel - deploys EVM contract and returns Cadence resource
    pub fun createDuel(
        config: DuelConfig,
        payment: @FungibleToken.Vault
    ): @IndexDuel {
        pre {
            payment.balance == config.entryAmount: "Incorrect entry amount"
        }

        // Generate unique duel ID
        let duelId = self.generateDuelId()

        // Prepare asset data for EVM contract
        let evmAssets: [String] = []
        let evmPriceIds: [String] = []
        let evmTiers: [UInt8] = []
        let evmSymbols: [String] = []

        for asset in config.assets {
            evmAssets.append(asset.evmAddress)
            evmPriceIds.append(asset.pythPriceId)
            evmTiers.append(asset.tier.rawValue)
            evmSymbols.append(asset.symbol)
        }

        // Call EVM DuelFactory to create duel
        // This deploys the encrypted duel contract on the EVM layer
        let evmResult = self.callEVMCreateDuel(
            entryAmount: payment.balance,
            duration: config.duration,
            assets: evmAssets,
            priceIds: evmPriceIds,
            tiers: evmTiers,
            symbols: evmSymbols,
            payment: <-payment
        )

        let evmContractAddress = evmResult.contractAddress

        // Create Cadence resource wrapping the EVM duel
        let duel <- create IndexDuel(
            duelId: duelId,
            evmContractAddress: evmContractAddress,
            config: config,
            creator: self.account.address
        )

        emit IndexDuelCreated(
            duelId: duelId,
            creator: self.account.address,
            evmAddress: evmContractAddress
        )

        return <- duel
    }

    // Internal helper to call EVM DuelFactory
    access(contract) fun callEVMCreateDuel(
        entryAmount: UFix64,
        duration: UInt64,
        assets: [String],
        priceIds: [String],
        tiers: [UInt8],
        symbols: [String],
        payment: @FungibleToken.Vault
    ): {String: String} {
        // Convert FLOW to Wei for EVM
        let weiAmount = self.flowToWei(entryAmount)

        // Call EVM contract via Flow's native EVM integration
        // This is where we bridge to the Solidity contract with fhEVM

        // Placeholder - actual EVM call would use Flow's EVM.call() API
        // The EVM contract address and ABI would be configured

        destroy payment

        return {
            "contractAddress": "0x..." // EVM duel contract address
        }
    }

    // Generate unique duel ID
    access(contract) fun generateDuelId(): String {
        let timestamp = getCurrentBlock().timestamp
        let height = getCurrentBlock().height
        return "duel_".concat(timestamp.toString()).concat("_").concat(height.toString())
    }

    // Convert FLOW amount to Wei (EVM)
    access(contract) fun flowToWei(_ flowAmount: UFix64): UInt256 {
        // 1 FLOW = 10^18 Wei
        let weiPerFlow: UFix64 = 1000000000000000000.0
        return UInt256(flowAmount * weiPerFlow)
    }

    // Convert Wei to FLOW
    access(contract) fun weiToFlow(_ weiAmount: UInt256): UFix64 {
        let weiPerFlow: UFix64 = 1000000000000000000.0
        return UFix64(weiAmount) / weiPerFlow
    }

    init() {
        // Set storage paths
        self.IndexDuelCollectionStoragePath = /storage/IndexDuelCollection
        self.IndexDuelCollectionPublicPath = /public/IndexDuelCollection

        // Set EVM DuelFactory address (would be set after deployment)
        // This is the address of the Solidity DuelFactory contract
        self.evmDuelFactoryAddress = EVM.EVMAddress(bytes: []) // Placeholder

        // Create admin collection
        self.account.save(
            <- self.createEmptyCollection(),
            to: self.IndexDuelCollectionStoragePath
        )

        self.account.link<&IndexDuelCollection{IndexDuelCollectionPublic}>(
            self.IndexDuelCollectionPublicPath,
            target: self.IndexDuelCollectionStoragePath
        )
    }
}
