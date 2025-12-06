const hre = require("hardhat");

// Chainlink ETH/USD Price Feed Adresleri
const PRICE_FEEDS = {
  // Ethereum Mainnet
  1: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  // Sepolia Testnet
  11155111: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  // Base Mainnet
  8453: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
  // Base Sepolia
  84532: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
  // Localhost - Mock kullanılacak
  31337: null
};

async function main() {
  console.log("🚀 UmutNFT Deploy Ediliyor...\n");

  // Ağ bilgisi
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`📡 Ağ: ${network.name} (Chain ID: ${chainId})\n`);

  // ✅ Kardeşimizin cüzdan adresi (DEĞİŞTİRİLEMEZ - immutable)
  const BENEFICIARY_ADDRESS = "0x6f0e1d29612009c52fb50ffecceffe62758a7623";

  // Price Feed adresi
  let priceFeedAddress = PRICE_FEEDS[chainId];
  
  // Localhost için Mock Price Feed deploy et
  if (chainId === 31337) {
    console.log("🔧 Localhost tespit edildi, Mock Price Feed deploy ediliyor...");
    const MockPriceFeed = await hre.ethers.getContractFactory("MockV3Aggregator");
    const mockPriceFeed = await MockPriceFeed.deploy(
      8,  // decimals
      3000 * 1e8  // initial price: $3000
    );
    await mockPriceFeed.waitForDeployment();
    priceFeedAddress = await mockPriceFeed.getAddress();
    console.log(`✅ Mock Price Feed: ${priceFeedAddress}\n`);
  }

  if (!priceFeedAddress) {
    console.error("❌ HATA: Bu ağ için Chainlink Price Feed adresi bulunamadı!");
    console.error("   Desteklenen ağlar: Ethereum, Sepolia, Base, Base Sepolia");
    process.exit(1);
  }
  
  // Mint fiyatı: 10 USD (Chainlink 8 decimal kullanır)
  const MINT_PRICE_USD = 10n * 10n**8n; // 10 USD = 10 * 1e8
  
  // Maksimum arz: 10,000 NFT
  const MAX_SUPPLY = 10000;
  
  // IPFS Base URI
  const BASE_URI = "ipfs://bafybeifheknvajfjwmret5qulhx5rzyet4ihefrhxw74xb5amof7b6dwge/";

  // Kontratı deploy et
  const UmutNFT = await hre.ethers.getContractFactory("UmutNFT");
  const umutNFT = await UmutNFT.deploy(
    BENEFICIARY_ADDRESS,
    priceFeedAddress,
    MINT_PRICE_USD,
    MAX_SUPPLY,
    BASE_URI
  );

  await umutNFT.waitForDeployment();

  const contractAddress = await umutNFT.getAddress();

  // Güncel fiyatı göster
  let currentETHPrice;
  try {
    currentETHPrice = await umutNFT.getMintPriceInETH();
  } catch (e) {
    currentETHPrice = 0n;
  }

  console.log("✅ UmutNFT başarıyla deploy edildi!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Kontrat Adresi: ${contractAddress}`);
  console.log(`👤 Faydalanıcı (Beneficiary): ${BENEFICIARY_ADDRESS}`);
  console.log(`🔗 Chainlink Price Feed: ${priceFeedAddress}`);
  console.log(`💵 Mint Fiyatı: $${Number(MINT_PRICE_USD) / 1e8} USD`);
  console.log(`💰 Güncel ETH Fiyatı: ~${hre.ethers.formatEther(currentETHPrice)} ETH`);
  console.log(`📦 Maksimum Arz: ${MAX_SUPPLY} NFT`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📝 Frontend config güncellemeyi unutmayın:");
  console.log(`   CONTRACT_ADDRESS = "${contractAddress}"`);
  console.log("\n🔍 Etherscan/Basescan'da kontratı doğrulayın:");
  console.log(`   npx hardhat verify --network <network> ${contractAddress} "${BENEFICIARY_ADDRESS}" "${priceFeedAddress}" "${MINT_PRICE_USD}" "${MAX_SUPPLY}" "${BASE_URI}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deploy hatası:", error);
    process.exit(1);
  });
