// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title PythConsumer
 * @notice Handles Pyth price feed integration for on-chain settlement
 * @dev Provides real-time price data from Pyth Network for duel settlement
 */
contract PythConsumer {
    // Pyth price feed tracker
    mapping(bytes32 => uint256) public priceTimestamps;  // priceId => lastUpdateTime
    mapping(bytes32 => int64) public latestPrices;       // priceId => price
    mapping(bytes32 => int32) public latestExponents;    // priceId => exponent

    IPyth public pyth;
    uint256 public maxPriceAge = 60 seconds; // Accept prices up to 60 seconds old

    event PriceUpdated(bytes32 indexed priceId, int64 price, int32 expo, uint256 timestamp);
    event MaxPriceAgeUpdated(uint256 newMaxAge);

    /**
     * @notice Initialize with Pyth contract address
     * @param _pythContract Address of Pyth contract on this chain
     */
    constructor(address _pythContract) {
        require(_pythContract != address(0), "PythConsumer: invalid pyth address");
        pyth = IPyth(_pythContract);
    }

    /**
     * @notice Update price from Pyth price feed
     * @param priceId Pyth price feed ID
     * @param priceData Encoded price data from Pyth
     */
    function updatePrice(
        bytes32 priceId,
        bytes[] calldata priceData
    ) external payable {
        uint256 fee = pyth.getUpdateFee(priceData);
        require(msg.value >= fee, "PythConsumer: insufficient fee");

        // Update prices atomically
        pyth.updatePriceFeeds{value: fee}(priceData);

        // Retrieve updated price
        PythStructs.Price memory price = pyth.getPrice(priceId);
        
        require(price.publishTime > 0, "PythConsumer: price not found");

        // Cache the latest price
        latestPrices[priceId] = price.price;
        latestExponents[priceId] = price.expo;
        priceTimestamps[priceId] = price.publishTime;

        // Refund excess payment
        if (msg.value > fee) {
            (bool success, ) = msg.sender.call{value: msg.value - fee}("");
            require(success, "PythConsumer: refund failed");
        }

        emit PriceUpdated(priceId, price.price, price.expo, price.publishTime);
    }

    /**
     * @notice Update multiple prices from the same Hermes payload in one tx
     * @param priceIds Array of Pyth price feed IDs to cache locally
     * @param priceData Encoded Hermes update payload
     */
    function updatePricesBatch(
        bytes32[] calldata priceIds,
        bytes[] calldata priceData
    ) external payable {
        require(priceIds.length > 0, "PythConsumer: empty price IDs");

        uint256 fee = pyth.getUpdateFee(priceData);
        require(msg.value >= fee, "PythConsumer: insufficient fee");

        pyth.updatePriceFeeds{value: fee}(priceData);

        for (uint256 i = 0; i < priceIds.length; i++) {
            PythStructs.Price memory price = pyth.getPrice(priceIds[i]);
            require(price.publishTime > 0, "PythConsumer: price not found");

            latestPrices[priceIds[i]] = price.price;
            latestExponents[priceIds[i]] = price.expo;
            priceTimestamps[priceIds[i]] = price.publishTime;

            emit PriceUpdated(priceIds[i], price.price, price.expo, price.publishTime);
        }

        if (msg.value > fee) {
            (bool success, ) = msg.sender.call{value: msg.value - fee}("");
            require(success, "PythConsumer: refund failed");
        }
    }

    /**
     * @notice Get current price for an asset
     * @param priceId Pyth price feed ID
     * @return price Current price (scaled by exponent)
     * @return expo Exponent for scaling
     * @return timestamp Last update timestamp
     */
    function getPrice(bytes32 priceId)
        external
        view
        returns (int64 price, int32 expo, uint256 timestamp)
    {
        require(latestPrices[priceId] != 0 || latestExponents[priceId] != 0, 
            "PythConsumer: price not available");

        price = latestPrices[priceId];
        expo = latestExponents[priceId];
        timestamp = priceTimestamps[priceId];

        // Check price freshness
        require(
            block.timestamp - timestamp <= maxPriceAge,
            "PythConsumer: price too old"
        );
    }

    /**
     * @notice Calculate portfolio value at a point in time
     * @param assetPriceIds Array of Pyth price feed IDs
     * @param weights Array of portfolio weights (basis points)
     * @return portfolioValue Weighted portfolio value (in smallest unit)
     */
    function calculatePortfolioValue(
        bytes32[] calldata assetPriceIds,
        uint32[] calldata weights
    ) external view returns (uint256 portfolioValue) {
        require(assetPriceIds.length == weights.length, "PythConsumer: length mismatch");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        require(totalWeight == 10000, "PythConsumer: weights must sum to 10000");

        uint256 value = 0;
        for (uint256 i = 0; i < assetPriceIds.length; i++) {
            int64 price = latestPrices[assetPriceIds[i]];
            int32 expo = latestExponents[assetPriceIds[i]];
            
            require(price > 0, "PythConsumer: invalid price");

            // Adjust price by exponent
            uint256 adjustedPrice = uint64(price);
            if (expo < 0) {
                adjustedPrice = adjustedPrice / (10 ** uint32(-expo));
            } else {
                adjustedPrice = adjustedPrice * (10 ** uint32(expo));
            }

            // Add weighted asset value
            value += (adjustedPrice * weights[i]) / 10000;
        }

        return value;
    }

    /**
     * @notice Calculate return of a portfolio
     * @param startPriceIds Starting asset price IDs
     * @param endPriceIds Ending asset price IDs
     * @param weights Portfolio weights
     * @return returnBps Return in basis points (1 = 0.01%)
     */
    function calculateReturn(
        bytes32[] calldata startPriceIds,
        bytes32[] calldata endPriceIds,
        uint32[] calldata weights
    ) external view returns (int256 returnBps) {
        require(startPriceIds.length == endPriceIds.length, "PythConsumer: length mismatch");
        require(startPriceIds.length == weights.length, "PythConsumer: length mismatch");

        int256 totalReturn = 0;

        for (uint256 i = 0; i < startPriceIds.length; i++) {
            int64 startPrice = latestPrices[startPriceIds[i]];
            int64 endPrice = latestPrices[endPriceIds[i]];
            int32 expo = latestExponents[startPriceIds[i]];

            require(startPrice > 0 && endPrice > 0, "PythConsumer: invalid price");

            // Calculate asset return: (endPrice - startPrice) / startPrice
            int256 assetReturn = ((int256(endPrice) - int256(startPrice)) * 10000) / int256(startPrice);
            
            // Weight the return (convert uint32 to int256)
            int256 weightedReturn = (assetReturn * int256(uint256(weights[i]))) / 10000;
            totalReturn += weightedReturn;
        }

        return totalReturn;
    }

    /**
     * @notice Update max acceptable price age
     * @param _newMaxAge New maximum price age in seconds
     */
    function setMaxPriceAge(uint256 _newMaxAge) external {
        require(_newMaxAge > 0, "PythConsumer: invalid max age");
        maxPriceAge = _newMaxAge;
        emit MaxPriceAgeUpdated(_newMaxAge);
    }
}
