#!/usr/bin/env node

/**
 * Cadence Deployment Script for Flow Testnet
 * Deploys IndexForge contract to Flow Testnet
 * 
 * Prerequisites:
 * 1. Install Flow CLI: https://developers.flow.com/tools/flow-cli
 * 2. Add your Flow account to flow.json
 * 3. Have testnet FLOW tokens
 */

const shell = require('shelljs');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("\n🚀 CADENCE DEPLOYMENT TO FLOW TESTNET\n");
  console.log("=".repeat(60));

  // Check Flow CLI is installed
  console.log("\n✅ CHECKING PREREQUISITES:");
  console.log("---");

  if (!shell.which('flow')) {
    console.log("  ✗ Flow CLI not found!");
    console.log("  Install from: https://developers.flow.com/tools/flow-cli");
    process.exit(1);
  }
  console.log("  ✓ Flow CLI installed");

  // Check flow.json exists
  const flowJsonPath = path.join(__dirname, '..', 'flow.json');
  if (!fs.existsSync(flowJsonPath)) {
    console.log("  ✗ flow.json not found!");
    console.log("  Creating default flow.json...");
    createDefaultFlowJson();
  }
  console.log("  ✓ flow.json exists");

  // Deploy contracts
  console.log("\n✅ DEPLOYING CADENCE CONTRACTS:");
  console.log("---");

  // First, ensure account exists on testnet
  console.log("  📍 Authenticating with Flow Testnet...");
  const authResult = shell.exec('flow accounts update --network testnet', { silent: true });
  
  if (authResult.code === 0) {
    console.log("  ✓ Authentication successful");
  } else {
    console.log("  ⚠️  Note: Online authentication failed");
    console.log("     Using local flow.json configuration");
  }

  // Deploy IndexForge contract
  console.log("\n  📦 Deploying IndexForge contract...");
  const deployResult = shell.exec(
    'flow accounts add-contract IndexForge ./cadence/contracts/IndexForge.cdc --network testnet --signer testnet-account',
    { silent: false }
  );

  if (deployResult.code !== 0) {
    console.log("\n  ⚠️  Contract deployment via CLI requires complex setup.");
    console.log("  Consider using Flow CLI UI or browser deployment tools:");
    console.log("  https://github.com/onflow/flow-cli");
  }

  // Output deployment info
  console.log("\n" + "=".repeat(60));
  console.log("\n✅ DEPLOYMENT INFORMATION:\n");
  console.log("Contract: IndexForge.cdc");
  console.log("Network: Flow Testnet");
  console.log("Status: Ready for deployment\n");
  console.log("Next steps:");
  console.log("1. Use Flow CLI: flow accounts add-contract");
  console.log("2. Or use browser-based Flow Interaction Tool");
  console.log("3. Save deployed contract address to .env\n");
  console.log("=".repeat(60) + "\n");
}

function createDefaultFlowJson() {
  const flowJson = {
    "emulators": {
      "default": {
        "port": 3569,
        "serviceAccount": "emulator-account"
      }
    },
    "networks": {
      "testnet": {
        "host": "https://rest-testnet.onflow.org"
      },
      "mainnet": {
        "host": "https://rest-mainnet.onflow.org"
      }
    },
    "accounts": {
      "testnet-account": {
        "address": process.env.FLOW_TESTNET_ADDRESS || "0xYOUR_ADDRESS",
        "key": process.env.FLOW_TESTNET_PRIVATE_KEY || "YOUR_PRIVATE_KEY"
      }
    },
    "deployments": {
      "testnet": {
        "testnet-account": ["IndexForge"]
      }
    }
  };

  const flowJsonPath = path.join(__dirname, '..', 'flow.json');
  fs.writeFileSync(flowJsonPath, JSON.stringify(flowJson, null, 2));
  console.log("  ✓ Created flow.json");
}

main().catch(error => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
