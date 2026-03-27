/**
 * Get Duel Info Script
 *
 * Read-only script to get information about a specific duel
 */

import IndexForge from 0xIndexForge

pub fun main(userAddress: Address, duelId: String): {String: AnyStruct}? {
    // Get user's public collection capability
    let collection = getAccount(userAddress)
        .getCapability<&IndexForge.IndexDuelCollection{IndexForge.IndexDuelCollectionPublic}>(
            IndexForge.IndexDuelCollectionPublicPath
        )
        .borrow()

    if collection == nil {
        return nil
    }

    // Borrow duel reference
    let duelRef = collection!.borrowDuel(duelId: duelId)

    if duelRef == nil {
        return nil
    }

    // Return duel information
    return duelRef!.getInfo()
}
