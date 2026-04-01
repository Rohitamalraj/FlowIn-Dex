import { ethers } from "hardhat";

const DUEL_ABI = [
  "function getDuelInfo() external view returns (bytes32 duelId, uint256 entryAmount, uint256 duration, uint256 startTime, uint256 endTime, address creator, address opponent, uint8 state, address winner, int256 creatorReturn, int256 opponentReturn, bool settled)",
  "function getPayoutInfo() external view returns (uint256 contractBalance, uint256 requiredPayout, bool canPayout)",
  "function executePayout() external",
  "function splitTieWinnings() external"
];

async function main() {
  const duelAddress = process.env.DUEL_ADDRESS || "0xe3Ba1c2dB46EE901E2Fd49D3a858Ec2fFFD1E748";
  
  console.log(`\n🔍 Debugging Duel: ${duelAddress}\n`);

  const [signer] = await ethers.getSigners();
  const duel = new ethers.Contract(duelAddress, DUEL_ABI, signer);

  try {
    // Get duel info
    const info = await duel.getDuelInfo();
    console.log("📊 Duel Info:");
    console.log(`  Duel ID: ${info.duelId}`);
    console.log(`  Entry Amount: ${ethers.formatEther(info.entryAmount)} FLOW`);
    console.log(`  Creator: ${info.creator}`);
    console.log(`  Opponent: ${info.opponent}`);
    console.log(`  State: ${info.state} (5 = Settled)`);
    console.log(`  Winner: ${info.winner}`);
    console.log(`  Settled: ${info.settled}`);
    console.log(`  Creator Return: ${info.creatorReturn} bps`);
    console.log(`  Opponent Return: ${info.opponentReturn} bps`);

    // Get payout info
    const payoutInfo = await duel.getPayoutInfo();
    console.log(`\n💰 Payout Info:`);
    console.log(`  Contract Balance: ${ethers.formatEther(payoutInfo.contractBalance)} FLOW`);
    console.log(`  Required Payout: ${ethers.formatEther(payoutInfo.requiredPayout)} FLOW`);
    console.log(`  Can Payout: ${payoutInfo.canPayout}`);

    // Check if it's a tie
    const isTie = info.winner === ethers.ZeroAddress;
    console.log(`\n🎯 Payout Type: ${isTie ? "TIE (splitTieWinnings)" : "WINNER (executePayout)"}`);

    // Check balance issue
    if (payoutInfo.contractBalance < payoutInfo.requiredPayout) {
      console.log(`\n❌ PROBLEM: Contract balance is insufficient!`);
      console.log(`   Missing: ${ethers.formatEther(payoutInfo.requiredPayout - payoutInfo.contractBalance)} FLOW`);
      console.log(`\n💡 Solution: The contract needs to receive both entry amounts.`);
      console.log(`   - Creator's entry: ${ethers.formatEther(info.entryAmount)} FLOW`);
      console.log(`   - Opponent's entry: ${ethers.formatEther(info.entryAmount)} FLOW`);
      console.log(`   - Total needed: ${ethers.formatEther(info.entryAmount * 2n)} FLOW`);
    } else {
      console.log(`\n✅ Contract has sufficient balance for payout`);
    }

    // Suggest action
    console.log(`\n🔧 Suggested Action:`);
    if (!payoutInfo.canPayout) {
      if (info.state !== 5) {
        console.log(`   - Duel is not settled yet (state: ${info.state})`);
      } else if (payoutInfo.contractBalance < payoutInfo.requiredPayout) {
        console.log(`   - Contract balance is insufficient`);
      }
    } else {
      if (isTie) {
        console.log(`   - Call: splitTieWinnings()`);
      } else {
        console.log(`   - Call: executePayout()`);
        console.log(`   - Winner: ${info.winner}`);
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
