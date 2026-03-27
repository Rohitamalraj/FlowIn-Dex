// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PythConsumer.sol";
import "./AssetRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DuelOnChain
 * @notice On-chain duel settlement using real-time Pyth price feeds
 * @dev Flow EVM implementation with transparent price-based settlement
 */
contract DuelOnChain is Ownable {
    using SafeMath for uint256;

    // Constants
    uint32 public constant WEIGHT_PRECISION = 10000; // Basis points (100.00%)
    uint32 public constant TIER_1_REQUIRED = 5000;   // 50% for Tier 1
    uint32 public constant TIER_2_REQUIRED = 5000;   // 50% for Tier 2

    // Duel states
    enum DuelState {
        Created,       // Duel created, waiting for opponent
        Joined,        // Opponent joined, waiting for portfolio submission
        SubmittedBoth, // Both submitted portfolios, waiting for duel start
        Active,        // Duel is running
        Settling,      // Collecting prices for settlement
        Settled,       // Winner determined
        Cancelled      // Cancelled before settlement
    }

    // Participant portfolio
    struct Portfolio {
        address participant;
        address[] assets;           // Asset addresses
        bytes32[] priceIds;         // Pyth price IDs
        uint32[] weights;           // Portfolio weights (basis points)
        bool submitted;

        // Checkpoint prices (for return calculation)
        int64[] startPrices;        // Prices at duel start
        int64[] endPrices;          // Prices at duel end
        bool startPricesLocked;
        bool endPricesLocked;

        uint256 score;              // Calculated portfolio return
    }

    // Duel configuration
    struct DuelConfig {
        bytes32 duelId;
        uint256 entryAmount;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        address assetRegistry;
        address pythConsumer;
    }

    // State variables
    DuelState public state;
    DuelConfig public config;
    PythConsumer public pythConsumer;
    AssetRegistry public assetRegistry;

    Portfolio public creatorPortfolio;
    Portfolio public opponentPortfolio;

    address public winner;
    int256 public creatorReturn;     // Return in basis points
    int256 public opponentReturn;    // Return in basis points
    bool public settled;

    // Events
    event DuelCreated(bytes32 indexed duelId, address indexed creator, uint256 entryAmount, uint256 duration);
    event DuelJoined(bytes32 indexed duelId, address indexed opponent);
    event PortfolioSubmitted(bytes32 indexed duelId, address indexed participant, uint256 assetCount);
    event DuelStarted(bytes32 indexed duelId, uint256 startTime, uint256 endTime);
    event StartPricesLocked(bytes32 indexed duelId);
    event EndPricesLocked(bytes32 indexed duelId);
    event DuelSettled(bytes32 indexed duelId, address indexed winner, int256 winnerReturn, int256 loserReturn);
    event PayoutExecuted(bytes32 indexed duelId, address indexed winner, uint256 amount);
    event DuelCancelled(bytes32 indexed duelId);

    // Modifiers
    modifier onlyState(DuelState _state) {
        require(state == _state, "DuelOnChain: invalid state");
        _;
    }

    modifier onlyCreator() {
        require(msg.sender == creatorPortfolio.participant, "DuelOnChain: not creator");
        _;
    }

    modifier onlyOpponent() {
        require(msg.sender == opponentPortfolio.participant, "DuelOnChain: not opponent");
        _;
    }

    modifier onlyParticipant() {
        require(
            msg.sender == creatorPortfolio.participant || msg.sender == opponentPortfolio.participant,
            "DuelOnChain: not participant"
        );
        _;
    }

    receive() external payable {}

    /**
     * @notice Initialize a new on-chain duel
     * @param _duelId Unique duel identifier
     * @param _creator Creator address
     * @param _entryAmount Entry stake amount
     * @param _duration Duel duration in seconds
     * @param _assetRegistry Address of AssetRegistry
     * @param _pythConsumer Address of PythConsumer
     */
    constructor(
        bytes32 _duelId,
        address _creator,
        uint256 _entryAmount,
        uint256 _duration,
        address _assetRegistry,
        address _pythConsumer
    ) Ownable(_creator) {
        require(_creator != address(0), "DuelOnChain: zero address");
        require(_entryAmount > 0, "DuelOnChain: zero entry amount");
        require(_duration > 0, "DuelOnChain: zero duration");
        require(_assetRegistry != address(0), "DuelOnChain: invalid registry");
        require(_pythConsumer != address(0), "DuelOnChain: invalid pyth consumer");

        config = DuelConfig({
            duelId: _duelId,
            entryAmount: _entryAmount,
            duration: _duration,
            startTime: 0,
            endTime: 0,
            assetRegistry: _assetRegistry,
            pythConsumer: _pythConsumer
        });

        creatorPortfolio.participant = _creator;
        assetRegistry = AssetRegistry(_assetRegistry);
        pythConsumer = PythConsumer(_pythConsumer);
        state = DuelState.Created;

        emit DuelCreated(_duelId, _creator, _entryAmount, _duration);
    }

    /**
     * @notice Join duel as opponent
     */
    function joinDuel() external payable onlyState(DuelState.Created) {
        require(msg.sender != creatorPortfolio.participant, "DuelOnChain: creator cannot join");
        require(msg.value == config.entryAmount, "DuelOnChain: incorrect entry amount");

        opponentPortfolio.participant = msg.sender;
        state = DuelState.Joined;

        emit DuelJoined(config.duelId, msg.sender);
    }

    /**
     * @notice Submit portfolio allocation
     * @param assets Array of asset addresses
     * @param priceIds Array of Pyth price feed IDs
     * @param weights Array of weights in basis points (must sum to 10000)
     */
    function submitPortfolio(
        address[] calldata assets,
        bytes32[] calldata priceIds,
        uint32[] calldata weights
    ) external onlyState(DuelState.Joined) onlyParticipant {
        require(assets.length == priceIds.length, "DuelOnChain: length mismatch");
        require(assets.length == weights.length, "DuelOnChain: length mismatch");
        require(assets.length >= 2, "DuelOnChain: minimum 2 assets required");

        // Validate total weights
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        require(totalWeight == WEIGHT_PRECISION, "DuelOnChain: weights must sum to 10000");

        // Validate tier requirements
        uint32 tier1Weight = 0;
        uint32 tier2Weight = 0;

        for (uint256 i = 0; i < assets.length; i++) {
            AssetRegistry.AssetInfo memory assetInfo = assetRegistry.getAssetInfo(config.duelId, assets[i]);
            if (assetInfo.tier == AssetRegistry.Tier.TIER_1) {
                tier1Weight += weights[i];
            } else {
                tier2Weight += weights[i];
            }
        }

        require(tier1Weight >= TIER_1_REQUIRED, "DuelOnChain: insufficient tier 1 assets");
        require(tier2Weight >= TIER_2_REQUIRED, "DuelOnChain: insufficient tier 2 assets");

        // Store portfolio
        if (msg.sender == creatorPortfolio.participant) {
            creatorPortfolio.assets = assets;
            creatorPortfolio.priceIds = priceIds;
            creatorPortfolio.weights = weights;
            creatorPortfolio.submitted = true;
        } else {
            opponentPortfolio.assets = assets;
            opponentPortfolio.priceIds = priceIds;
            opponentPortfolio.weights = weights;
            opponentPortfolio.submitted = true;
        }

        emit PortfolioSubmitted(config.duelId, msg.sender, assets.length);

        // Start duel if both submitted
        if (creatorPortfolio.submitted && opponentPortfolio.submitted) {
            startDuel();
        }
    }

    /**
     * @notice Start the duel after both portfolios submitted
     */
    function startDuel() internal onlyState(DuelState.Joined) {
        config.startTime = block.timestamp;
        config.endTime = block.timestamp + config.duration;
        state = DuelState.SubmittedBoth;

        emit DuelStarted(config.duelId, config.startTime, config.endTime);
    }

    /**
     * @notice Move duel to active state
     */
    function activateDuel() external onlyParticipant onlyState(DuelState.SubmittedBoth) {
        require(block.timestamp >= config.startTime, "DuelOnChain: duel not ready");
        state = DuelState.Active;
    }

    /**
     * @notice Lock start prices (call during duel start)
     */
    function lockStartPrices() external onlyParticipant onlyState(DuelState.Active) {
        bool lockedAny = false;

        if (!creatorPortfolio.startPricesLocked) {
            creatorPortfolio.startPrices = new int64[](creatorPortfolio.priceIds.length);
            for (uint256 i = 0; i < creatorPortfolio.priceIds.length; i++) {
                (int64 price, , ) = pythConsumer.getPrice(creatorPortfolio.priceIds[i]);
                creatorPortfolio.startPrices[i] = price;
            }
            creatorPortfolio.startPricesLocked = true;
            lockedAny = true;
        }

        if (!opponentPortfolio.startPricesLocked) {
            opponentPortfolio.startPrices = new int64[](opponentPortfolio.priceIds.length);
            for (uint256 i = 0; i < opponentPortfolio.priceIds.length; i++) {
                (int64 price, , ) = pythConsumer.getPrice(opponentPortfolio.priceIds[i]);
                opponentPortfolio.startPrices[i] = price;
            }
            opponentPortfolio.startPricesLocked = true;
            lockedAny = true;
        }

        require(lockedAny, "DuelOnChain: start prices already locked");

        if (creatorPortfolio.startPricesLocked && opponentPortfolio.startPricesLocked) {
            emit StartPricesLocked(config.duelId);
        }
    }

    /**
     * @notice Lock end prices and settle duel
     */
    function lockEndPricesAndSettle() external onlyParticipant {
        require(state == DuelState.Active, "DuelOnChain: duel not active");
        require(block.timestamp >= config.endTime, "DuelOnChain: duel not ended");
        require(!settled, "DuelOnChain: already settled");
        require(
            creatorPortfolio.startPricesLocked && opponentPortfolio.startPricesLocked,
            "DuelOnChain: start prices not locked"
        );

        // Lock end prices for both participants
        if (!creatorPortfolio.endPricesLocked && creatorPortfolio.startPricesLocked) {
            creatorPortfolio.endPrices = new int64[](creatorPortfolio.priceIds.length);
            for (uint256 i = 0; i < creatorPortfolio.priceIds.length; i++) {
                (int64 price, , ) = pythConsumer.getPrice(creatorPortfolio.priceIds[i]);
                creatorPortfolio.endPrices[i] = price;
            }
            creatorPortfolio.endPricesLocked = true;
        }

        if (!opponentPortfolio.endPricesLocked && opponentPortfolio.startPricesLocked) {
            opponentPortfolio.endPrices = new int64[](opponentPortfolio.priceIds.length);
            for (uint256 i = 0; i < opponentPortfolio.priceIds.length; i++) {
                (int64 price, , ) = pythConsumer.getPrice(opponentPortfolio.priceIds[i]);
                opponentPortfolio.endPrices[i] = price;
            }
            opponentPortfolio.endPricesLocked = true;
        }

        if (creatorPortfolio.endPricesLocked && opponentPortfolio.endPricesLocked) {
            settleDuel();
        } else {
            revert("DuelOnChain: end prices not fully locked");
        }
    }

    /**
     * @notice Settle duel and determine winner
     */
    function settleDuel() internal {
        require(!settled, "DuelOnChain: already settled");

        state = DuelState.Settling;

        // Calculate returns for both portfolios
        creatorReturn = calculatePortfolioReturn(creatorPortfolio);
        opponentReturn = calculatePortfolioReturn(opponentPortfolio);

        // Determine winner
        if (creatorReturn > opponentReturn) {
            winner = creatorPortfolio.participant;
        } else if (opponentReturn > creatorReturn) {
            winner = opponentPortfolio.participant;
        } else {
            // Tie - split winnings
            winner = address(0);
        }

        settled = true;
        state = DuelState.Settled;

        emit DuelSettled(
            config.duelId,
            winner,
            creatorReturn,
            opponentReturn
        );
    }

    /**
     * @notice Calculate portfolio return in basis points
     * @param portfolio Portfolio to calculate return for
     * @return returnBps Return in basis points
     */
    function calculatePortfolioReturn(Portfolio storage portfolio)
        internal
        view
        returns (int256 returnBps)
    {
        int256 totalReturn = 0;

        for (uint256 i = 0; i < portfolio.assets.length; i++) {
            int64 startPrice = portfolio.startPrices[i];
            int64 endPrice = portfolio.endPrices[i];

            require(startPrice > 0 && endPrice > 0, "DuelOnChain: invalid prices");

            // Calculate asset return: (endPrice - startPrice) / startPrice * 10000
            int256 assetReturn = ((int256(endPrice) - int256(startPrice)) * 10000) / int256(startPrice);
            
            // Weight the return - convert uint32 weight to int256
            uint32 weightValue = portfolio.weights[i];
            int256 weightedReturn = (assetReturn * int256(uint256(weightValue))) / int256(uint256(WEIGHT_PRECISION));
            totalReturn += weightedReturn;
        }

        return totalReturn;
    }

    /**
     * @notice Execute payout to winner
     */
    function executePayout() external onlyState(DuelState.Settled) {
        require(settled, "DuelOnChain: not settled");
        require(winner != address(0), "DuelOnChain: no winner (tie)");

        uint256 payout = config.entryAmount * 2; // Both stakes

        payable(winner).transfer(payout);

        emit PayoutExecuted(config.duelId, winner, payout);
    }

    /**
     * @notice Handle tie - split winnings
     */
    function splitTieWinnings() external onlyState(DuelState.Settled) {
        require(settled, "DuelOnChain: not settled");
        require(winner == address(0), "DuelOnChain: not a tie");

        uint256 halfPayout = config.entryAmount;

        payable(creatorPortfolio.participant).transfer(halfPayout);
        payable(opponentPortfolio.participant).transfer(halfPayout);

        emit PayoutExecuted(config.duelId, address(0), halfPayout * 2);
    }

    /**
     * @notice Get creator portfolio info
     */
    function getCreatorPortfolio() external view returns (
        address participant,
        address[] memory assets,
        bytes32[] memory priceIds,
        uint32[] memory weights,
        bool submitted,
        int256 _return
    ) {
        return (
            creatorPortfolio.participant,
            creatorPortfolio.assets,
            creatorPortfolio.priceIds,
            creatorPortfolio.weights,
            creatorPortfolio.submitted,
            creatorReturn
        );
    }

    /**
     * @notice Get opponent portfolio info
     */
    function getOpponentPortfolio() external view returns (
        address participant,
        address[] memory assets,
        bytes32[] memory priceIds,
        uint32[] memory weights,
        bool submitted,
        int256 _return
    ) {
        return (
            opponentPortfolio.participant,
            opponentPortfolio.assets,
            opponentPortfolio.priceIds,
            opponentPortfolio.weights,
            opponentPortfolio.submitted,
            opponentReturn
        );
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
        int256 _creatorReturn,
        int256 _opponentReturn
    ) {
        return (
            state,
            config.entryAmount,
            config.duration,
            config.startTime,
            config.endTime,
            winner,
            settled,
            creatorReturn,
            opponentReturn
        );
    }
}

// SafeMath library for uint256
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}
