import { ethers } from "hardhat";

const PYTH_CONSUMER = process.env.FLOW_EVM_PYTH_CONSUMER!;
const MAX_AGE_SECONDS = 3600; // 1 hour — safe for testnet demos

const ABI = ["function setMaxPriceAge(uint256 _newMaxAge) external",
             "function maxPriceAge() view returns (uint256)"];

async function main() {
  const [signer] = await ethers.getSigners();
  const pc = new ethers.Contract(PYTH_CONSUMER, ABI, signer);

  const before = await pc.maxPriceAge();
  console.log(`Current maxPriceAge: ${before}s`);

  const tx = await pc.setMaxPriceAge(MAX_AGE_SECONDS);
  await tx.wait();

  const after = await pc.maxPriceAge();
  console.log(`✅ maxPriceAge updated to: ${after}s (${MAX_AGE_SECONDS / 3600}h)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
