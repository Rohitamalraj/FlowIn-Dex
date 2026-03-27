// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DuelOnChain.sol";
import "./PythConsumer.sol";
import "./AssetRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DuelFactoryOnChain
 * @notice Factory for creating on-chain duels with Pyth price settlement
 * @dev Flow EVM implementation using transparent price feeds
 */
contract DuelFactoryOnChain is Ownable {
    // Registry
    AssetRegistry public assetRegistry;
    PythConsumer public pythConsumer;

    // Duel tracking
    mapping(bytes32 => address) public duels;
    mapping(address => bytes32[]) public userDuels;
    bytes32[] public allDuelIds;

    // Configuration
    uint256 public minEntryAmount = 0.001 ether;
    uint256 public minDuration = 60 seconds;       // 1 minute for demos
    uint256 public maxDuration = 30 days;
    uint256 public platformFeePercent = 0;         // 0% initially

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
    event PythConsumerUpdated(address indexed newPythConsumer);

    /**
     * @notice Initialize factory
     * @param _pythConsumerAddress Address of PythConsumer contract
     */
    constructor(address _pythConsumerAddress) Ownable(msg.sender) {
        require(_pythConsumerAddress != address(0), "DuelFactoryOnChain: invalid pyth consumer");
        
        assetRegistry = new AssetRegistry();
        pythConsumer = PythConsumer(_pythConsumerAddress);
    }

    /**
     * @notice Create a new on-chain duel with Pyth settlement
     * @param entryAmount Entry stake amount
     * @param duration Duel duration in seconds
     * @param assets Array of asset addresses
     * @param priceIds Array of Pyth price feed IDs (bytes32)
     * @param tiers Array of asset tiers
     * @param symbols Array of asset symbols
     * @return duelId Unique duel identifier
     * @return duelAddress Address of deployed DuelOnChain contract
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
        require(entryAmount >= minEntryAmount, "DuelFactoryOnChain: entry amount too low");
        require(duration >= minDuration, "DuelFactoryOnChain: duration too short");
        require(duration <= maxDuration, "DuelFactoryOnChain: duration too long");
        require(msg.value == entryAmount, "DuelFactoryOnChain: incorrect entry amount");
        require(assets.length >= 2, "DuelFactoryOnChain: minimum 2 assets required");
        require(assets.length == priceIds.length, "DuelFactoryOnChain: assets/priceIds mismatch");
        require(assets.length == tiers.length, "DuelFactoryOnChain: assets/tiers mismatch");
        require(assets.length == symbols.length, "DuelFactoryOnChain: assets/symbols mismatch");

        // Generate unique duel ID
        duelId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                allDuelIds.length
            )
        );

        require(duels[duelId] == address(0), "DuelFactoryOnChain: duel ID collision");

        // Register assets
        assetRegistry.registerAssets(duelId, assets, priceIds, tiers, symbols);
        emit AssetsRegistered(duelId, assets.length);

        // Deploy DuelOnChain contract
        DuelOnChain duel = new DuelOnChain(
            duelId,
            msg.sender,
            entryAmount,
            duration,
            address(assetRegistry),
            address(pythConsumer)
        );

        duelAddress = address(duel);

        // Transfer entry amount to duel contract
        (bool success, ) = duelAddress.call{value: entryAmount}("");
        require(success, "DuelFactoryOnChain: transfer failed");

        // Track duel
        duels[duelId] = duelAddress;
        userDuels[msg.sender].push(duelId);
        allDuelIds.push(duelId);

        emit DuelCreated(duelId, duelAddress, msg.sender, entryAmount, duration);

        return (duelId, duelAddress);
    }

    /**
     * @notice Get duel details
     * @param duelId ID of the duel
     * @return duelAddress Address of DuelOnChain contract
     */
    function getDuelDetails(bytes32 duelId)
        external
        view
        returns (address duelAddress)
    {
        require(duels[duelId] != address(0), "DuelFactoryOnChain: duel not found");
        return duels[duelId];
    }

    /**
     * @notice Get user's duels with pagination
     * @param user User address
     * @param offset Starting index
     * @param limit Number of duels to return
     * @return duelIds Array of duel IDs
     * @return duelAddresses Array of duel addresses
     */
    function getDuelsPaginated(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory duelIds, address[] memory duelAddresses) {
        bytes32[] memory userDuelIds = userDuels[user];
        require(offset < userDuelIds.length, "DuelFactoryOnChain: invalid offset");

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
     * @notice Get total number of duels
     * @return Total duel count
     */
    function getDuelCount() external view returns (uint256) {
        return allDuelIds.length;
    }

    /**
     * @notice Get all duels with pagination
     * @param offset Starting index
     * @param limit Number of duels to return
     * @return duelIds Array of duel IDs
     * @return duelAddresses Array of duel addresses
     */
    function getAllDuelsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory duelIds, address[] memory duelAddresses)
    {
        require(offset < allDuelIds.length, "DuelFactoryOnChain: invalid offset");

        uint256 end = offset + limit;
        if (end > allDuelIds.length) {
            end = allDuelIds.length;
        }

        duelIds = new bytes32[](end - offset);
        duelAddresses = new address[](end - offset);

        for (uint256 i = offset; i < end; i++) {
            duelIds[i - offset] = allDuelIds[i];
            duelAddresses[i - offset] = duels[allDuelIds[i]];
        }

        return (duelIds, duelAddresses);
    }

    /**
     * @notice Update Pyth consumer address
     * @param _newPythConsumer New PythConsumer address
     */
    function setPythConsumer(address _newPythConsumer) external onlyOwner {
        require(_newPythConsumer != address(0), "DuelFactoryOnChain: invalid address");
        pythConsumer = PythConsumer(_newPythConsumer);
        emit PythConsumerUpdated(_newPythConsumer);
    }

    /**
     * @notice Update platform fee
     * @param _newFeePercent New fee percentage
     */
    function setPlatformFee(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 50, "DuelFactoryOnChain: fee too high");
        platformFeePercent = _newFeePercent;
        emit PlatformFeeUpdated(_newFeePercent);
    }

    /**
     * @notice Update minimum entry amount
     * @param _newMinAmount New minimum amount in wei
     */
    function setMinEntryAmount(uint256 _newMinAmount) external onlyOwner {
        require(_newMinAmount > 0, "DuelFactoryOnChain: invalid amount");
        minEntryAmount = _newMinAmount;
        emit MinEntryAmountUpdated(_newMinAmount);
    }

    receive() external payable {}
}
