// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AssetRegistry
 * @notice Manages asset tier classifications for ShieldVault duels
 * @dev Supports per-duel custom tier definitions
 */
contract AssetRegistry {
    // Tier enumeration
    enum Tier {
        TIER_1, // Blue-chip assets (BTC, ETH, etc.)
        TIER_2  // Alternative assets (STRK, KAS, etc.)
    }

    // Asset information structure
    struct AssetInfo {
        bytes32 priceId;      // Pyth price feed ID
        Tier tier;            // Asset tier classification
        bool isActive;        // Whether asset is active in this duel
        string symbol;        // Asset symbol for display
    }

    // Events
    event AssetRegistered(bytes32 indexed duelId, address indexed asset, Tier tier, string symbol);
    event AssetDeactivated(bytes32 indexed duelId, address indexed asset);

    // Duel ID => Asset Address => AssetInfo
    mapping(bytes32 => mapping(address => AssetInfo)) public duelAssets;

    // Duel ID => List of asset addresses
    mapping(bytes32 => address[]) public duelAssetList;

    /**
     * @notice Register assets for a specific duel with tier classifications
     * @param duelId Unique identifier for the duel
     * @param assets Array of asset addresses
     * @param priceIds Array of Pyth price feed IDs
     * @param tiers Array of tier classifications
     * @param symbols Array of asset symbols
     */
    function registerAssets(
        bytes32 duelId,
        address[] calldata assets,
        bytes32[] calldata priceIds,
        Tier[] calldata tiers,
        string[] calldata symbols
    ) external {
        require(assets.length == priceIds.length, "AssetRegistry: length mismatch");
        require(assets.length == tiers.length, "AssetRegistry: length mismatch");
        require(assets.length == symbols.length, "AssetRegistry: length mismatch");
        require(assets.length > 0, "AssetRegistry: empty assets");

        uint256 tier1Count = 0;
        uint256 tier2Count = 0;

        for (uint256 i = 0; i < assets.length; i++) {
            require(assets[i] != address(0), "AssetRegistry: zero address");
            require(!duelAssets[duelId][assets[i]].isActive, "AssetRegistry: duplicate asset");

            duelAssets[duelId][assets[i]] = AssetInfo({
                priceId: priceIds[i],
                tier: tiers[i],
                isActive: true,
                symbol: symbols[i]
            });

            duelAssetList[duelId].push(assets[i]);

            if (tiers[i] == Tier.TIER_1) {
                tier1Count++;
            } else {
                tier2Count++;
            }

            emit AssetRegistered(duelId, assets[i], tiers[i], symbols[i]);
        }

        // Ensure both tiers have at least one asset
        require(tier1Count > 0, "AssetRegistry: no Tier 1 assets");
        require(tier2Count > 0, "AssetRegistry: no Tier 2 assets");
    }

    /**
     * @notice Get asset information for a duel
     * @param duelId Duel identifier
     * @param asset Asset address
     * @return AssetInfo struct
     */
    function getAssetInfo(bytes32 duelId, address asset) external view returns (AssetInfo memory) {
        return duelAssets[duelId][asset];
    }

    /**
     * @notice Get all assets for a duel
     * @param duelId Duel identifier
     * @return Array of asset addresses
     */
    function getDuelAssets(bytes32 duelId) external view returns (address[] memory) {
        return duelAssetList[duelId];
    }

    /**
     * @notice Get asset count by tier for a duel
     * @param duelId Duel identifier
     * @return tier1Count Number of Tier 1 assets
     * @return tier2Count Number of Tier 2 assets
     */
    function getTierCounts(bytes32 duelId) external view returns (uint256 tier1Count, uint256 tier2Count) {
        address[] memory assets = duelAssetList[duelId];

        for (uint256 i = 0; i < assets.length; i++) {
            if (duelAssets[duelId][assets[i]].tier == Tier.TIER_1) {
                tier1Count++;
            } else {
                tier2Count++;
            }
        }
    }
}
