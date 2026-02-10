const hre = require("hardhat");

async function main() {
    console.log("Verifying AgentEscrowProtocol...\n");

    const network = hre.network.name;
    console.log(`Network: ${network}`);

    // USDC addresses for different networks
    const USDC_ADDRESSES = {
        base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    };

    // ⚠️ UPDATE THIS ADDRESS after deployment
    const CONTRACT_ADDRESS = "0x6AC844Ef070ee564ee40b81134b7707A3A4eb7eb";

    if (CONTRACT_ADDRESS === "YOUR_DEPLOYED_CONTRACT_ADDRESS") {
        console.error("❌ Error: Please update CONTRACT_ADDRESS in verify.js with your deployed contract address");
        process.exit(1);
    }

    // Get deployer account for protocol wallet
    const [deployer] = await hre.ethers.getSigners();

    // Constructor arguments (must match deployment)
    const usdcAddress = USDC_ADDRESSES[network];
    const protocolWallet = deployer.address;
    const protocolFeeBps = 250; // 2.5%

    if (!usdcAddress) {
        throw new Error(`USDC address not configured for network: ${network}`);
    }

    console.log("Verification Parameters:");
    console.log(`  Contract Address: ${CONTRACT_ADDRESS}`);
    console.log(`  USDC Address: ${usdcAddress}`);
    console.log(`  Protocol Wallet: ${protocolWallet}`);
    console.log(`  Protocol Fee: ${protocolFeeBps / 100}%\n`);

    try {
        await hre.run("verify:verify", {
            address: CONTRACT_ADDRESS,
            constructorArguments: [usdcAddress, protocolWallet, protocolFeeBps],
        });

        console.log("\n✅ Contract verified successfully!");
        console.log(`   View on Basescan: https://${network === "base" ? "" : "sepolia."}basescan.org/address/${CONTRACT_ADDRESS}`);
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("\n✅ Contract is already verified!");
        } else {
            console.error("\n❌ Verification failed:", error.message);
            throw error;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
