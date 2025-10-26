// Constants
const MIN_DENOMINATION_MSAT = 2 ** 10; // 1024 msat (smallest denomination)
const MAX_SELECTIONS = 4;

// State
let selectedDenominations = new Set();
let totalAmount = 0;
let btcUsdRate = null;
let qrImages = {}; // Cache for preloaded QR images

// SI prefixes for display (converting from msat to appropriate units)
const SI_PREFIXES = [
    { prefix: '', multiplier: 1, symbol: 'msat' },
    { prefix: '', multiplier: 1000, symbol: 'sat' },
    { prefix: 'k', multiplier: 1000000, symbol: 'ksat' },
    { prefix: 'M', multiplier: 1000000000, symbol: 'Msat' },
    { prefix: 'G', multiplier: 1000000000000, symbol: 'Gsat' },
    { prefix: 'T', multiplier: 1000000000000000, symbol: 'Tsat' }
];

// Generate denominations (powers of 2)
function generateDenominations() {
    const denominations = [];
    let currentDenomination = MIN_DENOMINATION_MSAT;

    // Generate denominations up to roughly 500 ksat
    // 500 ksat = 500,000 sat = 500,000,000 msat
    // 2^29 = 536,870,912 msat ≈ 537 ksat (close to 500 ksat)
    for (let i = 10; i <= 29; i++) {
        const amount = 2 ** i;
        denominations.push({
            value: amount,
            display: formatAmount(amount),
            power: i
        });
    }

    return denominations;
}

// Format amount with SI prefixes and 3 significant figures
function formatAmount(msat) {
    // Find the appropriate prefix (largest one that fits)
    let prefix = SI_PREFIXES[0]; // Default to msat
    for (let i = SI_PREFIXES.length - 1; i >= 0; i--) {
        if (msat >= SI_PREFIXES[i].multiplier) {
            prefix = SI_PREFIXES[i];
            break;
        }
    }

    const value = msat / prefix.multiplier;

    // Format to 3 significant figures
    const formatted = value.toPrecision(3);
    return `${formatted} ${prefix.symbol}`;
}

// Convert msat to USD
function msatToUsd(msat) {
    if (!btcUsdRate) return null;

    // Convert msat to BTC: msat / 100,000,000,000 (100B msat = 1 BTC)
    const btc = msat / 100000000000;

    // Convert BTC to USD
    const usd = btc * btcUsdRate;

    return usd;
}

// Format USD amount
function formatUsd(usd) {
    return `$${usd.toFixed(2)}`;
}

// Fetch Bitcoin price from FediBTC price feed
async function fetchBtcPrice() {
    try {
        const response = await fetch('https://price-feed.dev.fedibtc.com/latest');
        const data = await response.json();
        btcUsdRate = data.prices['BTC/USD'].rate;
        console.log('BTC/USD rate:', btcUsdRate);

        // Update the price input field
        const priceInput = document.getElementById('btcPrice');
        if (priceInput) {
            priceInput.value = btcUsdRate.toFixed(2);
        }

        return btcUsdRate;
    } catch (error) {
        console.error('Failed to fetch BTC price:', error);
        return null;
    }
}

// Update Bitcoin price from user input
function updateBtcPriceFromInput() {
    const priceInput = document.getElementById('btcPrice');
    const newPrice = parseFloat(priceInput.value);

    if (!isNaN(newPrice) && newPrice > 0) {
        btcUsdRate = newPrice;
        updateTotal(); // Refresh USD calculations
    }
}

// Create denomination button
function createDenominationButton(denomination) {
    const button = document.createElement('button');
    button.className = 'denomination-btn';
    button.textContent = denomination.display;
    button.dataset.value = denomination.value;
    button.dataset.power = denomination.power;

    button.addEventListener('click', () => toggleDenomination(denomination.value, button));

    return button;
}

// Show toast notification
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    // Set message and type
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;

    // Show toast
    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Toggle denomination selection
function toggleDenomination(value, button) {
    if (selectedDenominations.has(value)) {
        // Deselect
        selectedDenominations.delete(value);
        button.classList.remove('selected');
    } else {
        // Check if we can select more
        if (selectedDenominations.size >= MAX_SELECTIONS) {
            showToast(`You can only select up to ${MAX_SELECTIONS} denominations.`, 'warning');
            return;
        }

        // Select
        selectedDenominations.add(value);
        button.classList.add('selected');
    }

    updateTotal();
    updateQRCode();
}

// Update total amount display
function updateTotal() {
    totalAmount = Array.from(selectedDenominations).reduce((sum, value) => sum + value, 0);

    const totalElement = document.getElementById('totalAmount');
    const countElement = document.getElementById('selectedCount');
    const msatValuesElement = document.getElementById('msatValues');
    const copyButton = document.getElementById('copyButton');
    const usdValueElement = document.getElementById('usdValue');
    const usdAmountElement = document.getElementById('usdAmount');

    totalElement.textContent = formatAmount(totalAmount);
    countElement.textContent = selectedDenominations.size;

    // Update USD value display
    if (selectedDenominations.size > 0 && btcUsdRate) {
        const usdValue = msatToUsd(totalAmount);
        if (usdValue !== null) {
            usdAmountElement.textContent = formatUsd(usdValue);
            usdValueElement.style.display = 'block';
        } else {
            usdValueElement.style.display = 'none';
        }
    } else {
        usdValueElement.style.display = 'none';
    }

    // Update msat values text box
    if (selectedDenominations.size === 0) {
        msatValuesElement.value = '';
        msatValuesElement.placeholder = 'No denominations selected';
        copyButton.disabled = true;
    } else {
        const sortedValues = Array.from(selectedDenominations).sort((a, b) => a - b);
        msatValuesElement.value = sortedValues.join(',');
        msatValuesElement.placeholder = '';
        copyButton.disabled = false;
    }
}

// Preload all QR images
function preloadQRImages() {
    const imagePromises = [];

    for (let i = 0; i <= 4; i++) {
        const img = new Image();
        const qrPath = `example_notes/ecash_000${i}.png`;

        const promise = new Promise((resolve, reject) => {
            img.onload = () => {
                qrImages[i] = img;
                resolve();
            };
            img.onerror = reject;
            img.src = qrPath;
        });

        imagePromises.push(promise);
    }

    return Promise.all(imagePromises);
}

// Update QR code display based on number of selected denominations
function updateQRCode() {
    const qrImage = document.getElementById('qrImage');
    const qrInfo = document.getElementById('qrInfo');

    const count = selectedDenominations.size;
    const qrNumber = Math.min(count, 4); // Cap at 4 for the example images

    // Use preloaded image if available, otherwise fallback to src
    if (qrImages[qrNumber]) {
        qrImage.src = qrImages[qrNumber].src;
    } else {
        qrImage.src = `example_notes/ecash_000${qrNumber}.png`;
    }

    qrImage.alt = `QR Code density preview for ${count} denominations`;

    if (count === 0) {
        qrInfo.textContent = 'No denominations selected';
    } else if (count === 1) {
        qrInfo.textContent = '1 denomination selected';
    } else {
        qrInfo.textContent = `${count} denominations selected`;
    }
}

// Copy to clipboard functionality
function copyToClipboard() {
    const msatValuesElement = document.getElementById('msatValues');
    const copyButton = document.getElementById('copyButton');

    if (msatValuesElement.value) {
        navigator.clipboard.writeText(msatValuesElement.value).then(() => {
            // Show success feedback
            copyButton.textContent = 'Copied!';
            copyButton.classList.add('copied');
            showToast('Values copied to clipboard!', 'success');

            // Reset after 2 seconds
            setTimeout(() => {
                copyButton.textContent = 'Copy';
                copyButton.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            msatValuesElement.select();
            document.execCommand('copy');
            copyButton.textContent = 'Copied!';
            copyButton.classList.add('copied');
            showToast('Values copied to clipboard!', 'success');
            setTimeout(() => {
                copyButton.textContent = 'Copy';
                copyButton.classList.remove('copied');
            }, 2000);
        });
    }
}

// Initialize the app
async function initializeApp() {
    const denominations = generateDenominations();
    const grid = document.getElementById('denominationsGrid');

    // Preload QR images first
    try {
        await preloadQRImages();
        console.log('QR images preloaded successfully');
    } catch (error) {
        console.warn('Failed to preload some QR images:', error);
    }

    // Create and add denomination buttons
    denominations.forEach(denomination => {
        const button = createDenominationButton(denomination);
        grid.appendChild(button);
    });

    // Set up copy button event listener
    const copyButton = document.getElementById('copyButton');
    copyButton.addEventListener('click', copyToClipboard);

    // Set up price input event listeners
    const priceInput = document.getElementById('btcPrice');
    const refreshButton = document.getElementById('refreshPrice');

    priceInput.addEventListener('input', updateBtcPriceFromInput);
    priceInput.addEventListener('blur', updateBtcPriceFromInput);
    refreshButton.addEventListener('click', async () => {
        await fetchBtcPrice();
        updateTotal();
    });

    // Fetch Bitcoin price
    await fetchBtcPrice();

    // Initialize displays
    updateTotal();
    updateQRCode();
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
