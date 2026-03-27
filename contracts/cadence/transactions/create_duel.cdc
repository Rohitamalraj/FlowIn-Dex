/**
 * Create Index Duel Transaction
 *
 * This transaction allows a user to create a new portfolio duel.
 * Consumer-friendly language: "Start your portfolio challenge"
 */

import FungibleToken from 0xFungibleToken
import FlowToken from 0xFlowToken
import IndexForge from 0xIndexForge

transaction(
    entryAmount: UFix64,
    durationHours: UInt64,
    assetSymbols: [String],
    assetAddresses: [String],
    assetPriceIds: [String],
    assetTiers: [UInt8]
) {

    let paymentVault: @FungibleToken.Vault
    let collection: &IndexForge.IndexDuelCollection

    prepare(signer: AuthAccount) {
        // Ensure user has a collection to store their duels
        if signer.borrow<&IndexForge.IndexDuelCollection>(from: IndexForge.IndexDuelCollectionStoragePath) == nil {
            // Create new collection
            signer.save(
                <- IndexForge.createEmptyCollection(),
                to: IndexForge.IndexDuelCollectionStoragePath
            )

            // Link public capability
            signer.link<&IndexForge.IndexDuelCollection{IndexForge.IndexDuelCollectionPublic}>(
                IndexForge.IndexDuelCollectionPublicPath,
                target: IndexForge.IndexDuelCollectionStoragePath
            )
        }

        // Get collection reference
        self.collection = signer.borrow<&IndexForge.IndexDuelCollection>(
            from: IndexForge.IndexDuelCollectionStoragePath
        ) ?? panic("Could not borrow collection")

        // Withdraw FLOW tokens for entry fee
        let vaultRef = signer.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow FlowToken vault")

        self.paymentVault <- vaultRef.withdraw(amount: entryAmount)
    }

    execute {
        // Build asset info array
        let assets: [IndexForge.AssetInfo] = []
        var i = 0
        while i < assetSymbols.length {
            let tier = assetTiers[i] == 0
                ? IndexForge.AssetTier.BlueChip
                : IndexForge.AssetTier.Alternative

            assets.append(IndexForge.AssetInfo(
                symbol: assetSymbols[i],
                evmAddress: assetAddresses[i],
                pythPriceId: assetPriceIds[i],
                tier: tier
            ))

            i = i + 1
        }

        // Create duel config
        let config = IndexForge.DuelConfig(
            entryAmount: entryAmount,
            duration: durationHours * 3600, // Convert hours to seconds
            assets: assets
        )

        // Create the duel
        let duel <- IndexForge.createDuel(
            config: config,
            payment: <- self.paymentVault
        )

        // Store in user's collection
        self.collection.deposit(duel: <- duel)
    }
}
