const hre = require("hardhat");

async function main() {
    console.log("Deploying AgentEscrowProtocol...\n");

    const network = hre.network.name;
    console.log(`Network: ${network}`);

    // USDC addresses for different networks
    const USDC_ADDRESSES = {
        base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        hardhat: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Use Base mainnet for local testing
    };

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

    // Deployment parameters
    const usdcAddress = USDC_ADDRESSES[network];
    if (!usdcAddress) {
        throw new Error(`USDC address not configured for network: ${network}`);
    }

    const protocolWallet = deployer.address; // Use deployer as protocol wallet
    const protocolFeeBps = 250; // 2.5% fee

    console.log("Deployment Parameters:");
    console.log(`  USDC Address: ${usdcAddress}`);
    console.log(`  Protocol Wallet: ${protocolWallet}`);
    console.log(`  Protocol Fee: ${protocolFeeBps / 100}%\n`);

    // Deploy contract
    const AgentEscrowProtocol = await hre.ethers.getContractFactory("AgentEscrowProtocol");
    const escrow = await AgentEscrowProtocol.deploy(
        usdcAddress,
        protocolWallet,
        protocolFeeBps
    );

    await escrow.waitForDeployment();

    const contractAddress = await escrow.getAddress();
    console.log("✅ AgentEscrowProtocol deployed successfully!");
    console.log(`   Contract Address: ${contractAddress}\n`);

    // Output verification command
    console.log("To verify the contract, run:");
    console.log(`npx hardhat verify --network ${network} ${contractAddress} ${usdcAddress} ${protocolWallet} ${protocolFeeBps}`);
    console.log("\nOr use: npm run verify:base-sepolia (after updating verify.js)\n");

    // Save deployment info
    const deploymentInfo = {
        network,
        contractAddress,
        deployer: deployer.address,
        usdcAddress,
        protocolWallet,
        protocolFeeBps,
        timestamp: new Date().toISOString(),
    };

    console.log("Deployment Info (save this):");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    return contractAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
