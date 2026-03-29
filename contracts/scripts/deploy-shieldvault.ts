import { ethers } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying ShieldVaultFactory with:", deployer.address)
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLOW")

  const Factory = await ethers.getContractFactory("ShieldVaultFactory")
  const factory = await Factory.deploy()
  await factory.waitForDeployment()

  const addr = await factory.getAddress()
  console.log("\n✅ ShieldVaultFactory deployed at:", addr)
  console.log("\nAdd to frontend/.env:")
  console.log(`NEXT_PUBLIC_FLOW_EVM_FACTORY=${addr}`)
  console.log(`NEXT_PUBLIC_FLOW_EVM_DUEL_FACTORY=${addr}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
