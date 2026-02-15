# Agent Escrow Protocol

> The trust layer for autonomous agent payments  — tested, on Base Mainnet.


For research and educational purposes. No live service currently operated.
A trustless on‑chain credit score + escrow protocol for autonomous agent payments using USDC on [Base](https://base.org). Built to power the agent-to-agent economy.

🔗 **[Agent Escrow SDK](https://github.com/Agastya910/agent-escrow-sdk)** — A minimal SDK with a demo to integrate this protocol into your agents.

---

## The Problem

OpenClaw agents are **goal-oriented**. If you tell an agent to _"Research a topic and write a report,"_ it might need to hire another agent — or a human — to help.

**How does Agent A pay Agent B without getting scammed?**

- If Agent A pays upfront, Agent B might run away with the money.
- If Agent A pays after, Agent B might never get paid.

There is no trust between autonomous agents. There is no bank. There is no middleman.

## The Solution

This protocol and its [SDK](https://github.com/Agastya910/agent-escrow-sdk) solve this by acting as a **trustless escrow vault** on the Base blockchain. Money goes in, rules are enforced by code, and nobody can cheat.

---

## How It Works

### 1. The Lock-Up (`createEscrow`)

Instead of sending money directly to someone's wallet, your agent puts USDC into the smart contract — the **vault**. The money is now in limbo: the provider can see it's there, but they can't touch it yet.

### 2. The Work Phase

The other agent (or person) sees the money is locked and safe, so they feel confident doing the work.

### 3. The Release (`completeEscrow`)

Once your agent confirms the work is done (e.g., it received the report), it calls the SDK to unlock the vault. The money automatically goes to the provider, minus a small protocol fee.

### 4. The Safety Net (`raiseDispute`)

If the work is bad or never arrives, your agent can **freeze** the money so the provider can't take it. A dispute resolution process then decides who gets the refund.

---

## Features

| Feature                         | Description                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------- |
| **USDC Escrow**                 | Lock funds in a trustless vault — no direct wallet-to-wallet risk             |
| **Dispute Resolution**          | Either party can raise a dispute; the protocol wallet arbitrates              |
| **On-Chain Reputation**         | Providers and clients earn reputation scores (+1 / -1) based on outcomes      |
| **2.5% Protocol Fee**           | Charged only on successful completions, sent to the protocol wallet           |
| **Gas Optimized**               | Custom errors, immutable variables, `unchecked` blocks, and efficient storage |
| **Reentrancy Protection**       | Uses OpenZeppelin's `ReentrancyGuard` on all state-changing functions         |
| **Checks-Effects-Interactions** | State is updated before any external calls to prevent exploits                |

---

## Reputation System

Every successful escrow completion gives the provider **+1 reputation**. Disputes affect both parties:

| Outcome                   | Provider Score | Client Score |
| ------------------------- | -------------- | ------------ |
| Escrow completed normally | +1             | —            |
| Dispute won by provider   | +1             | -1           |
| Dispute won by client     | -1             | +1           |

Reputation scores are stored on-chain and publicly readable. As agents build higher scores, they become more trustworthy — and more valuable.

---

## Why Is This Safe?

1. **No custody risk** — Funds are held by an immutable smart contract, not a person or company
2. **No rug pulls** — The protocol wallet address and fee are set at deployment and cannot be changed
3. **Reentrancy-proof** — All fund transfers use OpenZeppelin's `SafeERC20` and `ReentrancyGuard`
4. **Checks-Effects-Interactions** — State changes happen before external calls
5. **Transparent** — All escrow data, reputation scores, and transactions are publicly verifiable on-chain

---

## The Protocol vs. The SDK

Think of this like a **Vending Machine** and its **Remote Control**.

| Component    | Where It Lives      | What It Handles                                                                                       |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Protocol** | On-Chain (Base)     | The "Truth": Holds the USDC, enforces the rules, takes the 2.5% cut, tracks reputation                |
| **SDK**      | In the Agent's Code | The "Interface": Translates simple commands like `client.createEscrow()` into blockchain transactions |
| **OpenClaw** | On your Server/PC   | The "Brain": Decides when to pay someone and how much                                                 |

Agents aren't good at speaking "Blockchain" directly. The SDK translates simple commands into complex blockchain transactions that the protocol understands.

---

## How This Monetizes the Agent Economy

**Service Fees:** Every time an agent uses the SDK to pay for a task, the protocol keeps 2.5% of the transaction.

**Reputation as Currency:** The protocol tracks on-chain reputation scores. As agents use the protocol successfully, they earn higher scores. In the future, agents with higher reputation will command higher prices — and you own the system that proves they are trustworthy.

**Agent-to-Agent Payments:** This isn't just a tool for humans — it's a **bank for agents**. When thousands of OpenClaw agents start hiring each other for small tasks (like $0.50 for a translation), they will all go through this protocol to handle millions of tiny, trustless payments.

---

## Contract Overview

| Function                                   | Description                                                 |
| ------------------------------------------ | ----------------------------------------------------------- |
| `createEscrow(provider, amount, deadline)` | Lock USDC into a new escrow agreement                       |
| `completeEscrow(escrowId)`                 | Release funds to provider (client only)                     |
| `raiseDispute(escrowId)`                   | Freeze the escrow for arbitration                           |
| `resolveDispute(escrowId, providerWins)`   | Resolve dispute and distribute funds (protocol wallet only) |
| `getEscrow(escrowId)`                      | Read escrow details                                         |
| `reputationScore(address)`                 | Read an address's reputation score                          |


---

## Quick Start (For Developers)

### Prerequisites

- Node.js v18+
- npm

### Installation

```bash
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key_here
```

### Compile

```bash
npm run compile
```

### Test

```bash
npm test
```

### Deploy

```bash
# Base Sepolia (testnet)
npm run deploy:base-sepolia

# Base Mainnet
npm run deploy:base
```

### Verify on Basescan

```bash
npm run verify:base-sepolia
npm run verify:base
```

---

## License

MIT
