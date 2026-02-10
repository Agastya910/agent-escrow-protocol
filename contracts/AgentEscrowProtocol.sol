// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentEscrowProtocol
 * @notice A production-ready escrow protocol for agent payments using USDC
 * @dev Implements secure escrow with dispute resolution and reputation tracking
 */
contract AgentEscrowProtocol is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Custom Errors ============
    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidFeeBps();
    error InsufficientAllowance();
    error EscrowNotFound();
    error EscrowAlreadyCompleted();
    error EscrowAlreadyDisputed();
    error EscrowNotDisputed();
    error UnauthorizedCaller();
    error OnlyProtocolWallet();

    // ============ Events ============
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed client,
        address indexed provider,
        uint256 amount,
        uint256 deadline
    );

    event EscrowCompleted(
        uint256 indexed escrowId,
        address indexed provider,
        uint256 payout,
        uint256 fee
    );

    event DisputeRaised(
        uint256 indexed escrowId,
        address indexed raisedBy
    );

    event DisputeResolved(
        uint256 indexed escrowId,
        bool providerWins,
        address winner,
        uint256 amount
    );

    // ============ Structs ============
    struct Escrow {
        address client;
        address provider;
        uint256 amount;
        uint256 deadline;
        bool completed;
        bool disputed;
    }

    // ============ State Variables ============
    IERC20 public immutable usdc;
    address public immutable protocolWallet;
    uint256 public immutable protocolFeeBps;
    uint256 public escrowCount;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant MAX_FEE_BPS = 1_000; // Max 10% fee

    // ============ Mappings ============
    mapping(uint256 => Escrow) public escrows;
    mapping(address => int256) public reputationScore;

    // ============ Constructor ============
    /**
     * @notice Initializes the escrow protocol
     * @param _usdc Address of the USDC token contract
     * @param _protocolWallet Address to receive protocol fees
     * @param _protocolFeeBps Protocol fee in basis points (100 = 1%)
     */
    constructor(
        address _usdc,
        address _protocolWallet,
        uint256 _protocolFeeBps
    ) {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_protocolWallet == address(0)) revert InvalidAddress();
        if (_protocolFeeBps > MAX_FEE_BPS) revert InvalidFeeBps();

        usdc = IERC20(_usdc);
        protocolWallet = _protocolWallet;
        protocolFeeBps = _protocolFeeBps;
    }

    // ============ External Functions ============

    /**
     * @notice Creates a new escrow agreement
     * @param provider Address of the service provider
     * @param amount Amount of USDC to escrow
     * @param deadline Unix timestamp when escrow expires
     * @return escrowId The ID of the created escrow
     */
    function createEscrow(
        address provider,
        uint256 amount,
        uint256 deadline
    ) external nonReentrant returns (uint256 escrowId) {
        if (provider == address(0)) revert InvalidAddress();
        if (provider == msg.sender) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        // Check allowance before transfer
        uint256 allowance = usdc.allowance(msg.sender, address(this));
        if (allowance < amount) revert InsufficientAllowance();

        // Transfer USDC from client to contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Create escrow
        escrowId = escrowCount;
        escrows[escrowId] = Escrow({
            client: msg.sender,
            provider: provider,
            amount: amount,
            deadline: deadline,
            completed: false,
            disputed: false
        });

        unchecked {
            ++escrowCount;
        }

        emit EscrowCreated(escrowId, msg.sender, provider, amount, deadline);
    }

    /**
     * @notice Completes an escrow and releases funds to provider
     * @param escrowId The ID of the escrow to complete
     */
    function completeEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];

        if (escrow.client == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.client) revert UnauthorizedCaller();
        if (escrow.completed) revert EscrowAlreadyCompleted();
        if (escrow.disputed) revert EscrowAlreadyDisputed();

        // Mark as completed first (checks-effects-interactions)
        escrow.completed = true;

        // Calculate fee and payout
        uint256 fee = (escrow.amount * protocolFeeBps) / BPS_DENOMINATOR;
        uint256 payout = escrow.amount - fee;

        // Update reputation
        unchecked {
            ++reputationScore[escrow.provider];
        }

        // Transfer funds
        usdc.safeTransfer(escrow.provider, payout);
        if (fee > 0) {
            usdc.safeTransfer(protocolWallet, fee);
        }

        emit EscrowCompleted(escrowId, escrow.provider, payout, fee);
    }

    /**
     * @notice Raises a dispute on an escrow
     * @param escrowId The ID of the escrow to dispute
     */
    function raiseDispute(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];

        if (escrow.client == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.client && msg.sender != escrow.provider) {
            revert UnauthorizedCaller();
        }
        if (escrow.completed) revert EscrowAlreadyCompleted();
        if (escrow.disputed) revert EscrowAlreadyDisputed();

        escrow.disputed = true;

        emit DisputeRaised(escrowId, msg.sender);
    }

    /**
     * @notice Resolves a dispute (only callable by protocol wallet)
     * @param escrowId The ID of the disputed escrow
     * @param providerWins True if provider wins the dispute
     */
    function resolveDispute(
        uint256 escrowId,
        bool providerWins
    ) external nonReentrant {
        if (msg.sender != protocolWallet) revert OnlyProtocolWallet();

        Escrow storage escrow = escrows[escrowId];

        if (escrow.client == address(0)) revert EscrowNotFound();
        if (escrow.completed) revert EscrowAlreadyCompleted();
        if (!escrow.disputed) revert EscrowNotDisputed();

        // Mark as completed first (checks-effects-interactions)
        escrow.completed = true;

        address winner;
        uint256 amount = escrow.amount;

        // Update reputation based on outcome
        if (providerWins) {
            winner = escrow.provider;
            unchecked {
                ++reputationScore[escrow.provider];
                --reputationScore[escrow.client];
            }
        } else {
            winner = escrow.client;
            unchecked {
                ++reputationScore[escrow.client];
                --reputationScore[escrow.provider];
            }
        }

        // Transfer funds to winner
        usdc.safeTransfer(winner, amount);

        emit DisputeResolved(escrowId, providerWins, winner, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Gets the details of an escrow
     * @param escrowId The ID of the escrow
     * @return client The client address
     * @return provider The provider address
     * @return amount The escrowed amount
     * @return deadline The escrow deadline
     * @return completed Whether the escrow is completed
     * @return disputed Whether the escrow is disputed
     */
    function getEscrow(uint256 escrowId)
        external
        view
        returns (
            address client,
            address provider,
            uint256 amount,
            uint256 deadline,
            bool completed,
            bool disputed
        )
    {
        Escrow storage escrow = escrows[escrowId];
        return (
            escrow.client,
            escrow.provider,
            escrow.amount,
            escrow.deadline,
            escrow.completed,
            escrow.disputed
        );
    }
}
