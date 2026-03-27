#!/usr/bin/env node

/**
 * Flow EVM Deployment Verification Script
 * Verifies your wallet setup and network connectivity before deployment
 */

import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main() {
  console.log("\n🔍 FLOW EVM DEPLOYMENT VERIFICATION\n");
  console.log("=".repeat(60));

  // Check environment variables
  console.log("\n✅ ENVIRONMENT CONFIGURATION:");
  console.log("---");

  const requiredEnvVars = [
    'FLOW_EVM_PRIVATE_KEY',
    'FLOW_EVM_ADDRESS',
    'FLOW_EVM_RPC_URL'
  ];

  let allEnvVarsPresent = true;
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      if (envVar === 'FLOW_EVM_PRIVATE_KEY') {
        console.log(`  ✓ ${envVar}: ${value.substring(0, 10)}...${value.substring(value.length - 8)}`);
      } else {
        console.log(`  ✓ ${envVar}: ${value}`);
      }
    } else {
      console.log(`  ✗ ${envVar}: MISSING`);
      allEnvVarsPresent = false;
    }
  }

  if (!allEnvVarsPresent) {
    console.log("\n❌ Missing environment variables. Please update .env file.");
    process.exit(1);
  }

  // Verify private key is valid
  console.log("\n✅ WALLET VERIFICATION:");
  console.log("---");

  try {
    const wallet = new ethers.Wallet(process.env.FLOW_EVM_PRIVATE_KEY!);
    console.log(`  ✓ Private key is valid`);
    console.log(`  ✓ Derived address: ${wallet.address}`);
    console.log(`  ✓ Expected address: ${process.env.FLOW_EVM_ADDRESS}`);

    if (wallet.address.toLowerCase() !== process.env.FLOW_EVM_ADDRESS!.toLowerCase()) {
      console.log(`\n  ⚠️  WARNING: Address mismatch!`);
      console.log(`     Private key generates: ${wallet.address}`);
      console.log(`     But .env specifies:   ${process.env.FLOW_EVM_ADDRESS}`);
    } else {
      console.log(`  ✓ Address matches!`);
    }
  } catch (error) {
    console.log(`  ✗ Invalid private key: ${error}`);
    process.exit(1);
  }

  // Test network connectivity
  console.log("\n✅ NETWORK CONNECTIVITY:");
  console.log("---");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.FLOW_EVM_RPC_URL);
    
    // Test RPC connection
    console.log(`  Testing RPC: ${process.env.FLOW_EVM_RPC_URL}`);
    const network = await provider.getNetwork();
    console.log(`  ✓ Network: ${network.name}`);
    console.log(`  ✓ Chain ID: ${network.chainId}`);

    // Get wallet balance
    const wallet = new ethers.Wallet(process.env.FLOW_EVM_PRIVATE_KEY!, provider);
    const balance = await provider.getBalance(wallet.address);
    const flowBalance = ethers.formatEther(balance);
    
    console.log(`  ✓ Wallet balance: ${flowBalance} FLOW`);

    if (parseFloat(flowBalance) < 0.1) {
      console.log(`\n  ⚠️  WARNING: Low balance!`);
      console.log(`     You have ${flowBalance} FLOW`);
      console.log(`     Recommended: at least 0.1 FLOW for deployment`);
      console.log(`     Get testnet tokens: https://testnet-faucet.onflow.org`);
    } else {
      console.log(`  ✓ Sufficient balance for deployment`);
    }

    // Get gas price
    const gasPrice = await provider.getFeeData();
    console.log(`  ✓ Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);

  } catch (error) {
    console.log(`  ✗ Network connection failed: ${error}`);
    process.exit(1);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n✅ VERIFICATION COMPLETE!\n");
  console.log("You're ready to deploy. Run:");
  console.log("  npx hardhat run scripts/deployFlowEVM.ts --network flowEvmTestnet\n");
  console.log("=".repeat(60) + "\n");
}

main().catch(error => {
  console.error("❌ Verification failed:", error);
  process.exit(1);
});
