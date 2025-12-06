# 🕊️ Umut NFT - Yardım Kampanyası

Boyundan altı felçli kardeşimiz için düzenlenen yardım NFT projesi. Tüm gelirler şeffaf ve güvenli bir şekilde doğrudan faydalanıcıya ulaşır.

![Umut NFT](https://bafybeifheknvajfjwmret5qulhx5rzyet4ihefrhxw74xb5amof7b6dwge.ipfs.dweb.link?filename=Gemini_Generated_Image_n02estn02estn02e.png)

## ✨ Özellikler

- **%100 Güvenli**: Beneficiary adresi `immutable` - değiştirilemez
- **Tam Şeffaflık**: Tüm işlemler blockchain üzerinde görünür
- **Direkt Transfer**: Toplanan bağışlar aracısız olarak faydalanıcıya ulaşır
- **Düşük Gas Fee**: Base ağı desteği ile uygun maliyetli mint

## 📁 Proje Yapısı

```
ufukless1-nft-project/
├── contracts/
│   └── UmutNFT.sol          # Ana NFT kontratı
├── scripts/
│   ├── deploy.js            # Deploy scripti
│   └── generate-metadata.js # Metadata oluşturucu
├── test/
│   └── UmutNFT.test.js      # Test dosyaları
├── frontend/
│   ├── index.html           # Mint sayfası
│   ├── styles.css           # Stiller
│   └── app.js               # Web3 entegrasyonu
├── metadata/
│   └── *.json               # NFT metadata dosyaları
├── hardhat.config.js        # Hardhat konfigürasyonu
└── package.json             # Bağımlılıklar
```

## 🚀 Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Kontratı Derle

```bash
npm run compile
```

### 3. Testleri Çalıştır

```bash
npm run test
```

## 📤 Deploy

### Sepolia Testnet (Test için)

```bash
# .env dosyasını oluştur ve değerleri gir
cp .env.example .env

# Deploy et
npm run deploy:sepolia
```

### Base Mainnet (Gerçek deploy)

```bash
npm run deploy:base
```

### Lokal Test

```bash
# Terminal 1: Lokal node başlat
npm run node

# Terminal 2: Deploy et
npm run deploy:local
```

## ⚙️ Konfigürasyon

Deploy öncesi `scripts/deploy.js` dosyasında şunları güncelleyin:

```javascript
// ⚠️ ÖNEMLİ: Kardeşinizin cüzdan adresini girin!
const BENEFICIARY_ADDRESS = "0x...";

// Mint fiyatı (varsayılan: 0.005 ETH)
const MINT_PRICE = ethers.parseEther("0.005");

// Maksimum arz
const MAX_SUPPLY = 1000;

// Metadata URI
const BASE_URI = "ipfs://YOUR_CID/";
```

## 🖼️ Metadata Hazırlama

```bash
# Tüm metadata dosyalarını oluştur
node scripts/generate-metadata.js

# metadata klasörünü IPFS'e yükle (Pinata, NFT.Storage vb.)
# Aldığın CID'i BASE_URI olarak kullan
```

## 🌐 Frontend

Deploy sonrası `frontend/app.js` dosyasında kontrat adresini güncelleyin:

```javascript
const CONFIG = {
    CONTRACT_ADDRESS: "0x...", // Deploy edilen kontrat adresi
    // ...
};
```

Frontend'i çalıştırmak için:

```bash
npm run frontend
# veya
npx live-server frontend --port=3000
```

## 🔒 Güvenlik

Bu kontrat şu güvenlik önlemlerini içerir:

1. **Immutable Beneficiary**: Faydalanıcı adresi deploy sonrası değiştirilemez
2. **Public Withdraw**: Herkes withdraw çağırabilir, para sadece beneficiary'ye gider
3. **OpenZeppelin**: Güvenilir ve audit edilmiş kütüphaneler kullanılır
4. **Event Logging**: Tüm önemli işlemler loglanır

## 📊 Kontrat Fonksiyonları

| Fonksiyon | Açıklama |
|-----------|----------|
| `mint()` | 1 adet NFT mint eder |
| `mintMultiple(uint256)` | Birden fazla NFT mint eder (max 10) |
| `withdraw()` | Biriken bağışları beneficiary'ye gönderir |
| `setMintPrice(uint256)` | Mint fiyatını günceller (sadece owner) |
| `beneficiary()` | Faydalanıcı adresini gösterir |
| `totalMinted()` | Toplam mint edilen NFT sayısı |
| `contractBalance()` | Kontrattaki bakiye |

## 🤝 Desteklenen Ağlar

| Ağ | Chain ID | Tavsiye |
|----|----------|---------|
| Ethereum Mainnet | 1 | Yüksek değerli koleksiyonlar için |
| Base | 8453 | ✅ **Önerilen** - Düşük gas fee |
| Sepolia | 11155111 | Test için |
| Base Sepolia | 84532 | Test için |

## 💜 Katkıda Bulunma

Bu proje hayır amaçlıdır. Her türlü katkı ve destek değerlidir.

---

**Geçmiş olsun, iyilik kazansın. 🤲**

