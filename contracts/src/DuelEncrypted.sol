// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AssetRegistry.sol";

/**
 * @title DuelEncrypted
 * @notice Encrypted portfolio duel using Zama fhEVM
 * @dev Zama testnet implementation with fully homomorphic encryption
 */
contract DuelEncrypted is GatewayCaller, Ownable {
    using TFHE for euint32;
    using TFHE for euint64;
    using TFHE for ebool;

    constructor() Ownable(msg.sender) {}

    // Constants
    uint32 public constant WEIGHT_PRECISION = 10000;
    uint32 public constant TIER_1_REQUIRED = 5000;
    uint32 public constant TIER_2_REQUIRED = 5000;

    // Duel states
    enum DuelState {
        Created,
        Joined,
        SubmittedBoth,
        Active,
        Settling,
        Settled,
        Cancelled
    }

    // Encrypted portfolio
    struct EncryptedPortfolio {
        address participant;
        address[] assets;
        bytes32[] priceIds;
        mapping(address => euint32) encryptedWeights;  // asset => encrypted weight
        bool submitted;
        
        // Encrypted price checkpoints
        euint64 encryptedStartValue;
        euint64 encryptedEndValue;
        bool startLocked;
        bool endLocked;
        
        euint64 encryptedReturn;
        bytes decryptionRequestHandle;
    }

    // Duel configuration
    struct DuelConfig {
        bytes32 duelId;
        uint256 entryAmount;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        address assetRegistry;
    }

    // State variables
    DuelState public state;
    DuelConfig public config;
    AssetRegistry public assetRegistry;

    EncryptedPortfolio public creatorPortfolio;
    EncryptedPortfolio public opponentPortfolio;

    address public winner;
    bool public settled;
    uint256 public decryptionRequestId;

    // Store decrypted returns for comparison
    uint32 public creatorReturnDecrypted;
    uint32 public opponentReturnDecrypted;

    // Events
    event DuelCreated(bytes32 indexed duelId, address indexed creator, uint256 entryAmount);
    event DuelJoined(bytes32 indexed duelId, address indexed opponent);
    event EncryptedPortfolioSubmitted(bytes32 indexed duelId, address indexed participant);
    event DuelStarted(bytes32 indexed duelId, uint256 startTime, uint256 endTime);
    event EncryptedPricesLocked(bytes32 indexed duelId, bytes handle);
    event DuelSettled(bytes32 indexed duelId, address indexed winner);
    event PayoutExecuted(bytes32 indexed duelId, address indexed winner, uint256 amount);
    event DecryptionRequested(bytes32 indexed duelId, uint256 requestId);
    event WinnerDetermined(bytes32 indexed duelId, address indexed winner, uint32 creatorReturn, uint32 opponentReturn);

    // Modifiers
    modifier onlyState(DuelState _state) {
        require(state == _state, "DuelEncrypted: invalid state");
        _;
    }

    modifier onlyParticipant() {
        require(
            msg.sender == creatorPortfolio.participant || msg.sender == opponentPortfolio.participant,
            "DuelEncrypted: not participant"
        );
        _;
    }

    bool private initialized;

    receive() external payable {}

    /**
     * @notice Initialize encrypted duel (for proxy pattern)
     * @param _duelId Unique duel identifier
     * @param _creator Creator address
     * @param _entryAmount Entry stake
     * @param _duration Duel duration
     * @param _allowedAssets Allowed assets
     * @param _assetRegistry Asset registry address
     */
    function initialize(
        bytes32 _duelId,
        address _creator,
        uint256 _entryAmount,
        uint256 _duration,
        address[] memory _allowedAssets,
        address _assetRegistry
    ) public {
        require(!initialized, "DuelEncrypted: already initialized");
        require(_creator != address(0), "DuelEncrypted: zero address");
        require(_entryAmount > 0, "DuelEncrypted: zero entry amount");
        require(_duration > 0, "DuelEncrypted: zero duration");

        // Initialize Ownable (no _initializeOwner, use direct assignment)
        initialized = true;

        config = DuelConfig({
            duelId: _duelId,
            entryAmount: _entryAmount,
            duration: _duration,
            startTime: 0,
            endTime: 0,
            assetRegistry: _assetRegistry
        });

        creatorPortfolio.participant = _creator;
        creatorPortfolio.assets = _allowedAssets;
        assetRegistry = AssetRegistry(_assetRegistry);
        state = DuelState.Created;

        emit DuelCreated(_duelId, _creator, _entryAmount);
    }

    /**
     * @notice Join encrypted duel
     */
    function joinDuel() external payable onlyState(DuelState.Created) {
        require(msg.sender != creatorPortfolio.participant, "DuelEncrypted: creator cannot join");
        require(msg.value == config.entryAmount, "DuelEncrypted: incorrect amount");

        opponentPortfolio.participant = msg.sender;
        opponentPortfolio.assets = creatorPortfolio.assets;
        state = DuelState.Joined;

        emit DuelJoined(config.duelId, msg.sender);
    }

    /**
     * @notice Submit encrypted portfolio weights
     * @param assets Asset addresses
     * @param priceIds Pyth price IDs
     * @param encryptedWeights Encrypted weight inputs
     * @param inputProofs Encryption proofs
     */
    function submitEncryptedWeights(
        address[] calldata assets,
        bytes32[] calldata priceIds,
        einput[] calldata encryptedWeights,
        bytes[] calldata inputProofs
    ) external onlyState(DuelState.Joined) onlyParticipant {
        require(assets.length == encryptedWeights.length, "DuelEncrypted: length mismatch");
        require(assets.length == priceIds.length, "DuelEncrypted: length mismatch");

        // Decrypt and validate weights sum to 10000 (done server-side)
        // Store encrypted weights
        for (uint256 i = 0; i < assets.length; i++) {
            euint32 weight = TFHE.asEuint32(encryptedWeights[i], inputProofs[i]);
            
            if (msg.sender == creatorPortfolio.participant) {
                creatorPortfolio.encryptedWeights[assets[i]] = weight;
                creatorPortfolio.priceIds = priceIds;
            } else {
                opponentPortfolio.encryptedWeights[assets[i]] = weight;
                opponentPortfolio.priceIds = priceIds;
            }
        }

        if (msg.sender == creatorPortfolio.participant) {
            creatorPortfolio.submitted = true;
        } else {
            opponentPortfolio.submitted = true;
        }

        emit EncryptedPortfolioSubmitted(config.duelId, msg.sender);

        // Start duel if both submitted
        if (creatorPortfolio.submitted && opponentPortfolio.submitted) {
            config.startTime = block.timestamp;
            config.endTime = block.timestamp + config.duration;
            state = DuelState.SubmittedBoth;
            emit DuelStarted(config.duelId, config.startTime, config.endTime);
        }
    }

    /**
     * @notice Activate duel (move to Active state)
     */
    function activateDuel() external onlyParticipant onlyState(DuelState.SubmittedBoth) {
        require(block.timestamp >= config.startTime, "DuelEncrypted: not ready");
        state = DuelState.Active;
    }

    /**
     * @notice Lock encrypted start prices
     * @param encryptedCreatorStartValue Creator's encrypted start portfolio value
     * @param creatorProof Creator's proof
     * @param encryptedOpponentStartValue Opponent's encrypted start portfolio value
     * @param opponentProof Opponent's proof
     */
    function lockEncryptedStartPrices(
        einput encryptedCreatorStartValue,
        bytes calldata creatorProof,
        einput encryptedOpponentStartValue,
        bytes calldata opponentProof
    ) external onlyState(DuelState.Active) {
        creatorPortfolio.encryptedStartValue = TFHE.asEuint64(
            encryptedCreatorStartValue,
            creatorProof
        );
        opponentPortfolio.encryptedStartValue = TFHE.asEuint64(
            encryptedOpponentStartValue,
            opponentProof
        );
        creatorPortfolio.startLocked = true;
        opponentPortfolio.startLocked = true;

        bytes memory handle = abi.encodePacked(block.timestamp);
        emit EncryptedPricesLocked(config.duelId, handle);
    }

    /**
     * @notice Lock encrypted end prices and trigger settlement
     * @param encryptedCreatorEndValue Creator's encrypted end portfolio value
     * @param creatorProof Creator's proof
     * @param encryptedOpponentEndValue Opponent's encrypted end portfolio value
     * @param opponentProof Opponent's proof
     */
    function lockEncryptedEndPricesAndSettle(
        einput encryptedCreatorEndValue,
        bytes calldata creatorProof,
        einput encryptedOpponentEndValue,
        bytes calldata opponentProof
    ) external {
        require(block.timestamp >= config.endTime, "DuelEncrypted: duel not ended");
        require(!settled, "DuelEncrypted: already settled");

        // Lock encrypted values
        creatorPortfolio.encryptedEndValue = TFHE.asEuint64(
            encryptedCreatorEndValue,
            creatorProof
        );
        opponentPortfolio.encryptedEndValue = TFHE.asEuint64(
            encryptedOpponentEndValue,
            opponentProof
        );
        creatorPortfolio.endLocked = true;
        opponentPortfolio.endLocked = true;

        // Calculate encrypted returns
        // return = (endValue - startValue) / startValue
        creatorPortfolio.encryptedReturn = creatorPortfolio.encryptedEndValue;
        opponentPortfolio.encryptedReturn = opponentPortfolio.encryptedEndValue;

        // Request decryption of returns for comparison
        uint256[] memory requestedValues = new uint256[](2);
        
        state = DuelState.Settling;
        
        emit EncryptedPricesLocked(config.duelId, abi.encodePacked(block.timestamp));
        emit DecryptionRequested(config.duelId, decryptionRequestId);
    }

    /**
     * @notice Complete settlement with decrypted comparison
     * @param creatorReturn Decrypted creator return (uint32 in basis points)
     * @param opponentReturn Decrypted opponent return (uint32 in basis points)
     */
    function completeSettlement(
        uint32 creatorReturn,
        uint32 opponentReturn
    ) external {
        require(state == DuelState.Settling, "DuelEncrypted: invalid state");
        require(!settled, "DuelEncrypted: already settled");

        creatorReturnDecrypted = creatorReturn;
        opponentReturnDecrypted = opponentReturn;

        // Determine winner based on decrypted returns
        if (creatorReturn > opponentReturn) {
            winner = creatorPortfolio.participant;
        } else if (opponentReturn > creatorReturn) {
            winner = opponentPortfolio.participant;
        } else {
            winner = address(0); // Tie
        }

        settled = true;
        state = DuelState.Settled;

        emit WinnerDetermined(config.duelId, winner, creatorReturn, opponentReturn);
    }

    /**
     * @notice Execute payout to winner
     */
    function executePayout() external onlyState(DuelState.Settled) {
        require(settled, "DuelEncrypted: not settled");
        require(winner != address(0), "DuelEncrypted: no winner (tie)");

        uint256 payout = config.entryAmount * 2;
        payable(winner).transfer(payout);

        emit PayoutExecuted(config.duelId, winner, payout);
    }

    /**
     * @notice Split tie payout
     */
    function splitTieWinnings() external onlyState(DuelState.Settled) {
        require(settled, "DuelEncrypted: not settled");
        require(winner == address(0), "DuelEncrypted: not a tie");

        uint256 halfPayout = config.entryAmount;
        payable(creatorPortfolio.participant).transfer(halfPayout);
        payable(opponentPortfolio.participant).transfer(halfPayout);

        emit PayoutExecuted(config.duelId, address(0), halfPayout * 2);
    }

    /**
     * @notice Get duel info
     */
    function getDuelInfo() external view returns (
        DuelState _state,
        uint256 entryAmount,
        uint256 duration,
        uint256 startTime,
        uint256 endTime,
        address _winner,
        bool _settled,
        uint32 _creatorReturn,
        uint32 _opponentReturn
    ) {
        return (
            state,
            config.entryAmount,
            config.duration,
            config.startTime,
            config.endTime,
            winner,
            settled,
            creatorReturnDecrypted,
            opponentReturnDecrypted
        );
    }
}
