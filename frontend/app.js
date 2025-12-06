// ============================================
// UMUT NFT - FRONTEND APPLICATION
// Chainlink Oracle ile Dinamik USD Fiyatlama
// WalletConnect v2 Desteği
// ============================================

// WalletConnect Project ID
const WALLETCONNECT_PROJECT_ID = "3d952de0f0976938939b55baced7d6d6";

// ⚠️ ÖNEMLİ: Bu adresleri deploy sonrası güncelleyin!
const CONFIG = {
    // Kontrat adresi - Base Mainnet
    CONTRACT_ADDRESS: "0xFE4D6A499C14b77025Ce236c25124f1712419b14",
    
    // Sabit USD fiyatı (frontend gösterimi için)
    MINT_PRICE_USD: 10,
    
    // Desteklenen ağlar
    NETWORKS: {
        // Base Mainnet
        8453: {
            name: "Base",
            symbol: "ETH",
            explorer: "https://basescan.org",
            rpc: "https://mainnet.base.org"
        }
    },
    
    // Tercih edilen ağ (Base Mainnet)
    PREFERRED_CHAIN_ID: 8453
};

// Kontrat ABI - Chainlink Oracle destekli
const CONTRACT_ABI = [
    "function mint() external payable",
    "function mintMultiple(uint256 quantity) external payable",
    "function withdraw() external",
    "function beneficiaryWithdraw() external",
    "function beneficiary() external view returns (address)",
    "function mintPriceUSD() external view returns (uint256)",
    "function getMintPriceInETH() external view returns (uint256)",
    "function getLatestETHPrice() external view returns (uint256)",
    "function maxSupply() external view returns (uint256)",
    "function totalMinted() external view returns (uint256)",
    "function totalDonationsCollected() external view returns (uint256)",
    "function contractBalance() external view returns (uint256)",
    "function remainingSupply() external view returns (uint256)",
    "event NFTMinted(address indexed minter, uint256 indexed tokenId, uint256 amountETH, uint256 amountUSD)",
    "event DonationWithdrawn(address indexed beneficiary, uint256 amount)"
];

// ============================================
// STATE
// ============================================

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let currentChainId = null;

let mintPriceETH = BigInt(0);
let mintPriceUSD = 0;
let ethPriceUSD = 0;
let maxSupply = 0;
let totalMinted = 0;
let quantity = 1;

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    connectWallet: document.getElementById('connectWallet'),
    walletText: document.querySelector('.wallet-text'),
    mintButton: document.getElementById('mintButton'),
    quantity: document.getElementById('quantity'),
    decreaseQty: document.getElementById('decreaseQty'),
    increaseQty: document.getElementById('increaseQty'),
    mintedCount: document.getElementById('mintedCount'),
    maxSupply: document.getElementById('maxSupply'),
    mintPrice: document.getElementById('mintPrice'),
    totalPrice: document.getElementById('totalPrice'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    beneficiaryAddress: document.getElementById('beneficiaryAddress'),
    totalCollected: document.getElementById('totalCollected'),
    pendingBalance: document.getElementById('pendingBalance'),
    etherscanLink: document.getElementById('etherscanLink'),
    copyAddress: document.getElementById('copyAddress'),
    beneficiaryWithdraw: document.getElementById('beneficiaryWithdraw'),
    toast: document.getElementById('toast'),
    modal: document.getElementById('modal'),
    modalIcon: document.getElementById('modalIcon'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    modalLoader: document.getElementById('modalLoader'),
    modalClose: document.getElementById('modalClose'),
    modalTwitterShare: document.getElementById('modalTwitterShare'),
    twitterShareLink: document.getElementById('twitterShareLink'),
    // Wallet Modal
    walletModal: document.getElementById('walletModal'),
    closeWalletModal: document.getElementById('closeWalletModal'),
    connectMetaMask: document.getElementById('connectMetaMask'),
    connectCoinbase: document.getElementById('connectCoinbase'),
    connectBrave: document.getElementById('connectBrave'),
    connectRabby: document.getElementById('connectRabby'),
    connectWalletConnect: document.getElementById('connectWalletConnect')
};

// ============================================
// UTILITIES
// ============================================

function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEther(wei) {
    return (Number(wei) / 1e18).toFixed(4);
}

function parseEther(ether) {
    // String bazlı hesaplama ile hassasiyet kaybını önle
    const [whole, decimal = ''] = String(ether).split('.');
    const paddedDecimal = decimal.padEnd(18, '0').slice(0, 18);
    return BigInt(whole + paddedDecimal);
}

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 4000);
}

function showModal(icon, title, message, showLoader = true, showClose = false) {
    elements.modalIcon.textContent = icon;
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    elements.modalLoader.style.display = showLoader ? 'block' : 'none';
    elements.modalClose.style.display = showClose ? 'block' : 'none';
    elements.modalTwitterShare.style.display = 'none'; // Varsayılan olarak gizle
    elements.modal.classList.add('show');
}

function showTwitterShareButton(quantity) {
    const tweetText = `💜 Sen de Ufuk'a Umut Ol! 💜\n\n${quantity} NFT satın alarak yardım kampanyasına katıldım. Boyundan altı felçli kardeşimiz @ufukless1 için her NFT $10 değerinde bağış!\n\n#UmutNFT #UfukaUmutOl #NFT #Charity`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(window.location.href)}`;
    
    elements.twitterShareLink.href = tweetUrl;
    elements.modalTwitterShare.style.display = 'block';
}

function hideModal() {
    elements.modal.classList.remove('show');
}

// ============================================
// WALLET CONNECTION
// ============================================

function showWalletModal() {
    try {
        // Eğer zaten bağlıysa, bağlantıyı kes
        if (userAddress) {
            disconnectWallet();
            return;
        }
        
        // 🛡️ Kontrat adresi kontrolü
        if (CONFIG.CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
            showToast('Kontrat henüz deploy edilmemiş!', 'error');
            console.error('❌ CONTRACT_ADDRESS güncellenmemiş! Deploy sonrası app.js dosyasını güncelleyin.');
            return;
        }
        
        // Wallet seçim modalını göster
        if (!elements.walletModal) {
            console.error('❌ Wallet modal elementi bulunamadı!');
            showToast('Sayfa yüklenirken bir hata oluştu. Lütfen yenileyin.', 'error');
            return;
        }
        
        elements.walletModal.classList.add('show');
        console.log('✅ Wallet modal açıldı');
    } catch (error) {
        console.error('❌ showWalletModal hatası:', error);
        showToast('Cüzdan modalı açılamadı. Lütfen sayfayı yenileyin.', 'error');
    }
}

function hideWalletModal() {
    elements.walletModal.classList.remove('show');
}

async function connectWithProvider(providerType) {
    try {
        hideWalletModal();
        
        console.log(`🔗 ${providerType} ile bağlanılıyor...`);
        
        // Provider kontrolü
        let ethereumProvider = null;
        
        // window.ethereum erişimini güvenli şekilde kontrol et
        let ethereum = null;
        try {
            ethereum = window.ethereum;
        } catch (e) {
            console.warn('window.ethereum erişim hatası:', e);
        }
        
        if (providerType === 'metamask') {
            if (ethereum?.isMetaMask) {
                ethereumProvider = ethereum;
            } else if (ethereum?.providers) {
                ethereumProvider = ethereum.providers.find(p => p.isMetaMask);
            }
            if (!ethereumProvider) {
                showToast('MetaMask yüklü değil!', 'error');
                window.open('https://metamask.io/download/', '_blank');
                return;
            }
            
            // MetaMask için otomatik bağlantı - önce mevcut hesapları kontrol et
            try {
                const accounts = await ethereumProvider.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    // Zaten bağlı, direkt devam et
                    userAddress = accounts[0];
                    provider = new ethers.BrowserProvider(ethereumProvider);
                    signer = await provider.getSigner();
                    const network = await provider.getNetwork();
                    currentChainId = Number(network.chainId);
                    
                    if (!CONFIG.NETWORKS[currentChainId]) {
                        showToast('Lütfen Base Mainnet ağına geçin!', 'warning');
                        await switchToBase(ethereumProvider);
                        return;
                    }
                    
                    contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    elements.walletText.innerHTML = `${formatAddress(userAddress)} <small>⏏</small>`;
                    elements.connectWallet.classList.add('connected');
                    elements.connectWallet.title = 'Bağlantıyı kesmek için tıkla';
                    elements.mintButton.disabled = false;
                    showToast(`MetaMask ile bağlandı!`, 'success');
                    await loadContractData();
                    setupWalletListeners(ethereumProvider);
                    return;
                }
            } catch (e) {
                console.log('Auto-connect check failed:', e);
            }
        } else if (providerType === 'coinbase') {
            if (ethereum?.isCoinbaseWallet) {
                ethereumProvider = ethereum;
            } else if (ethereum?.providers) {
                ethereumProvider = ethereum.providers.find(p => p.isCoinbaseWallet);
            } else if (window.coinbaseWalletExtension) {
                ethereumProvider = window.coinbaseWalletExtension;
            }
            if (!ethereumProvider) {
                showToast('Coinbase Wallet yüklü değil!', 'error');
                window.open('https://www.coinbase.com/wallet', '_blank');
                return;
            }
        } else if (providerType === 'brave') {
            if (ethereum?.isBraveWallet) {
                ethereumProvider = ethereum;
            }
            if (!ethereumProvider) {
                showToast('Brave Wallet bulunamadı! Brave tarayıcı kullanın.', 'error');
                return;
            }
        } else if (providerType === 'rabby') {
            if (ethereum?.isRabby) {
                ethereumProvider = ethereum;
            } else if (ethereum?.providers) {
                ethereumProvider = ethereum.providers.find(p => p.isRabby);
            }
            if (!ethereumProvider) {
                showToast('Rabby Wallet yüklü değil!', 'error');
                window.open('https://rabby.io/', '_blank');
                return;
            }
            
            // Rabby için de otomatik bağlantı
            try {
                const accounts = await ethereumProvider.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    userAddress = accounts[0];
                    provider = new ethers.BrowserProvider(ethereumProvider);
                    signer = await provider.getSigner();
                    const network = await provider.getNetwork();
                    currentChainId = Number(network.chainId);
                    
                    if (!CONFIG.NETWORKS[currentChainId]) {
                        showToast('Lütfen Base Mainnet ağına geçin!', 'warning');
                        await switchToBase(ethereumProvider);
                        return;
                    }
                    
                    contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    elements.walletText.innerHTML = `${formatAddress(userAddress)} <small>⏏</small>`;
                    elements.connectWallet.classList.add('connected');
                    elements.connectWallet.title = 'Bağlantıyı kesmek için tıkla';
                    elements.mintButton.disabled = false;
                    showToast(`Rabby ile bağlandı!`, 'success');
                    await loadContractData();
                    setupWalletListeners(ethereumProvider);
                    return;
                }
            } catch (e) {
                console.log('Rabby auto-connect check failed:', e);
            }
        } else {
            // Varsayılan - herhangi bir provider
            ethereumProvider = window.ethereum;
        }
        
        if (!ethereumProvider) {
            console.error('❌ Ethereum provider bulunamadı');
            showToast('Cüzdan bulunamadı! Lütfen bir Web3 cüzdan yükleyin.', 'error');
            return;
        }
        
        console.log('✅ Provider bulundu:', providerType);
        
        showModal('👛', 'Cüzdan Bağlanıyor', 'Lütfen cüzdanınızda bağlantıyı onaylayın...');
        
        // Request accounts
        const accounts = await ethereumProvider.request({
            method: 'eth_requestAccounts'
        });
        
        userAddress = accounts[0];
        
        // Setup ethers provider
        provider = new ethers.BrowserProvider(ethereumProvider);
        signer = await provider.getSigner();
        
        // Get chain ID
        const network = await provider.getNetwork();
        currentChainId = Number(network.chainId);
        
        // Check if network is supported
        if (!CONFIG.NETWORKS[currentChainId]) {
            hideModal();
            showToast('Desteklenmeyen ağ! Lütfen Base Mainnet ağına geçin.', 'warning');
            await switchToBase(ethereumProvider);
            return;
        }
        
        // Setup contract
        contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        // Update UI
        elements.walletText.innerHTML = `${formatAddress(userAddress)} <small>⏏</small>`;
        elements.connectWallet.classList.add('connected');
        elements.connectWallet.title = 'Bağlantıyı kesmek için tıkla';
        elements.mintButton.disabled = false;
        
        hideModal();
        showToast(`Bağlandı: ${CONFIG.NETWORKS[currentChainId].name}`, 'success');
        
        // Load contract data
        await loadContractData();
        
        // Fiyatı periyodik olarak güncelle (her 30 saniye)
        setInterval(refreshPrice, 30000);
        
        // Listen for account/chain changes
        setupWalletListeners(ethereumProvider);
        
    } catch (error) {
        hideModal();
        console.error('❌ Bağlantı hatası:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
            showToast('Bağlantı reddedildi.', 'warning');
        } else if (error.message?.includes('User rejected')) {
            showToast('Bağlantı kullanıcı tarafından reddedildi.', 'warning');
        } else {
            showToast(`Cüzdan bağlantısı başarısız: ${error.message || 'Bilinmeyen hata'}`, 'error');
        }
    }
}

async function switchToBase(ethereumProvider) {
    try {
        await ethereumProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }] // 8453 in hex
        });
    } catch (switchError) {
        // Ağ eklenmemişse ekle
        if (switchError.code === 4902) {
            try {
                await ethereumProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x2105',
                        chainName: 'Base',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://mainnet.base.org'],
                        blockExplorerUrls: ['https://basescan.org']
                    }]
                });
            } catch (addError) {
                showToast('Ağ eklenemedi!', 'error');
            }
        }
    }
}

function setupWalletListeners(ethereumProvider) {
    ethereumProvider.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
        } else {
            userAddress = accounts[0];
            elements.walletText.innerHTML = `${formatAddress(userAddress)} <small>⏏</small>`;
            showToast('Hesap değiştirildi.', 'info');
        }
    });
    
    ethereumProvider.on('chainChanged', () => {
        window.location.reload();
    });
    
    // WalletConnect disconnect event
    if (ethereumProvider.on) {
        ethereumProvider.on('disconnect', () => {
            disconnectWallet();
        });
    }
}

// WalletConnect bağlantısı
async function connectWithWalletConnect() {
    hideWalletModal();
    
    try {
        showModal('📱', 'QR Kod Yükleniyor', 'WalletConnect hazırlanıyor...');
        
        // Dinamik import ile WalletConnect yükle
        const { EthereumProvider } = await import('https://esm.sh/@walletconnect/ethereum-provider@2.11.0');
        
        const wcProvider = await EthereumProvider.init({
            projectId: WALLETCONNECT_PROJECT_ID,
            chains: [8453], // Base Mainnet
            optionalChains: [],
            showQrModal: true,
            metadata: {
                name: 'Umut NFT',
                description: 'Yardım Amaçlı NFT Projesi',
                url: window.location.origin,
                icons: ['https://avatars.githubusercontent.com/u/37784886']
            }
        });
        
        hideModal();
        
        // Bağlantı iste
        await wcProvider.connect();
        
        showModal('👛', 'Bağlanıyor', 'Cüzdan bağlantısı kuruluyor...');
        
        const accounts = wcProvider.accounts;
        if (!accounts || accounts.length === 0) {
            throw new Error('Hesap bulunamadı');
        }
        
        userAddress = accounts[0];
        
        // Setup ethers provider
        provider = new ethers.BrowserProvider(wcProvider);
        signer = await provider.getSigner();
        
        // Get chain ID
        const network = await provider.getNetwork();
        currentChainId = Number(network.chainId);
        
        // Check if network is supported
        if (!CONFIG.NETWORKS[currentChainId]) {
            hideModal();
            showToast('Lütfen Base Mainnet ağına geçin!', 'warning');
            return;
        }
        
        // Setup contract
        contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        // Update UI
        elements.walletText.innerHTML = `${formatAddress(userAddress)} <small>⏏</small>`;
        elements.connectWallet.classList.add('connected');
        elements.connectWallet.title = 'Bağlantıyı kesmek için tıkla';
        elements.mintButton.disabled = false;
        
        hideModal();
        showToast(`WalletConnect ile bağlandı!`, 'success');
        
        // Load contract data
        await loadContractData();
        
        // Setup listeners
        setupWalletListeners(wcProvider);
        
        // Store provider for disconnect
        window.wcProvider = wcProvider;
        
    } catch (error) {
        hideModal();
        console.error('WalletConnect hatası:', error);
        
        if (error.message?.includes('User rejected')) {
            showToast('Bağlantı reddedildi.', 'warning');
        } else {
            showToast('WalletConnect bağlantısı başarısız!', 'error');
        }
    }
}

async function disconnectWallet() {
    // WalletConnect bağlantısını kapat
    if (window.wcProvider) {
        try {
            await window.wcProvider.disconnect();
        } catch (e) {
            console.log('WC disconnect error:', e);
        }
        window.wcProvider = null;
    }
    
    // State'i temizle
    userAddress = null;
    provider = null;
    signer = null;
    contract = null;
    currentChainId = null;
    
    // UI'ı güncelle
    elements.walletText.innerHTML = '👛 Cüzdan Bağla';
    elements.connectWallet.classList.remove('connected');
    elements.connectWallet.title = '';
    elements.mintButton.disabled = true;
    
    // Demo değerlere dön
    elements.mintPrice.innerHTML = `$${CONFIG.MINT_PRICE_USD} <small>(~0.003 ETH)</small>`;
    elements.beneficiaryAddress.textContent = 'Kontrat bağlandığında görünecek';
    elements.totalCollected.textContent = '0 ETH';
    elements.pendingBalance.textContent = '0 ETH';
    mintPriceETH = parseEther('0.003');
    mintPriceUSD = CONFIG.MINT_PRICE_USD;
    updateTotalPrice();
    
    showToast('Cüzdan bağlantısı kesildi.', 'info');
}

// ============================================
// CONTRACT INTERACTIONS
// ============================================

async function loadContractData() {
    if (!contract) return;
    
    try {
        // Get contract data
        const [
            _mintPriceETH,
            _mintPriceUSD,
            _ethPrice,
            _maxSupply,
            _totalMinted,
            _beneficiary,
            _totalCollected,
            _balance
        ] = await Promise.all([
            contract.getMintPriceInETH(),
            contract.mintPriceUSD(),
            contract.getLatestETHPrice(),
            contract.maxSupply(),
            contract.totalMinted(),
            contract.beneficiary(),
            contract.totalDonationsCollected(),
            contract.contractBalance()
        ]);
        
        mintPriceETH = _mintPriceETH;
        mintPriceUSD = Number(_mintPriceUSD) / 1e8; // 8 decimals
        ethPriceUSD = Number(_ethPrice) / 1e8; // 8 decimals
        maxSupply = Number(_maxSupply);
        totalMinted = Number(_totalMinted);
        
        // Update UI - Hem USD hem ETH göster
        elements.mintPrice.innerHTML = `$${mintPriceUSD} <small>(${formatEther(_mintPriceETH)} ETH)</small>`;
        elements.maxSupply.textContent = maxSupply;
        elements.mintedCount.textContent = totalMinted;
        elements.beneficiaryAddress.textContent = _beneficiary;
        elements.totalCollected.textContent = `${formatEther(_totalCollected)} ETH`;
        elements.pendingBalance.textContent = `${formatEther(_balance)} ETH`;
        
        // Beneficiary kontrolü - eğer kullanıcı beneficiary ise withdraw butonunu göster
        if (userAddress && userAddress.toLowerCase() === _beneficiary.toLowerCase()) {
            elements.beneficiaryWithdraw.style.display = 'block';
        } else {
            elements.beneficiaryWithdraw.style.display = 'none';
        }
        
        // Update progress
        const progress = (totalMinted / maxSupply) * 100;
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `%${progress.toFixed(1)} Tamamlandı`;
        
        // Update explorer link
        const network = CONFIG.NETWORKS[currentChainId];
        if (network && network.explorer) {
            elements.etherscanLink.href = `${network.explorer}/address/${CONFIG.CONTRACT_ADDRESS}`;
        }
        
        // Update total price
        updateTotalPrice();
        
        console.log(`💰 ETH Fiyatı: $${ethPriceUSD.toFixed(2)}`);
        console.log(`🏷️ Mint Fiyatı: $${mintPriceUSD} = ${formatEther(mintPriceETH)} ETH`);
        
    } catch (error) {
        console.error('Kontrat verisi yüklenemedi:', error);
        
        // Demo mode for testing
        elements.mintPrice.innerHTML = `$${CONFIG.MINT_PRICE_USD} <small>(~0.003 ETH)</small>`;
        mintPriceETH = parseEther('0.003');
        mintPriceUSD = CONFIG.MINT_PRICE_USD;
        showToast('Kontrat bağlantısı kurulamadı. Demo mod.', 'warning');
    }
}

async function refreshPrice() {
    if (!contract) return;
    
    try {
        const [_mintPriceETH, _ethPrice] = await Promise.all([
            contract.getMintPriceInETH(),
            contract.getLatestETHPrice()
        ]);
        
        mintPriceETH = _mintPriceETH;
        ethPriceUSD = Number(_ethPrice) / 1e8;
        
        elements.mintPrice.innerHTML = `$${mintPriceUSD} <small>(${formatEther(_mintPriceETH)} ETH)</small>`;
        updateTotalPrice();
        
        console.log(`🔄 Fiyat güncellendi: $${mintPriceUSD} = ${formatEther(mintPriceETH)} ETH`);
    } catch (error) {
        console.error('Fiyat güncellenemedi:', error);
    }
}

async function mintNFT() {
    if (!contract || !signer) {
        showToast('Önce cüzdanınızı bağlayın!', 'error');
        return;
    }
    
    try {
        // Kullanıcı bakiyesini kontrol et
        const balance = await provider.getBalance(userAddress);
        
        // Güncel fiyatı al
        const currentPrice = await contract.getMintPriceInETH();
        const totalCost = currentPrice * BigInt(quantity);
        
        // Gas fee tahmini
        let gasEstimate;
        try {
            if (quantity === 1) {
                gasEstimate = await contract.mint.estimateGas({ value: totalCost });
            } else {
                gasEstimate = await contract.mintMultiple.estimateGas(quantity, { value: totalCost });
            }
        } catch (e) {
            // Gas estimate başarısız olursa varsayılan değer kullan
            gasEstimate = 200000n; // ~200k gas
        }
        
        // Gas price al
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || 0n;
        const estimatedGasCost = gasEstimate * gasPrice;
        
        // Toplam maliyet: NFT fiyatı + gas
        const totalRequired = totalCost + estimatedGasCost;
        
        // %10 buffer ekle (güvenlik için)
        const totalWithBuffer = totalRequired + (totalRequired / 10n);
        
        // Bakiye kontrolü
        if (balance < totalWithBuffer) {
            const shortfall = totalWithBuffer - balance;
            const shortfallETH = formatEther(shortfall);
            showToast(`Yetersiz bakiye! Eksik: ~${shortfallETH} ETH (gas dahil)`, 'error');
            console.error('Bakiye yetersiz:', {
                balance: formatEther(balance),
                required: formatEther(totalWithBuffer),
                shortfall: shortfallETH
            });
            return;
        }
        
        showModal('⏳', 'İşlem Başlatılıyor', `$${mintPriceUSD * quantity} değerinde NFT mint ediliyor...`);
        
        let tx;
        if (quantity === 1) {
            tx = await contract.mint({ value: totalCost });
        } else {
            tx = await contract.mintMultiple(quantity, { value: totalCost });
        }
        
        showModal('⏳', 'İşlem Onaylanıyor', `Transaction: ${formatAddress(tx.hash)}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        // Success!
        showModal('🎉', 'Tebrikler!', `${quantity} NFT başarıyla mint edildi! $${mintPriceUSD * quantity} bağışınız için teşekkürler!`, false, true);
        
        // Twitter paylaşım butonu göster
        showTwitterShareButton(quantity);
        
        // Reload data
        await loadContractData();
        
        // Reset quantity
        quantity = 1;
        elements.quantity.value = 1;
        updateTotalPrice();
        
    } catch (error) {
        hideModal();
        console.error('Mint hatası:', error);
        
        if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
            showToast('İşlem kullanıcı tarafından iptal edildi.', 'warning');
        } else if (error.message?.includes('insufficient funds') || 
                   error.message?.includes('insufficient balance') ||
                   error.code === 'INSUFFICIENT_FUNDS') {
            // Daha detaylı bakiye kontrolü
            try {
                const balance = await provider.getBalance(userAddress);
                const currentPrice = await contract.getMintPriceInETH();
                const totalCost = currentPrice * BigInt(quantity);
                const balanceETH = formatEther(balance);
                const requiredETH = formatEther(totalCost);
                
                showToast(`Yetersiz bakiye! Bakiye: ${balanceETH} ETH, Gerekli: ~${requiredETH} ETH (gas dahil)`, 'error');
            } catch (e) {
                showToast('Yetersiz bakiye! Lütfen gas fee dahil yeterli ETH olduğundan emin olun.', 'error');
            }
        } else if (error.message?.includes('Stale price') || error.message?.includes('Stale price data')) {
            showToast('Fiyat verisi güncel değil. Lütfen tekrar deneyin.', 'error');
            await refreshPrice();
        } else if (error.message?.includes('Yetersiz bagis miktari')) {
            showToast('Gönderilen miktar yetersiz. Fiyat güncellenmiş olabilir.', 'error');
            await refreshPrice();
        } else {
            showToast(`Mint işlemi başarısız: ${error.message || 'Bilinmeyen hata'}`, 'error');
        }
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateTotalPrice() {
    const totalETH = mintPriceETH * BigInt(quantity);
    const totalUSD = mintPriceUSD * quantity;
    elements.totalPrice.innerHTML = `$${totalUSD} <small>(${formatEther(totalETH)} ETH)</small>`;
}

function updateQuantity(delta) {
    const newQty = quantity + delta;
    if (newQty >= 1 && newQty <= (maxSupply - totalMinted)) {
        quantity = newQty;
        elements.quantity.value = quantity;
        updateTotalPrice();
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Connect wallet - modal aç
    elements.connectWallet.addEventListener('click', showWalletModal);
    
    // Wallet modal kapatma
    elements.closeWalletModal.addEventListener('click', hideWalletModal);
    elements.walletModal.addEventListener('click', (e) => {
        if (e.target === elements.walletModal) hideWalletModal();
    });
    
    // Cüzdan seçenekleri
    elements.connectMetaMask.addEventListener('click', () => connectWithProvider('metamask'));
    elements.connectCoinbase.addEventListener('click', () => connectWithProvider('coinbase'));
    elements.connectBrave.addEventListener('click', () => connectWithProvider('brave'));
    elements.connectRabby.addEventListener('click', () => connectWithProvider('rabby'));
    elements.connectWalletConnect.addEventListener('click', connectWithWalletConnect);
    
    // Mint button
    elements.mintButton.addEventListener('click', mintNFT);
    
    // Quantity controls
    elements.decreaseQty.addEventListener('click', () => updateQuantity(-1));
    elements.increaseQty.addEventListener('click', () => updateQuantity(1));
    
    // Copy address
    elements.copyAddress.addEventListener('click', () => {
        const address = elements.beneficiaryAddress.textContent;
        navigator.clipboard.writeText(address);
        showToast('Adres kopyalandı!', 'success');
    });
    
    // Beneficiary withdraw
    elements.beneficiaryWithdraw.addEventListener('click', async () => {
        if (!contract || !signer) {
            showToast('Önce cüzdanınızı bağlayın!', 'error');
            return;
        }
        
        try {
            showModal('💰', 'Bağış Çekiliyor', 'Lütfen cüzdanınızda işlemi onaylayın...');
            
            const tx = await contract.beneficiaryWithdraw();
            
            showModal('⏳', 'İşlem Onaylanıyor', `Transaction: ${formatAddress(tx.hash)}`);
            
            const receipt = await tx.wait();
            
            showModal('✅', 'Başarılı!', 'Bağışlar başarıyla çekildi!', false, true);
            
            // Reload data
            await loadContractData();
            
        } catch (error) {
            hideModal();
            console.error('Withdraw hatası:', error);
            
            if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                showToast('İşlem kullanıcı tarafından iptal edildi.', 'warning');
            } else if (error.message?.includes('Sadece beneficiary')) {
                showToast('Bu işlemi sadece beneficiary yapabilir!', 'error');
            } else {
                showToast(`Çekme işlemi başarısız: ${error.message || 'Bilinmeyen hata'}`, 'error');
            }
        }
    });
    
    // Modal close
    elements.modalClose.addEventListener('click', hideModal);
}

// ============================================
// INITIALIZATION
// ============================================

// IPFS Gateway fallback sistemi
const IPFS_GATEWAYS = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://gateway.ipfs.io/ipfs/'
];

const NFT_IMAGE_HASH = 'bafybeifheknvajfjwmret5qulhx5rzyet4ihefrhxw74xb5amof7b6dwge';
const NFT_IMAGE_FILENAME = 'Gemini_Generated_Image_n02estn02estn02e.png';

function loadNFTImage() {
    const img = document.getElementById('nftImage');
    if (!img) return;
    
    let currentGatewayIndex = 0;
    
    function tryNextGateway() {
        if (currentGatewayIndex >= IPFS_GATEWAYS.length) {
            console.error('❌ Tüm IPFS gateway\'leri başarısız oldu');
            img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 400%22%3E%3Crect fill=%22%238B5CF6%22 width=%22400%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22white%22 font-size=%2240%22%3EUmut NFT%3C/text%3E%3C/svg%3E';
            return;
        }
        
        const gateway = IPFS_GATEWAYS[currentGatewayIndex];
        const imageUrl = `${gateway}${NFT_IMAGE_HASH}/${NFT_IMAGE_FILENAME}`;
        
        console.log(`🖼️ IPFS görsel yükleniyor: ${gateway}`);
        
        img.onerror = () => {
            console.warn(`❌ Gateway başarısız: ${gateway}`);
            currentGatewayIndex++;
            tryNextGateway();
        };
        
        img.onload = () => {
            console.log(`✅ Görsel yüklendi: ${gateway}`);
        };
        
        img.src = imageUrl;
    }
    
    tryNextGateway();
}

async function init() {
    console.log('🌟 Umut NFT Başlatılıyor...');
    console.log('💵 Sabit Fiyat: $' + CONFIG.MINT_PRICE_USD + ' USD (Chainlink Oracle)');
    
    setupEventListeners();
    
    // NFT görselini yükle
    loadNFTImage();
    
    // Set initial values for demo
    elements.mintPrice.innerHTML = `$${CONFIG.MINT_PRICE_USD} <small>(~0.003 ETH)</small>`;
    mintPriceETH = parseEther('0.003');
    mintPriceUSD = CONFIG.MINT_PRICE_USD;
    updateTotalPrice();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
