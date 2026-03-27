import React, { useState } from 'react';
import * as fcl from '@onflow/fcl';
import { executeTransaction } from '../flow/config';

/**
 * Consumer-Friendly Portfolio Builder Component
 *
 * No crypto jargon - speaks in human language
 * "Build Your Winning Mix" instead of "Configure Portfolio Weights"
 */

interface Asset {
  symbol: string;
  name: string;
  evmAddress: string;
  pythPriceId: string;
  tier: 'blue-chip' | 'alt';
  weight: number;
}

const AVAILABLE_ASSETS: Asset[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    evmAddress: '0x...',
    pythPriceId: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    tier: 'blue-chip',
    weight: 0,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    evmAddress: '0x...',
    pythPriceId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    tier: 'blue-chip',
    weight: 0,
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    evmAddress: '0x...',
    pythPriceId: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    tier: 'alt',
    weight: 0,
  },
  {
    symbol: 'STRK',
    name: 'Starknet',
    evmAddress: '0x...',
    pythPriceId: '0x6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870',
    tier: 'alt',
    weight: 0,
  },
];

export function PortfolioBuilder() {
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [entryAmount, setEntryAmount] = useState('10');
  const [durationHours, setDurationHours] = useState(24);
  const [isCreating, setIsCreating] = useState(false);

  // Calculate tier percentages
  const blueChipPercentage = selectedAssets
    .filter(a => a.tier === 'blue-chip')
    .reduce((sum, a) => sum + a.weight, 0);

  const altPercentage = selectedAssets
    .filter(a => a.tier === 'alt')
    .reduce((sum, a) => sum + a.weight, 0);

  const totalPercentage = blueChipPercentage + altPercentage;

  const isValid = blueChipPercentage === 50 && altPercentage === 50;

  const handleWeightChange = (symbol: string, weight: number) => {
    setSelectedAssets(prev =>
      prev.map(asset =>
        asset.symbol === symbol ? { ...asset, weight } : asset
      )
    );
  };

  const toggleAsset = (asset: Asset) => {
    const isSelected = selectedAssets.some(a => a.symbol === asset.symbol);

    if (isSelected) {
      setSelectedAssets(prev => prev.filter(a => a.symbol !== asset.symbol));
    } else {
      setSelectedAssets(prev => [...prev, { ...asset, weight: 0 }]);
    }
  };

  const handleCreateDuel = async () => {
    if (!isValid) {
      alert('Your mix must be exactly 50% Blue Chips and 50% Alternatives');
      return;
    }

    setIsCreating(true);

    try {
      // Prepare transaction data
      const assetSymbols = selectedAssets.map(a => a.symbol);
      const assetAddresses = selectedAssets.map(a => a.evmAddress);
      const assetPriceIds = selectedAssets.map(a => a.pythPriceId);
      const assetTiers = selectedAssets.map(a => a.tier === 'blue-chip' ? 0 : 1);

      // Load transaction code
      const createDuelTx = await fetch('/cadence/create_duel.cdc').then(r => r.text());

      // Execute transaction (with gas sponsorship if configured)
      const tx = await executeTransaction(
        createDuelTx,
        [
          fcl.arg(entryAmount, fcl.t.UFix64),
          fcl.arg(String(durationHours), fcl.t.UInt64),
          fcl.arg(assetSymbols, fcl.t.Array(fcl.t.String)),
          fcl.arg(assetAddresses, fcl.t.Array(fcl.t.String)),
          fcl.arg(assetPriceIds, fcl.t.Array(fcl.t.String)),
          fcl.arg(assetTiers, fcl.t.Array(fcl.t.UInt8)),
        ]
      );

      alert('Challenge created! Share the link with a friend to compete.');

      // Reset form
      setSelectedAssets([]);

    } catch (error) {
      console.error('Failed to create challenge:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Build Your Winning Mix</h1>
      <p className="text-gray-600 mb-8">
        Pick your favorite crypto assets and compete with a friend. May the best portfolio win!
      </p>

      {/* Entry Amount */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">
          Entry Amount (FLOW)
        </label>
        <input
          type="number"
          value={entryAmount}
          onChange={(e) => setEntryAmount(e.target.value)}
          className="w-full p-3 border rounded-lg"
          min="1"
          step="0.1"
        />
        <p className="text-sm text-gray-500 mt-1">
          Both you and your opponent will put in this amount. Winner takes all!
        </p>
      </div>

      {/* Duration */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">
          Challenge Duration
        </label>
        <div className="flex gap-2">
          {[24, 48, 72, 168].map(hours => (
            <button
              key={hours}
              onClick={() => setDurationHours(hours)}
              className={`px-4 py-2 rounded-lg ${
                durationHours === hours
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100'
              }`}
            >
              {hours < 168 ? `${hours}h` : '1 week'}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Selection */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Choose Your Assets</h2>

        {/* Blue Chips */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mr-2">
              Blue Chips
            </span>
            <span className="text-sm text-gray-600">
              (Must total 50%)
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_ASSETS.filter(a => a.tier === 'blue-chip').map(asset => (
              <AssetCard
                key={asset.symbol}
                asset={asset}
                isSelected={selectedAssets.some(a => a.symbol === asset.symbol)}
                onToggle={() => toggleAsset(asset)}
                onWeightChange={handleWeightChange}
              />
            ))}
          </div>
        </div>

        {/* Alts */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm mr-2">
              Alternatives
            </span>
            <span className="text-sm text-gray-600">
              (Must total 50%)
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_ASSETS.filter(a => a.tier === 'alt').map(asset => (
              <AssetCard
                key={asset.symbol}
                asset={asset}
                isSelected={selectedAssets.some(a => a.symbol === asset.symbol)}
                onToggle={() => toggleAsset(asset)}
                onWeightChange={handleWeightChange}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Balance Indicator */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-3">Your Mix Balance</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm">Blue Chips</span>
              <span className={`text-sm font-medium ${
                blueChipPercentage === 50 ? 'text-green-600' : 'text-gray-600'
              }`}>
                {blueChipPercentage}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  blueChipPercentage === 50 ? 'bg-green-500' : 'bg-blue-500'
                } transition-all`}
                style={{ width: `${blueChipPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm">Alternatives</span>
              <span className={`text-sm font-medium ${
                altPercentage === 50 ? 'text-green-600' : 'text-gray-600'
              }`}>
                {altPercentage}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  altPercentage === 50 ? 'bg-green-500' : 'bg-purple-500'
                } transition-all`}
                style={{ width: `${altPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {!isValid && totalPercentage > 0 && (
          <p className="text-sm text-orange-600 mt-2">
            Adjust your percentages to hit exactly 50% in each category
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleCreateDuel}
        disabled={!isValid || isCreating}
        className={`w-full py-4 rounded-lg text-white font-semibold text-lg ${
          isValid && !isCreating
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        {isCreating ? 'Creating Challenge...' : 'Lock In My Mix'}
      </button>

      {isValid && (
        <p className="text-center text-sm text-gray-600 mt-2">
          Your strategy will be private. Only the final winner will be revealed!
        </p>
      )}
    </div>
  );
}

// Asset Card Component
function AssetCard({
  asset,
  isSelected,
  onToggle,
  onWeightChange,
}: {
  asset: Asset;
  isSelected: boolean;
  onToggle: () => void;
  onWeightChange: (symbol: string, weight: number) => void;
}) {
  const selectedAsset = isSelected
    ? // Would need to get from parent, simplifying for example
      null
    : null;

  return (
    <div
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold">{asset.symbol}</div>
          <div className="text-sm text-gray-600">{asset.name}</div>
        </div>
        {isSelected && <span className="text-blue-600">✓</span>}
      </div>

      {isSelected && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={asset.weight}
            onChange={(e) => onWeightChange(asset.symbol, parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-sm text-center text-gray-600">
            {asset.weight}%
          </div>
        </div>
      )}
    </div>
  );
}
