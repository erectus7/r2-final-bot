# DeFi Automation Bot (Ethers v5)

A modular bot script designed to automate various tasks on EVM-compatible networks, such as the Sepolia testnet. This bot uses Ethers.js v5 and features an interactive terminal interface to monitor balances and activity logs in real-time.

---

## ⚙️ Features

* **Modular & Configurable**: Each task can be easily enabled or disabled.
* **Trading Cycles**: Performs back-and-forth token swaps to build volume.
* **Asset Acquisition**: Performs one-way swaps to buy specific tokens.
* **Liquidity Provision**: Adds liquidity for specified token pairs.
* **Staking**: Supports staking for custom contracts (e.g., R2USD and BTC Yield).
* **Multi-Wallet Support**: Runs a series of tasks for multiple wallets sequentially.
* **Multi-Proxy Support**: Each wallet can use a different HTTP proxy.
* **Interactive Terminal Display**: Dynamically displays wallet balances and activity logs.
* **Reliable Transactions**: Equipped with an automatic retry system for failed transactions.

---

## 🛠️ Requirements

* **Node.js**: Version 18 or newer is recommended.
* **npm**: Comes installed automatically with Node.js.

---

## 🚀 Installation

1.  **Clone the Repository**
    Replace `YOUR_REPOSITORY_URL` with your repository's URL.
    ```bash
    git clone YOUR_REPOSITORY_URL
    cd r2-final-bot
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

---

## 📄 Configuration

The bot's configuration is divided into two parts: file setup and in-script setup.

### 1. File Setup

Create the following two files in the main project folder:

* **`private_keys.txt`**
    Fill it with all your wallet private keys, with each key on a new line.
    ```
    0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    ```

* **`proxies.txt`** (Optional)
    If you want to use proxies, fill it with your HTTP proxies. The order of proxies must correspond to the order of private keys.
    ```
    http://user:pass@host:port
    http://user2:pass2@host2:port2
    ```

⚠️ **WARNING:** Never share or upload your `private_keys.txt` file anywhere, including public or private Git repositories. Use a `.gitignore` file to prevent it.

### 2. Script Setup

Open the main script file (`r2.js`) and find the `// --- CONFIGURATION ---` section. This is where you control the bot's behavior.

To enable or disable a feature, change the `ENABLED` value to `true` or `false`.

* `TRADE_BOT_CONFIG`: For trading cycles.
* `ASSET_ACQUISITION_CONFIG`: For buying assets.
* `LIQUIDITY_CONFIG`: For adding liquidity.
* `R2USD_STAKING_CONFIG`: For staking R2USD.
* `BTC_YIELD_CONFIG`: For depositing BTC Yield.

You can also change other parameters like `AMOUNT_TO_SWAP`, `JUMLAH_SIKLUS_TOTAL` (total cycle count), and others as needed.

---

## ▶️ Running the Bot

Once all configurations are set up correctly, run the bot from your terminal with the following command:

```bash
node r2.js
