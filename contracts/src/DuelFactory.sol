// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Duel.sol";
import "./AssetRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DuelFactory
 * @notice Factory contract for creating and managing ShieldVault duels
 * @dev Deploys individual Duel contracts and tracks all active duels
 */
contract DuelFactory is Ownable {
    // Asset registry for tier management
    AssetRegistry public assetRegistry;

    // Duel tracking
    mapping(bytes32 => address) public duels;           // duelId => Duel contract address
    mapping(address => bytes32[]) public userDuels;     // user => duelIds
    bytes32[] public allDuelIds;

    // Platform configuration
    uint256 public minEntryAmount = 0.001 ether;
    uint256 public minDuration = 1 hours;
    uint256 public maxDuration = 30 days;
    uint256 public platformFeePercent = 0; // 0% fee initially, can be updated

    // Events
    event DuelCreated(
        bytes32 indexed duelId,
        address indexed duelContract,
        address indexed creator,
        uint256 entryAmount,
        uint256 duration
    );
    event AssetsRegistered(bytes32 indexed duelId, uint256 assetCount);
    event PlatformFeeUpdated(uint256 newFeePercent);
    event MinEntryAmountUpdated(uint256 newMinAmount);

    constructor() Ownable(msg.sender) {
        assetRegistry = new AssetRegistry();
    }

    /**
     * @notice Create a new duel with custom asset tiers
     * @param entryAmount Entry stake amount
     * @param duration Duel duration in seconds
     * @param assets Array of asset addresses
     * @param priceIds Array of Pyth price feed IDs
     * @param tiers Array of tier classifications
     * @param symbols Array of asset symbols
     * @return duelId Unique identifier for the duel
     * @return duelAddress Address of deployed Duel contract
     */
    function createDuel(
        uint256 entryAmount,
        uint256 duration,
        address[] calldata assets,
        bytes32[] calldata priceIds,
        AssetRegistry.Tier[] calldata tiers,
        string[] calldata symbols
    ) external payable returns (bytes32 duelId, address duelAddress) {
        // Validation
        require(entryAmount >= minEntryAmount, "DuelFactory: entry amount too low");
        require(duration >= minDuration, "DuelFactory: duration too short");
        require(duration <= maxDuration, "DuelFactory: duration too long");
        require(msg.value == entryAmount, "DuelFactory: incorrect entry amount");
        require(assets.length >= 2, "DuelFactory: minimum 2 assets required");
        require(assets.length == priceIds.length, "DuelFactory: length mismatch");
        require(assets.length == tiers.length, "DuelFactory: length mismatch");
        require(assets.length == symbols.length, "DuelFactory: length mismatch");

        // Generate unique duel ID
        duelId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                allDuelIds.length
            )
        );

        require(duels[duelId] == address(0), "DuelFactory: duel ID collision");

        // Register assets with tiers
        assetRegistry.registerAssets(duelId, assets, priceIds, tiers, symbols);
        emit AssetsRegistered(duelId, assets.length);

        // Deploy new Duel contract
        Duel duel = new Duel(
            duelId,
            msg.sender,
            entryAmount,
            duration,
            assets,
            address(assetRegistry)
        );

        duelAddress = address(duel);

        // Transfer entry amount to duel contract
        (bool success, ) = duelAddress.call{value: entryAmount}("");
        require(success, "DuelFactory: transfer failed");

        // Track duel
        duels[duelId] = duelAddress;
        userDuels[msg.sender].push(duelId);
        allDuelIds.push(duelId);

        emit DuelCreated(duelId, duelAddress, msg.sender, entryAmount, duration);
    }

    /**
     * @notice Get all duels created by a user
     * @param user User address
     * @return Array of duel IDs
     */
    function getUserDuels(address user) external view returns (bytes32[] memory) {
        return userDuels[user];
    }

    /**
     * @notice Get total number of duels
     * @return Total duel count
     */
    function getTotalDuels() external view returns (uint256) {
        return allDuelIds.length;
    }

    /**
     * @notice Get duel contract address by ID
     * @param duelId Duel identifier
     * @return Duel contract address
     */
    function getDuelAddress(bytes32 duelId) external view returns (address) {
        return duels[duelId];
    }

    /**
     * @notice Get assets for a duel
     * @param duelId Duel identifier
     * @return Array of asset addresses
     */
    function getDuelAssets(bytes32 duelId) external view returns (address[] memory) {
        return assetRegistry.getDuelAssets(duelId);
    }

    /**
     * @notice Get asset tier information
     * @param duelId Duel identifier
     * @param asset Asset address
     * @return AssetInfo struct
     */
    function getAssetInfo(
        bytes32 duelId,
        address asset
    ) external view returns (AssetRegistry.AssetInfo memory) {
        return assetRegistry.getAssetInfo(duelId, asset);
    }

    /**
     * @notice Update platform fee percentage (only owner)
     * @param newFeePercent New fee percentage (0-100)
     */
    function updatePlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 10, "DuelFactory: fee too high"); // Max 10%
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(newFeePercent);
    }

    /**
     * @notice Update minimum entry amount (only owner)
     * @param newMinAmount New minimum entry amount
     */
    function updateMinEntryAmount(uint256 newMinAmount) external onlyOwner {
        require(newMinAmount > 0, "DuelFactory: zero amount");
        minEntryAmount = newMinAmount;
        emit MinEntryAmountUpdated(newMinAmount);
    }

    /**
     * @notice Get duel details by ID
     * @param duelId Duel identifier
     * @return exists Whether duel exists
     * @return duelAddress Address of Duel contract
     * @return duelState Current duel state
     * @return creator Creator address
     * @return opponent Opponent address
     * @return winner Winner address (if settled)
     */
    function getDuelDetails(bytes32 duelId) external view returns (
        bool exists,
        address duelAddress,
        Duel.DuelState duelState,
        address creator,
        address opponent,
        address winner
    ) {
        duelAddress = duels[duelId];
        exists = duelAddress != address(0);

        if (exists) {
            Duel duel = Duel(payable(duelAddress));
            (
                duelState,
                creator,
                opponent,
                ,
                ,
                ,
                winner
            ) = duel.getDuelInfo();
        }
    }

    /**
     * @notice Get paginated list of all duels
     * @param offset Starting index
     * @param limit Number of duels to return
     * @return duelIds Array of duel IDs
     * @return duelAddresses Array of duel contract addresses
     */
    function getDuelsPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory duelIds, address[] memory duelAddresses) {
        uint256 totalDuels = allDuelIds.length;
        require(offset < totalDuels, "DuelFactory: offset out of bounds");

        uint256 end = offset + limit;
        if (end > totalDuels) {
            end = totalDuels;
        }

        uint256 resultLength = end - offset;
        duelIds = new bytes32[](resultLength);
        duelAddresses = new address[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            bytes32 duelId = allDuelIds[offset + i];
            duelIds[i] = duelId;
            duelAddresses[i] = duels[duelId];
        }
    }
}
