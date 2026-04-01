// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ShieldVaultFactory (DEPRECATED - NOT IN USE)
 * @notice This is an older, simpler version of the duel system.
 * @dev DO NOT USE - This contract is kept for reference only.
 * 
 * Current System Uses:
 * - DuelFactoryOnChain.sol (factory)
 * - DuelOnChain.sol (duel logic)
 * - PythConsumer.sol (oracle integration)
 * - AssetRegistry.sol (tier management)
 * 
 * Limitations of this contract:
 * - No Pyth oracle integration (manual price input)
 * - No tier system (no 50/50 requirement)
 * - Trust-based settlement (caller provides prices)
 * - Less secure than current implementation
 */
contract ShieldVaultDuel {
    uint32 public constant WEIGHT_PRECISION = 10000; // basis points

    enum State { Created, Joined, Active, Settled, Cancelled }

    struct Portfolio {
        address participant;
        string[] symbols;
        uint32[]  weights;   // basis points, must sum to 10000
        bool submitted;
    }

    State   public state;
    address public factory;
    uint256 public entryAmount;
    uint256 public duration;
    uint256 public startTime;
    uint256 public endTime;
    address public winner;

    Portfolio public creatorPortfolio;
    Portfolio public opponentPortfolio;

    event Joined(address indexed opponent);
    event PortfolioSubmitted(address indexed participant);
    event DuelStarted(uint256 startTime, uint256 endTime);
    event Settled(address indexed winner, int256 creatorReturn, int256 opponentReturn);
    event Paid(address indexed winner, uint256 amount);
    event TieSplit(uint256 amount);

    modifier onlyState(State s) {
        require(state == s, "ShieldVaultDuel: wrong state");
        _;
    }

    modifier onlyParticipant() {
        require(
            msg.sender == creatorPortfolio.participant ||
            msg.sender == opponentPortfolio.participant,
            "ShieldVaultDuel: not participant"
        );
        _;
    }

    receive() external payable {}

    constructor(
        address creator,
        uint256 _entryAmount,
        uint256 _duration,
        string[] memory symbols,
        uint32[]  memory weights
    ) payable {
        require(creator != address(0),    "ShieldVaultDuel: zero creator");
        require(_entryAmount > 0,         "ShieldVaultDuel: zero entry");
        require(_duration >= 60,          "ShieldVaultDuel: min 60s");
        require(symbols.length >= 2,      "ShieldVaultDuel: min 2 assets");
        require(symbols.length == weights.length, "ShieldVaultDuel: length mismatch");
        require(msg.value == _entryAmount,"ShieldVaultDuel: wrong entry value");

        _validateWeights(weights);

        factory     = msg.sender;
        entryAmount = _entryAmount;
        duration    = _duration;
        state       = State.Created;

        creatorPortfolio = Portfolio({
            participant: creator,
            symbols:     symbols,
            weights:     weights,
            submitted:   true
        });
    }

    function joinDuel(
        string[] calldata symbols,
        uint32[]  calldata weights
    ) external payable onlyState(State.Created) {
        require(msg.sender != creatorPortfolio.participant, "ShieldVaultDuel: creator cannot join");
        require(msg.value == entryAmount,                   "ShieldVaultDuel: wrong entry value");
        require(symbols.length >= 2,                        "ShieldVaultDuel: min 2 assets");
        require(symbols.length == weights.length,           "ShieldVaultDuel: length mismatch");

        _validateWeights(weights);

        opponentPortfolio = Portfolio({
            participant: msg.sender,
            symbols:     symbols,
            weights:     weights,
            submitted:   true
        });

        startTime = block.timestamp;
        endTime   = block.timestamp + duration;
        state     = State.Active;

        emit Joined(msg.sender);
        emit DuelStarted(startTime, endTime);
    }

    /**
     * @notice Settle the duel.
     * @param creatorPrices  Price of each creator asset (in any consistent unit, e.g. USD cents).
     *                       Must match creatorPortfolio.symbols order.
     * @param opponentPrices Price of each opponent asset, matching opponentPortfolio.symbols order.
     * @dev  Caller is responsible for providing accurate prices fetched from Pyth Hermes API.
     *       Any participant can call this after the duel ends.
     */
    function settle(
        int256[] calldata creatorPrices,
        int256[] calldata opponentPrices,
        int256[] calldata creatorStartPrices,
        int256[] calldata opponentStartPrices
    ) external onlyState(State.Active) onlyParticipant {
        require(block.timestamp >= endTime, "ShieldVaultDuel: duel not ended");
        require(creatorPrices.length == creatorPortfolio.symbols.length,    "ShieldVaultDuel: creator prices length");
        require(opponentPrices.length == opponentPortfolio.symbols.length,  "ShieldVaultDuel: opponent prices length");
        require(creatorStartPrices.length == creatorPrices.length,          "ShieldVaultDuel: creator start length");
        require(opponentStartPrices.length == opponentPrices.length,        "ShieldVaultDuel: opponent start length");

        int256 creatorReturn  = _calcReturn(creatorPortfolio.weights,  creatorStartPrices,  creatorPrices);
        int256 opponentReturn = _calcReturn(opponentPortfolio.weights, opponentStartPrices, opponentPrices);

        if (creatorReturn > opponentReturn) {
            winner = creatorPortfolio.participant;
        } else if (opponentReturn > creatorReturn) {
            winner = opponentPortfolio.participant;
        } else {
            winner = address(0); // tie
        }

        state = State.Settled;
        emit Settled(winner, creatorReturn, opponentReturn);
    }

    function executePayout() external onlyState(State.Settled) {
        require(winner != address(0), "ShieldVaultDuel: tie, use splitTie");
        uint256 payout = address(this).balance;
        (bool ok, ) = payable(winner).call{value: payout}("");
        require(ok, "ShieldVaultDuel: payout failed");
        emit Paid(winner, payout);
    }

    function splitTie() external onlyState(State.Settled) {
        require(winner == address(0), "ShieldVaultDuel: not a tie");
        uint256 half = address(this).balance / 2;
        (bool ok1, ) = payable(creatorPortfolio.participant).call{value: half}("");
        (bool ok2, ) = payable(opponentPortfolio.participant).call{value: half}("");
        require(ok1 && ok2, "ShieldVaultDuel: split failed");
        emit TieSplit(half * 2);
    }

    // ── view ──────────────────────────────────────────────────────────────────

    function getDuelInfo() external view returns (
        uint8  _state,
        uint256 _entryAmount,
        uint256 _duration,
        uint256 _startTime,
        uint256 _endTime,
        address _winner,
        bool    _settled,
        int256  _creatorReturn,
        int256  _opponentReturn
    ) {
        return (
            uint8(state),
            entryAmount,
            duration,
            startTime,
            endTime,
            winner,
            state == State.Settled,
            0, // returns only known after settlement
            0
        );
    }

    function getCreatorPortfolio() external view returns (
        address participant,
        string[] memory symbols,
        uint32[] memory weights,
        bool submitted
    ) {
        return (
            creatorPortfolio.participant,
            creatorPortfolio.symbols,
            creatorPortfolio.weights,
            creatorPortfolio.submitted
        );
    }

    function getOpponentPortfolio() external view returns (
        address participant,
        string[] memory symbols,
        uint32[] memory weights,
        bool submitted
    ) {
        return (
            opponentPortfolio.participant,
            opponentPortfolio.symbols,
            opponentPortfolio.weights,
            opponentPortfolio.submitted
        );
    }

    // ── internal ──────────────────────────────────────────────────────────────

    /// Weighted return in basis points: sum( weight_i * (endPrice_i - startPrice_i) / startPrice_i )
    function _calcReturn(
        uint32[]  memory weights,
        int256[]  calldata startPrices,
        int256[]  calldata endPrices
    ) internal pure returns (int256 totalReturn) {
        for (uint256 i = 0; i < weights.length; i++) {
            require(startPrices[i] > 0, "ShieldVaultDuel: zero start price");
            int256 assetReturn = ((endPrices[i] - startPrices[i]) * 10000) / startPrices[i];
            totalReturn += assetReturn * int256(uint256(weights[i])) / 10000;
        }
    }

    function _validateWeights(uint32[] memory weights) internal pure {
        uint256 total = 0;
        for (uint256 i = 0; i < weights.length; i++) total += weights[i];
        require(total == WEIGHT_PRECISION, "ShieldVaultDuel: weights must sum to 10000");
    }
}

// ─────────────────────────────────────────────────────────────────────────────

contract ShieldVaultFactory {
    mapping(bytes32  => address) public duels;
    mapping(address  => bytes32[]) public userDuels;
    bytes32[] public allDuelIds;

    uint256 public minEntryAmount = 0.001 ether;
    uint256 public minDuration    = 60;      // 1 minute for testing
    uint256 public maxDuration    = 30 days;

    event DuelCreated(
        bytes32 indexed duelId,
        address indexed duelContract,
        address indexed creator,
        uint256 entryAmount,
        uint256 duration
    );

    /**
     * @notice Create a new duel.
     * @param entryAmount  Stake per player (msg.value must equal this).
     * @param duration     Duel length in seconds.
     * @param symbols      Asset symbols for creator's portfolio.
     * @param weights      Portfolio weights in basis points (must sum to 10000).
     */
    function createDuel(
        uint256       entryAmount,
        uint256       duration,
        string[] calldata symbols,
        uint32[]  calldata weights
    ) external payable returns (bytes32 duelId, address duelAddress) {
        require(entryAmount >= minEntryAmount, "ShieldVaultFactory: entry too low");
        require(duration    >= minDuration,    "ShieldVaultFactory: duration too short");
        require(duration    <= maxDuration,    "ShieldVaultFactory: duration too long");
        require(msg.value   == entryAmount,    "ShieldVaultFactory: wrong entry value");
        require(symbols.length >= 2,           "ShieldVaultFactory: min 2 assets");
        require(symbols.length == weights.length, "ShieldVaultFactory: length mismatch");

        duelId = keccak256(abi.encodePacked(msg.sender, block.timestamp, allDuelIds.length));
        require(duels[duelId] == address(0), "ShieldVaultFactory: duel ID collision");

        ShieldVaultDuel duel = new ShieldVaultDuel{value: entryAmount}(
            msg.sender,
            entryAmount,
            duration,
            _toMemory(symbols),
            _toMemory32(weights)
        );

        duelAddress = address(duel);
        duels[duelId]  = duelAddress;
        userDuels[msg.sender].push(duelId);
        allDuelIds.push(duelId);

        emit DuelCreated(duelId, duelAddress, msg.sender, entryAmount, duration);
    }

    function getDuelCount() external view returns (uint256) {
        return allDuelIds.length;
    }

    function getAllDuelsPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory duelIds, address[] memory duelAddresses) {
        uint256 total = allDuelIds.length;
        if (offset >= total) return (new bytes32[](0), new address[](0));

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 len = end - offset;

        duelIds      = new bytes32[](len);
        duelAddresses = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            bytes32 id    = allDuelIds[offset + i];
            duelIds[i]    = id;
            duelAddresses[i] = duels[id];
        }
    }

    function getDuelsPaginated(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory duelIds, address[] memory duelAddresses) {
        bytes32[] storage ids = userDuels[user];
        uint256 total = ids.length;
        if (offset >= total) return (new bytes32[](0), new address[](0));

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 len = end - offset;

        duelIds       = new bytes32[](len);
        duelAddresses  = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            bytes32 id    = ids[offset + i];
            duelIds[i]    = id;
            duelAddresses[i] = duels[id];
        }
    }

    function getDuelDetails(bytes32 duelId) external view returns (address duelAddress) {
        duelAddress = duels[duelId];
        require(duelAddress != address(0), "ShieldVaultFactory: not found");
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _toMemory(string[] calldata arr) internal pure returns (string[] memory out) {
        out = new string[](arr.length);
        for (uint256 i = 0; i < arr.length; i++) out[i] = arr[i];
    }

    function _toMemory32(uint32[] calldata arr) internal pure returns (uint32[] memory out) {
        out = new uint32[](arr.length);
        for (uint256 i = 0; i < arr.length; i++) out[i] = arr[i];
    }
}
