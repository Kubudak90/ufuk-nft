// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Chainlink Price Feed Interface
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/**
 * @title UmutNFT - Yardım Amaçlı NFT Kontratı
 * @notice Bu kontrat, belirlenen faydalanıcıya (beneficiary) yardım toplamak için tasarlanmıştır.
 * @dev Chainlink Oracle kullanarak mint fiyatını USD cinsinden sabitler.
 *      Tüm mint gelirleri sadece ve sadece immutable olarak tanımlanan beneficiary adresine gönderilebilir.
 */
contract UmutNFT is ERC721, Ownable, ReentrancyGuard {
    
    // ============ State Variables ============
    
    /// @notice Yardım alacak kardeşimizin cüzdan adresi (Değiştirilemez - Tam Şeffaflık)
    address payable public immutable beneficiary;
    
    /// @notice Chainlink ETH/USD Price Feed
    AggregatorV3Interface public immutable priceFeed;
    
    /// @notice Toplam mint edilen NFT sayısı
    uint256 public totalMinted;
    
    /// @notice NFT başına USD fiyatı (8 decimal - örn: 10 USD = 10 * 1e8)
    uint256 public mintPriceUSD;
    
    /// @notice Maksimum arz limiti
    uint256 public maxSupply;
    
    /// @notice NFT metadata için base URI
    string private _baseTokenURI;
    
    /// @notice Toplam toplanan bağış miktarı (tarihsel kayıt)
    uint256 public totalDonationsCollected;

    // ============ Events ============
    
    /// @notice Yeni bir NFT mint edildiğinde tetiklenir
    event NFTMinted(address indexed minter, uint256 indexed tokenId, uint256 amountETH, uint256 amountUSD);
    
    /// @notice Bağış çekildiğinde tetiklenir
    event DonationWithdrawn(address indexed beneficiary, uint256 amount);
    
    /// @notice USD fiyatı güncellendiğinde tetiklenir
    event PriceUpdatedUSD(uint256 oldPriceUSD, uint256 newPriceUSD);

    // ============ Constructor ============
    
    /**
     * @notice Kontratı başlatır
     * @param _beneficiaryAddress Yardım alacak kişinin cüzdan adresi (DEĞİŞTİRİLEMEZ)
     * @param _priceFeedAddress Chainlink ETH/USD Price Feed adresi
     * @param _mintPriceUSD NFT başına USD fiyatı (8 decimal - 10 USD = 10 * 1e8)
     * @param _maxSupply Maksimum NFT sayısı
     * @param baseURI_ NFT metadata base URI (IPFS)
     */
    constructor(
        address payable _beneficiaryAddress,
        address _priceFeedAddress,
        uint256 _mintPriceUSD,
        uint256 _maxSupply,
        string memory baseURI_
    ) ERC721("Umut NFT", "UMUT") Ownable(msg.sender) {
        require(_beneficiaryAddress != address(0), "Gecersiz beneficiary adresi");
        require(_priceFeedAddress != address(0), "Gecersiz price feed adresi");
        require(_maxSupply > 0, "Max supply sifirdan buyuk olmali");
        
        beneficiary = _beneficiaryAddress;
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        mintPriceUSD = _mintPriceUSD;
        maxSupply = _maxSupply;
        _baseTokenURI = baseURI_;
    }

    // ============ Price Functions ============
    
    /**
     * @notice Chainlink'ten güncel ETH/USD fiyatını çeker
     * @return price ETH fiyatı USD cinsinden (8 decimal)
     */
    function getLatestETHPrice() public view returns (uint256) {
        (
            /* uint80 roundID */,
            int256 price,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();
        
        // Fiyatın güncel olduğunu kontrol et (son 1 saat içinde)
        require(block.timestamp - updatedAt < 3600, "Stale price data");
        require(price > 0, "Invalid price");
        
        return uint256(price);
    }
    
    /**
     * @notice Mint fiyatını ETH cinsinden hesaplar
     * @return Mint fiyatı wei cinsinden
     */
    function getMintPriceInETH() public view returns (uint256) {
        uint256 ethPriceUSD = getLatestETHPrice(); // 8 decimals
        
        // mintPriceUSD (8 decimals) * 1e18 / ethPriceUSD (8 decimals) = wei
        // Örnek: 10 USD = 10 * 1e8, ETH = 3000 * 1e8
        // (10 * 1e8 * 1e18) / (3000 * 1e8) = 0.00333 ETH in wei
        return (mintPriceUSD * 1e18) / ethPriceUSD;
    }

    // ============ Mint Functions ============
    
    /**
     * @notice NFT mint eder ve bağış toplar
     * @dev Gönderilen ETH kontrat adresinde birikir, withdraw ile beneficiary'ye çekilir
     */
    function mint() external payable {
        require(totalMinted < maxSupply, "Tum NFT'ler satildi, tesekkurler!");
        
        uint256 requiredETH = getMintPriceInETH();
        require(msg.value >= requiredETH, "Yetersiz bagis miktari");
        
        totalMinted++;
        uint256 newTokenId = totalMinted;
        
        _safeMint(msg.sender, newTokenId);
        
        emit NFTMinted(msg.sender, newTokenId, msg.value, mintPriceUSD);
    }
    
    /**
     * @notice Birden fazla NFT mint eder
     * @param quantity Mint edilecek NFT sayısı
     */
    function mintMultiple(uint256 quantity) external payable {
        require(quantity > 0, "En az 1 adet olmali");
        require(totalMinted + quantity <= maxSupply, "Yeterli NFT kalmadi");
        
        uint256 requiredETH = getMintPriceInETH() * quantity;
        require(msg.value >= requiredETH, "Yetersiz bagis miktari");
        
        for (uint256 i = 0; i < quantity; i++) {
            totalMinted++;
            _safeMint(msg.sender, totalMinted);
            emit NFTMinted(msg.sender, totalMinted, msg.value / quantity, mintPriceUSD);
        }
    }

    // ============ Withdraw Functions ============
    
    /**
     * @notice Kontratta biriken bağışları beneficiary adresine gönderir
     * @dev Bu fonksiyonu herkes çağırabilir, ama para SADECE beneficiary'ye gider
     */
    function withdraw() external nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "Cekilecek bakiye yok");
        
        totalDonationsCollected += balance;
        
        (bool success, ) = beneficiary.call{value: balance}("");
        require(success, "Transfer basarisiz oldu");
        
        emit DonationWithdrawn(beneficiary, balance);
    }
    
    /**
     * @notice Sadece beneficiary tarafından çağrılabilen withdraw fonksiyonu
     * @dev Sadece beneficiary adresi bu fonksiyonu çağırabilir
     */
    function beneficiaryWithdraw() external nonReentrant {
        require(msg.sender == beneficiary, "Sadece beneficiary cagirabilir");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "Cekilecek bakiye yok");
        
        totalDonationsCollected += balance;
        
        (bool success, ) = beneficiary.call{value: balance}("");
        require(success, "Transfer basarisiz oldu");
        
        emit DonationWithdrawn(beneficiary, balance);
    }

    // ============ View Functions ============
    
    /**
     * @notice Kalan NFT sayısını döndürür
     */
    function remainingSupply() external view returns (uint256) {
        return maxSupply - totalMinted;
    }
    
    /**
     * @notice Kontrat bakiyesini döndürür
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice USD fiyatını döndürür (8 decimal)
     */
    function getMintPriceUSD() external view returns (uint256) {
        return mintPriceUSD;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice USD cinsinden mint fiyatını günceller
     * @param _newPriceUSD Yeni USD fiyatı (8 decimal - 10 USD = 10 * 1e8)
     */
    function setMintPriceUSD(uint256 _newPriceUSD) external onlyOwner {
        uint256 oldPrice = mintPriceUSD;
        mintPriceUSD = _newPriceUSD;
        emit PriceUpdatedUSD(oldPrice, _newPriceUSD);
    }
    
    /**
     * @notice Base URI'yi günceller
     * @param _newBaseURI Yeni base URI
     */
    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        _baseTokenURI = _newBaseURI;
    }

    // ============ Override Functions ============
    
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
