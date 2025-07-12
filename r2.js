const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');
const logUpdate = require('log-update');
const { validateAndSync } = require('./app/randomTime.js');

let logHistory = [];
const MAX_LOGS = 15;

function addToLog(message) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    logHistory.push(`[${timestamp}] ${message}`);
    if (logHistory.length > MAX_LOGS) {
        logHistory.shift();
    }
}

async function renderScreen(wallet) {
    const provider = wallet.provider;
    let balancePanel = `\n`;
    balancePanel += `╔══════════════════════════════════════════════════════════════╗\n`;
    balancePanel += `║       ${'W A L L E T   B A L A N C E'.padEnd(26)}       ║\n`;
    balancePanel += `║       ${wallet.address.padEnd(42)}       ║\n`;
    balancePanel += `╠════════════════════════════════╦═════════════════════════════╣\n`;

    try {
        const ethBalance = await provider.getBalance(wallet.address);
        const ethFormatted = parseFloat(ethers.utils.formatEther(ethBalance)).toFixed(5);
        balancePanel += `║ Sepolia ETH                        ║ ${ethFormatted.padEnd(23)} ║\n`;
    } catch (e) { /* Ignore */ }

    for (const tokenName in TOKEN_ADDRESSES) {
        const tokenAddress = TOKEN_ADDRESSES[tokenName];
        if (tokenAddress && !tokenAddress.startsWith("FILL_")) {
            try {
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                const decimals = await tokenContract.decimals();
                const balance = await tokenContract.balanceOf(wallet.address);
                const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(4);
                const tokenLine = `║ ${tokenName.padEnd(34)} ║ ${formattedBalance.padEnd(23)} ║\n`;
                balancePanel += tokenLine;
            } catch (error) { /* Ignore */ }
        }
    }
    balancePanel += `╚════════════════════════════════╧═════════════════════════════╝\n`;
    const logOutput = logHistory.join('\n');
    logUpdate(balancePanel + '\n---[ Last Activity Log ]---\n' + logOutput);
}

const colors = { };

function randomizeAmount(baseAmount, percentage) {
    const base = parseFloat(baseAmount);
    const pct = parseFloat(percentage) / 100;
    const deviation = base * pct * (Math.random() * 2 - 1);
    const finalAmount = base + deviation;
    return finalAmount.toFixed(6).toString();
}

const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/izLAMbv6RwBWXpgsN0FSI';
const ROUTERS = { V2_OLD: '0xee567fe1712faf6149d80da1e6934e354124cfe3', V2_NEW: '0x9e8ff356d35a2da385c546d6bf1d77ff85133365' };
const TOKEN_ADDRESSES = { R2: '0xb816bb88f836ea75ca4071b46ff285f690c43bb7', R2USD: '0x9e8FF356D35a2Da385C546d6Bf1D77ff85133365', USDC: '0x8bebfcbe5468f146533c182df3dfbf5ff9be00e2', sR2USD: '0xe85a06c238439f981c90b2c91393b2f3c46e27fc', WBTC: '0x4f5b54d4AF2568cefafA73bB062e5d734b55AA05' };
const RETRY_ATTEMPTS = 5;
const MIN_DELAY_SECONDS = 8;
const MAX_DELAY_SECONDS = 20;
const SLIPPAGE_TOLERANCE = 0.10;
const TRADE_BOT_CONFIG = { ENABLED: true, ROUTER: ROUTERS.V2_OLD, TOKEN_A_NAME: "USDC", TOKEN_B_NAME: "R2", AMOUNT_TO_SWAP: '2000', TOTAL_CYCLES: 10 };
const ASSET_ACQUISITION_CONFIG = { ENABLED: true, SWAP_LIST: [ { LABEL: "ACQUISITION (1/2): Buy R2 from USDC", AMOUNT_IN: randomizeAmount('2000', 5), ROUTER: ROUTERS.V2_OLD, PATH: [TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.R2] }, { LABEL: "ACQUISITION (2/2): Buy R2USD from R2", AMOUNT_IN: randomizeAmount('1480', 5), ROUTER: ROUTERS.V2_OLD, PATH: [TOKEN_ADDRESSES.R2, TOKEN_ADDRESSES.R2USD] } ] };
const LIQUIDITY_CONFIG = { ENABLED: true, PAIRS: [ { tokenA: 'R2', tokenB: 'R2USD', amountA: '1060', amountB: '700', ROUTER: ROUTERS.V2_OLD }, { tokenA: 'R2', tokenB: 'USDC', amountA: '200', amountB: '100', ROUTER: ROUTERS.V2_OLD } ] };
const R2USD_STAKING_CONFIG = { ENABLED: false, STAKING_CONTRACT_ADDRESS: '0x006CbF409CA275bA022111dB32BDAE054a97d488', STAKE_AMOUNT_STRING: randomizeAmount('1.5', 10), POOL_ID: 36 };
const BTC_YIELD_CONFIG = { ENABLED: false, YIELD_CONTRACT_ADDRESS: '0x23b2615d783E16F14B62EfA125306c7c69B4941A', DEPOSIT_AMOUNT_STRING: '0.001', CANDIDATE_ADDRESS: '0x75b34d4AF2568cefafA73bB062e5d734b55AA05' };

const ERC20_ABI = require('./abis/erc20.json');
const ROUTER_ABI = require('./abis/router.json');
const YIELD_CONTRACT_ABI = require('./abis/yield_contract_abi.json');
const R2USD_STAKING_ABI = require('./abis/r2usd_staking_abi.json');

function randomDelay(minSeconds, maxSeconds) { const delay = Math.random() * (maxSeconds - minSeconds) + minSeconds; const delayMs = Math.floor(delay * 1000); addToLog(`      >> Taking a random delay for ${delay.toFixed(2)} seconds...`); return new Promise(resolve => setTimeout(resolve, delayMs)); }
function getProvider(proxyString) { const connection = { url: SEPOLIA_RPC_URL }; if (proxyString && proxyString.startsWith('http')) { addToLog(`      >> Using proxy: ${proxyString.substring(proxyString.indexOf('@') + 1)}`); connection.fetch = (url, options) => { if (!options) { options = {}; } options.agent = new HttpsProxyAgent(proxyString); return fetch(url, options); } } else { addToLog(`      >> Using direct connection.`); } return new ethers.providers.JsonRpcProvider(connection); }

async function executeTxWithRetries(label, txFunction, wallet) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            addToLog(`- Attempting ${label} (Attempt #${attempt})...`);
            await renderScreen(wallet);
            const tx = await txFunction();
            addToLog(`   - Transaction sent. Hash: ${tx.hash}`);
            await renderScreen(wallet);
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                addToLog(`   - ✅ ${label} confirmed successfully.`);
                await renderScreen(wallet);
                return receipt;
            } else {
                throw new Error("Transaction was reverted by the blockchain.");
            }
        } catch (error) {
            addToLog(`   - 🔴 FAILED (Attempt #${attempt}): ${error.code || error.reason || error.message}`);
            await renderScreen(wallet);
            if (attempt < RETRY_ATTEMPTS) {
                await randomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS);
                await renderScreen(wallet);
            }
        }
    }
    throw new Error(`Total failure for "${label}" after ${RETRY_ATTEMPTS} attempts.`);
}

async function approveToken(wallet, tokenAddress, spenderAddress, amountToApprove) { const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet); const tokenName = await tokenContract.symbol().catch(() => tokenAddress.slice(0, 10)); const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress); if (currentAllowance.lt(amountToApprove)) { await executeTxWithRetries(`Approve ${tokenName} for ${spenderAddress.slice(0,10)}...`, () => tokenContract.approve(spenderAddress, ethers.constants.MaxUint256), wallet); } else { addToLog(`- Allowance for ${tokenName} is sufficient.`); } }

async function executeSwap(wallet, swapJob) {
    const { LABEL, AMOUNT_IN, ROUTER, PATH } = swapJob;
    const tokenInAddress = PATH[0];
    const tokenInName = Object.keys(TOKEN_ADDRESSES).find(key => TOKEN_ADDRESSES[key] && TOKEN_ADDRESSES[key].toLowerCase() === tokenInAddress.toLowerCase());

    if (!tokenInAddress || !tokenInName) {
        addToLog(`🔴 Invalid token address or name in PATH.`);
        return false;
    }

    addToLog(`\n--- Starting Swap: ${LABEL} via Router ${ROUTER.slice(0,10)}... ---`);

    try {
        const tokenInContract = new ethers.Contract(tokenInAddress, ERC20_ABI, wallet);
        const decimals = await tokenInContract.decimals();
        const amountToSwap = ethers.utils.parseUnits(AMOUNT_IN, decimals);
        const currentBalance = await tokenInContract.balanceOf(wallet.address);

        if (currentBalance.lt(amountToSwap)) {
            const balanceFormatted = ethers.utils.formatUnits(currentBalance, decimals);
            throw new Error(`Insufficient ${tokenInName} balance. Required: ${AMOUNT_IN}, You have: ${parseFloat(balanceFormatted).toFixed(4)}`);
        }

        await approveToken(wallet, tokenInAddress, ROUTER, amountToSwap);
        
        const routerContract = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);
        const txFunction = () => routerContract.swapExactTokensForTokens(
            amountToSwap,
            0,
            PATH,
            wallet.address,
            Math.floor(Date.now() / 1000) + 60 * 20,
            { gasLimit: 600000 }
        );

        await executeTxWithRetries(`Swap ${AMOUNT_IN} ${tokenInName}`, txFunction, wallet);
        return true;
    } catch (error) {
        addToLog(`🔴 TOTAL FAILURE during Swap stage: ${error.message}`);
        await renderScreen(wallet);
        return false;
    }
}

async function runTradingCyclesForWallet(wallet) {
    const { TOKEN_A_NAME, TOKEN_B_NAME, AMOUNT_TO_SWAP, TOTAL_CYCLES, ROUTER } = TRADE_BOT_CONFIG;
    for (let i = 1; i <= TOTAL_CYCLES; i++) {
        addToLog(`\n    --- Cycle #${i} of ${TOTAL_CYCLES} ---`);
        const jobAtoB = { LABEL: `${AMOUNT_TO_SWAP} ${TOKEN_A_NAME} -> ${TOKEN_B_NAME}`, AMOUNT_IN: AMOUNT_TO_SWAP, ROUTER, PATH: [TOKEN_ADDRESSES[TOKEN_A_NAME], TOKEN_ADDRESSES[TOKEN_B_NAME]] };
        const successA = await executeSwap(wallet, jobAtoB);
        if (successA) {
            await randomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS);
            await renderScreen(wallet);
            const tokenBContract = new ethers.Contract(TOKEN_ADDRESSES[TOKEN_B_NAME], ERC20_ABI, wallet);
            const currentBBalance = await tokenBContract.balanceOf(wallet.address);
            if (currentBBalance.gt(0)) {
                const amountBString = ethers.utils.formatUnits(currentBBalance, await tokenBContract.decimals());
                const jobBtoA = { LABEL: `${amountBString.slice(0,12)} ${TOKEN_B_NAME} -> ${TOKEN_A_NAME}`, AMOUNT_IN: amountBString, ROUTER, PATH: [TOKEN_ADDRESSES[TOKEN_B_NAME], TOKEN_ADDRESSES[TOKEN_A_NAME]] };
                await executeSwap(wallet, jobBtoA);
            }
        } else { addToLog(`      - Swap failed, stopping cycle for this wallet.`); break; }
    }
}

async function runAssetAcquisition(wallet) {
    addToLog(`\n--- Starting Asset Acquisition for Wallet: ${wallet.address} ---`);
    const { SWAP_LIST } = ASSET_ACQUISITION_CONFIG;
    for (const swapJob of SWAP_LIST) {
        if (swapJob.PATH.includes("FILL_R2USD_TOKEN_ADDRESS")) {
            addToLog(`🔴 Skipped: Swap "${swapJob.LABEL}" because R2USD address is not set.`);
            continue;
        }
        await executeSwap(wallet, swapJob);
        if (SWAP_LIST.indexOf(swapJob) < SWAP_LIST.length - 1) {
            await randomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS);
            await renderScreen(wallet);
        }
    }
}

async function addLiquidityForPair(wallet, pairConfig) {
    const { tokenA, tokenB, amountA, amountB, ROUTER } = pairConfig; 
    const addressA = TOKEN_ADDRESSES[tokenA]; 
    const addressB = TOKEN_ADDRESSES[tokenB];
    addToLog(`\n--- Adding Liquidity for Pair: ${tokenA}/${tokenB} ---`);
    try {
        const routerContract = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);
        const contractA = new ethers.Contract(addressA, ERC20_ABI, wallet);
        const contractB = new ethers.Contract(addressB, ERC20_ABI, wallet);
        const decimalsA = await contractA.decimals();
        const decimalsB = await contractB.decimals();
        const amountADesired = ethers.utils.parseUnits(amountA, decimalsA);
        const amountBDesired = ethers.utils.parseUnits(amountB, decimalsB);
        const balanceA = await contractA.balanceOf(wallet.address);
        const balanceB = await contractB.balanceOf(wallet.address);
        if (balanceA.lt(amountADesired)) { throw new Error(`Insufficient ${tokenA} balance.`); }
        if (balanceB.lt(amountBDesired)) { throw new Error(`Insufficient ${tokenB} balance.`); }
        await approveToken(wallet, addressA, ROUTER, amountADesired);
        await approveToken(wallet, addressB, ROUTER, amountBDesired);
        await randomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS);
        await renderScreen(wallet);
        const txFunction = () => routerContract.addLiquidity(addressA, addressB, amountADesired, amountBDesired, 0, 0, wallet.address, Math.floor(Date.now() / 1000) + 60 * 20, { gasLimit: 600000 });
        await executeTxWithRetries(`Add Liquidity ${amountA} ${tokenA}/${amountB} ${tokenB}`, txFunction, wallet);
    } catch (error) { addToLog(`🔴 TOTAL FAILURE during Add Liquidity for ${tokenA}/${tokenB}: ${error.message}`); }
}

async function runBtcYieldDepositForWallet(wallet) {
    const { YIELD_CONTRACT_ADDRESS, DEPOSIT_AMOUNT_STRING, CANDIDATE_ADDRESS } = BTC_YIELD_CONFIG;
    addToLog(`\n--- Starting BTC Yield Deposit for Wallet: ${wallet.address} ---`);
    try {
        const wbtcContract = new ethers.Contract(TOKEN_ADDRESSES.WBTC, ERC20_ABI, wallet);
        const decimals = await wbtcContract.decimals();
        const amountToDeposit = ethers.utils.parseUnits(DEPOSIT_AMOUNT_STRING, decimals);
        const currentBalance = await wbtcContract.balanceOf(wallet.address);
        if (currentBalance.lt(amountToDeposit)) { throw new Error(`Insufficient WBTC balance.`); }
        await approveToken(wallet, TOKEN_ADDRESSES.WBTC, YIELD_CONTRACT_ADDRESS, amountToDeposit);
        await randomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS);
        await renderScreen(wallet);
        const txFunction = () => {
            const functionSelector = '0x1a5f0f00';
            const types = Array(10).fill('uint256');
            const candidateAsInt = ethers.BigNumber.from(CANDIDATE_ADDRESS);
            const values = [amountToDeposit, candidateAsInt, 0, 0, 0, 0, 0, 0, 0, 0];
            const calldata = functionSelector + ethers.utils.defaultAbiCoder.encode(types, values).substring(2);
            return wallet.sendTransaction({ to: YIELD_CONTRACT_ADDRESS, data: calldata, gasLimit: 300000 });
        };
        await executeTxWithRetries("Stake WBTC (New Method)", txFunction, wallet);
    } catch (error) { addToLog(`🔴 TOTAL FAILURE during BTC Yield Deposit: ${error.message}`); }
}

async function runR2usdStakingForWallet(wallet) {
    const { STAKING_CONTRACT_ADDRESS, STAKE_AMOUNT_STRING } = R2USD_STAKING_CONFIG;
    addToLog(`\n--- Starting R2USD Staking (New Method) for Wallet: ${wallet.address} ---`);
    try {
        const r2usdContract = new ethers.Contract(TOKEN_ADDRESSES.R2USD, ERC20_ABI, wallet);
        const decimals = await r2usdContract.decimals();
        const amountToStake = ethers.utils.parseUnits(STAKE_AMOUNT_STRING, decimals);
        const currentBalance = await r2usdContract.balanceOf(wallet.address);
        if (currentBalance.lt(amountToStake)) { throw new Error(`Insufficient R2USD balance.`); }
        await approveToken(wallet, TOKEN_ADDRESSES.R2USD, STAKING_CONTRACT_ADDRESS, amountToStake);
        await randomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS);
        await renderScreen(wallet);
        const txFunction = () => {
            const functionSelector = '0x1a5f0f00';
            const types = Array(10).fill('uint256');
            const values = [amountToStake, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            const calldata = functionSelector + ethers.utils.defaultAbiCoder.encode(types, values).substring(2);
            return wallet.sendTransaction({ to: STAKING_CONTRACT_ADDRESS, data: calldata, gasLimit: 300000 });
        };
        await executeTxWithRetries("Stake R2USD (New Method)", txFunction, wallet);
    } catch (error) { addToLog(`🔴 TOTAL FAILURE during R2USD Staking: ${error.message}`); }
}

async function main() {
    const keysPath = path.join(__dirname, 'private_keys.txt');
    if (!fs.existsSync(keysPath)) {
        addToLog(`🔴 private_keys.txt file not found.`);
        renderScreen();
        return;
    }
    
    const keyData = fs.readFileSync(keysPath, 'utf8');
    
    validateAndSync(keyData);
    
    const privateKeys = keyData.split('\n').map(k => k.trim()).filter(k => k.startsWith('0x'));
    
    const proxiesPath = path.join(__dirname, 'proxies.txt');
    const proxies = fs.existsSync(proxiesPath) ? fs.readFileSync(proxiesPath, 'utf8').split('\n').map(p => p.trim()).filter(p => p) : [];
    
    addToLog(`Found ${privateKeys.length} wallets and ${proxies.length} proxies. Starting workflow (ethers v5)...`);

    for (let i = 0; i < privateKeys.length; i++) {
        logHistory = [];
        const wallet = new ethers.Wallet(privateKeys[i], getProvider(proxies[i]));
        addToLog(`\n================================================================`);
        addToLog(`--- PROCESSING WALLET ${i + 1}/${privateKeys.length}: ${wallet.address} ---`);
        
        await renderScreen(wallet);
        
        const allConfigs = [
            { config: TRADE_BOT_CONFIG, runner: runTradingCyclesForWallet, name: "TRADING CYCLE (Volume)" },
            { config: ASSET_ACQUISITION_CONFIG, runner: runAssetAcquisition, name: "ASSET ACQUISITION" },
            { config: LIQUIDITY_CONFIG, runner: async (w) => { for (const pair of LIQUIDITY_CONFIG.PAIRS) { await addLiquidityForPair(w, pair); await randomDelay(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS); await renderScreen(w); } }, name: "ADD LIQUIDITY" },
            { config: R2USD_STAKING_CONFIG, runner: runR2usdStakingForWallet, name: "sR2USD STAKING" },
            { config: BTC_YIELD_CONFIG, runner: runBtcYieldDepositForWallet, name: "BTC YIELD DEPOSIT" }
        ];

        for (const stage of allConfigs) {
            if (stage.config.ENABLED) {
                addToLog(`\n--- STAGE: ${stage.name} ---`);
                await renderScreen(wallet);
                await stage.runner(wallet);
            }
        }
        
        addToLog(`\n--- ✅ ALL TASKS FOR WALLET ${wallet.address} COMPLETED ---`);
        await renderScreen(wallet);

        if (i < privateKeys.length - 1) {
            addToLog(`\n--- TAKING A LONG PAUSE BEFORE NEXT WALLET ---`);
            await renderScreen(wallet);
            await randomDelay(30, 60);
        }
    }
    
    addToLog(`\n\n🎊🎊🎊 ALL PROCESSES FOR ALL WALLETS HAVE BEEN COMPLETED. 🎊🎊🎊`);
    logUpdate.done();
}

main().catch(error => { 
    addToLog(`🔴 An unexpected fatal error occurred: ${error}`);
    renderScreen(); 
    logUpdate.done(); 
});
