// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DuelEncrypted.sol";
import "./AssetRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title DuelFactoryEncrypted
 * @notice Factory for creating encrypted duels on Zama testnet
 * @dev Uses transparent proxy pattern for cost-effective deployment
 */
contract DuelFactoryEncrypted is Ownable {
    // Registry
    AssetRegistry public assetRegistry;
    address public duelTemplate;

    // Duel tracking
    mapping(bytes32 => address) public duels;
    mapping(address => bytes32[]) public userDuels;
    bytes32[] public allDuelIds;

    // Configuration
    uint256 public minEntryAmount = 0.001 ether;
    uint256 public minDuration = 60 seconds;      // 1 minute for demos
    uint256 public maxDuration = 30 days;
    uint256 public platformFeePercent = 0;

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

    /**
     * @notice Initialize factory
     * @param _assetRegistry Address of AssetRegistry
     * @param _duelTemplate Address of DuelEncrypted template for cloning
     */
    constructor(address _assetRegistry, address _duelTemplate) Ownable(msg.sender) {
        require(_assetRegistry != address(0), "DuelFactoryEncrypted: invalid registry");
        require(_duelTemplate != address(0), "DuelFactoryEncrypted: invalid template");
        
        assetRegistry = AssetRegistry(_assetRegistry);
        duelTemplate = _duelTemplate;
    }

    /**
     * @notice Create a new encrypted duel
     * @param entryAmount Entry stake amount
     * @param duration Duel duration in seconds
     * @param assets Array of asset addresses
     * @param priceIds Array of Pyth price feed IDs (bytes32)
     * @param tiers Array of asset tiers
     * @param symbols Array of asset symbols
     * @return duelId Unique duel identifier
     * @return duelAddress Address of deployed DuelEncrypted clone
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
        require(entryAmount >= minEntryAmount, "DuelFactoryEncrypted: entry amount too low");
        require(duration >= minDuration, "DuelFactoryEncrypted: duration too short");
        require(duration <= maxDuration, "DuelFactoryEncrypted: duration too long");
        require(msg.value == entryAmount, "DuelFactoryEncrypted: incorrect entry amount");
        require(assets.length >= 2, "DuelFactoryEncrypted: minimum 2 assets required");
        require(assets.length == priceIds.length, "DuelFactoryEncrypted: assets/priceIds mismatch");
        require(assets.length == tiers.length, "DuelFactoryEncrypted: assets/tiers mismatch");
        require(assets.length == symbols.length, "DuelFactoryEncrypted: assets/symbols mismatch");

        // Generate unique duel ID
        duelId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                allDuelIds.length
            )
        );

        require(duels[duelId] == address(0), "DuelFactoryEncrypted: duel ID collision");

        // Register assets (for tier validation)
        assetRegistry.registerAssets(duelId, assets, priceIds, tiers, symbols);
        emit AssetsRegistered(duelId, assets.length);

        // Clone DuelEncrypted contract
        duelAddress = Clones.clone(duelTemplate);

        // Initialize clone with encrypted setup
        DuelEncrypted(payable(duelAddress)).initialize(
            duelId,
            msg.sender,
            entryAmount,
            duration,
            assets,
            address(assetRegistry)
        );

        // Transfer entry amount to duel
        (bool success, ) = duelAddress.call{value: entryAmount}("");
        require(success, "DuelFactoryEncrypted: transfer failed");

        // Track duel
        duels[duelId] = duelAddress;
        userDuels[msg.sender].push(duelId);
        allDuelIds.push(duelId);

        emit DuelCreated(duelId, duelAddress, msg.sender, entryAmount, duration);

        return (duelId, duelAddress);
    }

    /**
     * @notice Get duel details
     */
    function getDuelDetails(bytes32 duelId)
        external
        view
        returns (address duelAddress)
    {
        require(duels[duelId] != address(0), "DuelFactoryEncrypted: duel not found");
        return duels[duelId];
    }

    /**
     * @notice Get user's encrypted duels
     */
    function getDuelsPaginated(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory duelIds, address[] memory duelAddresses) {
        bytes32[] memory userDuelIds = userDuels[user];
        require(offset < userDuelIds.length, "DuelFactoryEncrypted: invalid offset");

        uint256 end = offset + limit;
        if (end > userDuelIds.length) {
            end = userDuelIds.length;
        }

        duelIds = new bytes32[](end - offset);
        duelAddresses = new address[](end - offset);

        for (uint256 i = offset; i < end; i++) {
            duelIds[i - offset] = userDuelIds[i];
            duelAddresses[i - offset] = duels[userDuelIds[i]];
        }

        return (duelIds, duelAddresses);
    }

    /**
     * @notice Get total duel count
     */
    function getDuelCount() external view returns (uint256) {
        return allDuelIds.length;
    }

    /**
     * @notice Set platform fee
     */
    function setPlatformFee(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 50, "DuelFactoryEncrypted: fee too high");
        platformFeePercent = _newFeePercent;
        emit PlatformFeeUpdated(_newFeePercent);
    }

    receive() external payable {}
}
