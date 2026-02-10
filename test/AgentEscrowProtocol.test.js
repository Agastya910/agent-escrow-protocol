const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("AgentEscrowProtocol", function () {
    // Constants
    const PROTOCOL_FEE_BPS = 250; // 2.5%
    const ESCROW_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC (6 decimals)
    const ONE_DAY = 24 * 60 * 60;

    async function deployFixture() {
        const [owner, client, provider, otherAccount] = await ethers.getSigners();

        // Deploy mock USDC
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
        await usdc.waitForDeployment();

        // Deploy escrow protocol
        const AgentEscrowProtocol = await ethers.getContractFactory("AgentEscrowProtocol");
        const escrow = await AgentEscrowProtocol.deploy(
            await usdc.getAddress(),
            owner.address,
            PROTOCOL_FEE_BPS
        );
        await escrow.waitForDeployment();

        // Mint USDC to client
        await usdc.mint(client.address, ethers.parseUnits("10000", 6));

        // Approve escrow contract
        await usdc.connect(client).approve(await escrow.getAddress(), ethers.MaxUint256);

        return { escrow, usdc, owner, client, provider, otherAccount };
    }

    describe("Deployment", function () {
        it("Should set the correct USDC address", async function () {
            const { escrow, usdc } = await loadFixture(deployFixture);
            expect(await escrow.usdc()).to.equal(await usdc.getAddress());
        });

        it("Should set the correct protocol wallet", async function () {
            const { escrow, owner } = await loadFixture(deployFixture);
            expect(await escrow.protocolWallet()).to.equal(owner.address);
        });

        it("Should set the correct protocol fee", async function () {
            const { escrow } = await loadFixture(deployFixture);
            expect(await escrow.protocolFeeBps()).to.equal(PROTOCOL_FEE_BPS);
        });

        it("Should initialize escrow count to zero", async function () {
            const { escrow } = await loadFixture(deployFixture);
            expect(await escrow.escrowCount()).to.equal(0);
        });

        it("Should revert with zero USDC address", async function () {
            const [owner] = await ethers.getSigners();
            const AgentEscrowProtocol = await ethers.getContractFactory("AgentEscrowProtocol");
            await expect(
                AgentEscrowProtocol.deploy(ethers.ZeroAddress, owner.address, PROTOCOL_FEE_BPS)
            ).to.be.revertedWithCustomError(AgentEscrowProtocol, "InvalidAddress");
        });

        it("Should revert with zero protocol wallet", async function () {
            const { usdc } = await loadFixture(deployFixture);
            const AgentEscrowProtocol = await ethers.getContractFactory("AgentEscrowProtocol");
            await expect(
                AgentEscrowProtocol.deploy(await usdc.getAddress(), ethers.ZeroAddress, PROTOCOL_FEE_BPS)
            ).to.be.revertedWithCustomError(AgentEscrowProtocol, "InvalidAddress");
        });

        it("Should revert with fee exceeding max", async function () {
            const { usdc } = await loadFixture(deployFixture);
            const [owner] = await ethers.getSigners();
            const AgentEscrowProtocol = await ethers.getContractFactory("AgentEscrowProtocol");
            await expect(
                AgentEscrowProtocol.deploy(await usdc.getAddress(), owner.address, 1001) // > 10%
            ).to.be.revertedWithCustomError(AgentEscrowProtocol, "InvalidFeeBps");
        });
    });

    describe("Create Escrow", function () {
        it("Should create an escrow successfully", async function () {
            const { escrow, usdc, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await expect(escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline))
                .to.emit(escrow, "EscrowCreated")
                .withArgs(0, client.address, provider.address, ESCROW_AMOUNT, deadline);

            expect(await escrow.escrowCount()).to.equal(1);
            expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(ESCROW_AMOUNT);
        });

        it("Should store escrow details correctly", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            const escrowData = await escrow.getEscrow(0);
            expect(escrowData.client).to.equal(client.address);
            expect(escrowData.provider).to.equal(provider.address);
            expect(escrowData.amount).to.equal(ESCROW_AMOUNT);
            expect(escrowData.deadline).to.equal(deadline);
            expect(escrowData.completed).to.equal(false);
            expect(escrowData.disputed).to.equal(false);
        });

        it("Should revert with zero provider address", async function () {
            const { escrow, client } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await expect(
                escrow.connect(client).createEscrow(ethers.ZeroAddress, ESCROW_AMOUNT, deadline)
            ).to.be.revertedWithCustomError(escrow, "InvalidAddress");
        });

        it("Should revert when provider is same as client", async function () {
            const { escrow, client } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await expect(
                escrow.connect(client).createEscrow(client.address, ESCROW_AMOUNT, deadline)
            ).to.be.revertedWithCustomError(escrow, "InvalidAddress");
        });

        it("Should revert with zero amount", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await expect(
                escrow.connect(client).createEscrow(provider.address, 0, deadline)
            ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
        });

        it("Should revert with past deadline", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const pastDeadline = Math.floor(Date.now() / 1000) - ONE_DAY;

            await expect(
                escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, pastDeadline)
            ).to.be.revertedWithCustomError(escrow, "InvalidDeadline");
        });
    });

    describe("Complete Escrow", function () {
        it("Should complete escrow and distribute funds correctly", async function () {
            const { escrow, usdc, owner, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            const providerBalanceBefore = await usdc.balanceOf(provider.address);
            const protocolBalanceBefore = await usdc.balanceOf(owner.address);

            await escrow.connect(client).completeEscrow(0);

            const expectedFee = (ESCROW_AMOUNT * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
            const expectedPayout = ESCROW_AMOUNT - expectedFee;

            expect(await usdc.balanceOf(provider.address)).to.equal(providerBalanceBefore + expectedPayout);
            expect(await usdc.balanceOf(owner.address)).to.equal(protocolBalanceBefore + expectedFee);
        });

        it("Should increase provider reputation", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);
            await escrow.connect(client).completeEscrow(0);

            expect(await escrow.reputationScore(provider.address)).to.equal(1);
        });

        it("Should emit EscrowCompleted event", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            const expectedFee = (ESCROW_AMOUNT * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
            const expectedPayout = ESCROW_AMOUNT - expectedFee;

            await expect(escrow.connect(client).completeEscrow(0))
                .to.emit(escrow, "EscrowCompleted")
                .withArgs(0, provider.address, expectedPayout, expectedFee);
        });

        it("Should revert if not called by client", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            await expect(escrow.connect(provider).completeEscrow(0))
                .to.be.revertedWithCustomError(escrow, "UnauthorizedCaller");
        });

        it("Should revert if already completed", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);
            await escrow.connect(client).completeEscrow(0);

            await expect(escrow.connect(client).completeEscrow(0))
                .to.be.revertedWithCustomError(escrow, "EscrowAlreadyCompleted");
        });
    });

    describe("Dispute Handling", function () {
        it("Should allow client to raise dispute", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            await expect(escrow.connect(client).raiseDispute(0))
                .to.emit(escrow, "DisputeRaised")
                .withArgs(0, client.address);

            const escrowData = await escrow.getEscrow(0);
            expect(escrowData.disputed).to.equal(true);
        });

        it("Should allow provider to raise dispute", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            await expect(escrow.connect(provider).raiseDispute(0))
                .to.emit(escrow, "DisputeRaised")
                .withArgs(0, provider.address);
        });

        it("Should revert dispute from unauthorized account", async function () {
            const { escrow, client, provider, otherAccount } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            await expect(escrow.connect(otherAccount).raiseDispute(0))
                .to.be.revertedWithCustomError(escrow, "UnauthorizedCaller");
        });

        it("Should resolve dispute in provider's favor", async function () {
            const { escrow, usdc, owner, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);
            await escrow.connect(client).raiseDispute(0);

            const providerBalanceBefore = await usdc.balanceOf(provider.address);

            await expect(escrow.connect(owner).resolveDispute(0, true))
                .to.emit(escrow, "DisputeResolved")
                .withArgs(0, true, provider.address, ESCROW_AMOUNT);

            expect(await usdc.balanceOf(provider.address)).to.equal(providerBalanceBefore + ESCROW_AMOUNT);
            expect(await escrow.reputationScore(provider.address)).to.equal(1);
            expect(await escrow.reputationScore(client.address)).to.equal(-1);
        });

        it("Should resolve dispute in client's favor", async function () {
            const { escrow, usdc, owner, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);
            await escrow.connect(client).raiseDispute(0);

            const clientBalanceBefore = await usdc.balanceOf(client.address);

            await expect(escrow.connect(owner).resolveDispute(0, false))
                .to.emit(escrow, "DisputeResolved")
                .withArgs(0, false, client.address, ESCROW_AMOUNT);

            expect(await usdc.balanceOf(client.address)).to.equal(clientBalanceBefore + ESCROW_AMOUNT);
            expect(await escrow.reputationScore(client.address)).to.equal(1);
            expect(await escrow.reputationScore(provider.address)).to.equal(-1);
        });

        it("Should revert if non-protocol wallet tries to resolve", async function () {
            const { escrow, client, provider, otherAccount } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);
            await escrow.connect(client).raiseDispute(0);

            await expect(escrow.connect(otherAccount).resolveDispute(0, true))
                .to.be.revertedWithCustomError(escrow, "OnlyProtocolWallet");
        });

        it("Should revert resolving non-disputed escrow", async function () {
            const { escrow, owner, client, provider } = await loadFixture(deployFixture);
            const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;

            await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);

            await expect(escrow.connect(owner).resolveDispute(0, true))
                .to.be.revertedWithCustomError(escrow, "EscrowNotDisputed");
        });
    });

    describe("Reputation", function () {
        it("Should track multiple completions", async function () {
            const { escrow, client, provider } = await loadFixture(deployFixture);

            for (let i = 0; i < 3; i++) {
                const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;
                await escrow.connect(client).createEscrow(provider.address, ESCROW_AMOUNT, deadline);
                await escrow.connect(client).completeEscrow(i);
            }

            expect(await escrow.reputationScore(provider.address)).to.equal(3);
        });
    });
});
