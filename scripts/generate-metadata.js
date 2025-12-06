/**
 * NFT Metadata Generator
 * Bu script, tüm NFT'ler için metadata JSON dosyalarını oluşturur
 */

const fs = require('fs');
const path = require('path');

// Konfigürasyon
const CONFIG = {
    // NFT Koleksiyon Bilgileri
    name: "Umut NFT",
    description: "Bu NFT, boyundan altı felçli kardeşimiz için toplanan yardım kampanyasının bir parçasıdır. Her mint, doğrudan faydalanıcının cüzdanına giden bir bağıştır. Teşekkürler! 💜",
    
    // Görsel IPFS CID'i
    image_cid: "bafybeifheknvajfjwmret5qulhx5rzyet4ihefrhxw74xb5amof7b6dwge",
    
    // Harici link
    external_url: "https://umut-nft.vercel.app",
    
    // Toplam NFT sayısı
    total_supply: 1000,
    
    // Çıktı klasörü
    output_dir: "./metadata"
};

// Metadata şablonu
function generateMetadata(tokenId) {
    return {
        name: `${CONFIG.name} #${tokenId}`,
        description: CONFIG.description,
        image: `ipfs://${CONFIG.image_cid}`,
        external_url: CONFIG.external_url,
        attributes: [
            {
                trait_type: "Kampanya",
                value: "Yardım NFT"
            },
            {
                trait_type: "Amaç",
                value: "Tıbbi Destek"
            },
            {
                trait_type: "Yıl",
                value: "2024"
            },
            {
                display_type: "number",
                trait_type: "Bağış Sırası",
                value: tokenId
            }
        ]
    };
}

// Ana fonksiyon
async function main() {
    console.log("🎨 NFT Metadata Oluşturucu\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Çıktı klasörünü oluştur
    const outputPath = path.resolve(CONFIG.output_dir);
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
    
    console.log(`📁 Çıktı klasörü: ${outputPath}`);
    console.log(`📦 Toplam NFT: ${CONFIG.total_supply}`);
    console.log("");
    
    // Her token için metadata oluştur
    for (let i = 1; i <= CONFIG.total_supply; i++) {
        const metadata = generateMetadata(i);
        const filename = `${i}.json`;
        const filepath = path.join(outputPath, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));
        
        // İlerleme göster
        if (i % 100 === 0 || i === 1 || i === CONFIG.total_supply) {
            const progress = ((i / CONFIG.total_supply) * 100).toFixed(1);
            console.log(`✅ ${i}/${CONFIG.total_supply} (%${progress}) tamamlandı`);
        }
    }
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Tüm metadata dosyaları oluşturuldu!\n");
    console.log("📤 Sonraki adımlar:");
    console.log("   1. 'metadata' klasörünü IPFS'e yükleyin (Pinata, NFT.Storage vb.)");
    console.log("   2. Aldığınız CID'i deploy script'inde BASE_URI olarak kullanın");
    console.log("   Örnek: ipfs://QmXXXX.../\n");
}

main().catch(console.error);

