const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UmutNFT", function () {
    let umutNFT;
    let mockPriceFeed;
    let owner;
    let beneficiary;
    let minter1;
    let minter2;
    
    const ETH_PRICE_USD = 3000n * 10n**8n; // $3000 (8 decimals)
    const MINT_PRICE_USD = 10n * 10n**8n;  // $10 (8 decimals)
    const MAX_SUPPLY = 10000;
    const BASE_URI = "ipfs://test/";
    
    // 10 USD / 3000 USD = 0.00333... ETH
    const EXPECTED_MINT_PRICE_ETH = (MINT_PRICE_USD * 10n**18n) / ETH_PRICE_USD;
    
    beforeEach(async function () {
        [owner, beneficiary, minter1, minter2] = await ethers.getSigners();
        
        // Deploy Mock Price Feed
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        mockPriceFeed = await MockV3Aggregator.deploy(8, ETH_PRICE_USD);
        await mockPriceFeed.waitForDeployment();
        
        // Deploy UmutNFT
        const UmutNFT = await ethers.getContractFactory("UmutNFT");
        umutNFT = await UmutNFT.deploy(
            beneficiary.address,
            await mockPriceFeed.getAddress(),
            MINT_PRICE_USD,
            MAX_SUPPLY,
            BASE_URI
        );
        
        await umutNFT.waitForDeployment();
    });
    
    describe("Deployment", function () {
        it("Doğru beneficiary adresi ayarlanmalı", async function () {
            expect(await umutNFT.beneficiary()).to.equal(beneficiary.address);
        });
        
        it("Doğru USD mint fiyatı ayarlanmalı", async function () {
            expect(await umutNFT.mintPriceUSD()).to.equal(MINT_PRICE_USD);
        });
        
        it("Doğru max supply ayarlanmalı", async function () {
            expect(await umutNFT.maxSupply()).to.equal(MAX_SUPPLY);
        });
        
        it("Token name ve symbol doğru olmalı", async function () {
            expect(await umutNFT.name()).to.equal("Umut NFT");
            expect(await umutNFT.symbol()).to.equal("UMUT");
        });
        
        it("Price feed adresi doğru ayarlanmalı", async function () {
            expect(await umutNFT.priceFeed()).to.equal(await mockPriceFeed.getAddress());
        });
    });
    
    describe("Price Oracle", function () {
        it("ETH fiyatını doğru çekmeli", async function () {
            const ethPrice = await umutNFT.getLatestETHPrice();
            expect(ethPrice).to.equal(ETH_PRICE_USD);
        });
        
        it("Mint fiyatını ETH cinsinden doğru hesaplamalı", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            // 10 USD / 3000 USD * 1e18 = 3333333333333333 wei (~0.00333 ETH)
            expect(mintPriceETH).to.equal(EXPECTED_MINT_PRICE_ETH);
        });
        
        it("ETH fiyatı değiştiğinde mint fiyatı da değişmeli", async function () {
            // ETH fiyatını $2000'e düşür
            await mockPriceFeed.updateAnswer(2000n * 10n**8n);
            
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            const expectedPrice = (MINT_PRICE_USD * 10n**18n) / (2000n * 10n**8n);
            
            expect(mintPriceETH).to.equal(expectedPrice);
        });
        
        it("Stale price data için revert etmeli", async function () {
            // 2 saat ileri git (3600 saniye stale threshold)
            await ethers.provider.send("evm_increaseTime", [7200]);
            await ethers.provider.send("evm_mine");
            
            await expect(umutNFT.getMintPriceInETH()).to.be.revertedWith("Stale price data");
        });
    });
    
    describe("Minting", function () {
        it("Doğru fiyatla NFT mint edilebilmeli", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await umutNFT.connect(minter1).mint({ value: mintPriceETH });
            
            expect(await umutNFT.totalMinted()).to.equal(1);
            expect(await umutNFT.ownerOf(1)).to.equal(minter1.address);
        });
        
        it("Yetersiz ödemeyle mint reddedilmeli", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            const lowPrice = mintPriceETH / 2n;
            
            await expect(
                umutNFT.connect(minter1).mint({ value: lowPrice })
            ).to.be.revertedWith("Yetersiz bagis miktari");
        });
        
        it("Fazla ödeme kabul edilmeli", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            const highPrice = mintPriceETH * 2n;
            
            await umutNFT.connect(minter1).mint({ value: highPrice });
            expect(await umutNFT.totalMinted()).to.equal(1);
        });
        
        it("NFTMinted eventi yayınlanmalı", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await expect(umutNFT.connect(minter1).mint({ value: mintPriceETH }))
                .to.emit(umutNFT, "NFTMinted")
                .withArgs(minter1.address, 1, mintPriceETH, MINT_PRICE_USD);
        });
        
        it("Birden fazla NFT mint edilebilmeli", async function () {
            const quantity = 5n;
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            const totalCost = mintPriceETH * quantity;
            
            await umutNFT.connect(minter1).mintMultiple(quantity, { value: totalCost });
            
            expect(await umutNFT.totalMinted()).to.equal(quantity);
            
            for (let i = 1n; i <= quantity; i++) {
                expect(await umutNFT.ownerOf(i)).to.equal(minter1.address);
            }
        });
        
        it("Çok sayıda NFT mint edilebilmeli (sınır yok)", async function () {
            const quantity = 50n;
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            const totalCost = mintPriceETH * quantity;
            
            await umutNFT.connect(minter1).mintMultiple(quantity, { value: totalCost });
            
            expect(await umutNFT.totalMinted()).to.equal(quantity);
        });
    });
    
    describe("Withdraw", function () {
        it("Bağışlar beneficiary adresine gönderilmeli", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await umutNFT.connect(minter1).mint({ value: mintPriceETH });
            await umutNFT.connect(minter2).mint({ value: mintPriceETH });
            
            const contractBalance = await ethers.provider.getBalance(await umutNFT.getAddress());
            const beneficiaryBalanceBefore = await ethers.provider.getBalance(beneficiary.address);
            
            await umutNFT.withdraw();
            
            const beneficiaryBalanceAfter = await ethers.provider.getBalance(beneficiary.address);
            
            expect(beneficiaryBalanceAfter - beneficiaryBalanceBefore).to.equal(contractBalance);
        });
        
        it("Herkes withdraw çağırabilmeli, para beneficiary'ye gitmeli", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await umutNFT.connect(minter1).mint({ value: mintPriceETH });
            
            const contractBalance = await ethers.provider.getBalance(await umutNFT.getAddress());
            const beneficiaryBalanceBefore = await ethers.provider.getBalance(beneficiary.address);
            
            await umutNFT.connect(minter1).withdraw();
            
            const beneficiaryBalanceAfter = await ethers.provider.getBalance(beneficiary.address);
            
            expect(beneficiaryBalanceAfter - beneficiaryBalanceBefore).to.equal(contractBalance);
        });
        
        it("Boş kontrat withdraw reddedilmeli", async function () {
            await expect(umutNFT.withdraw()).to.be.revertedWith("Cekilecek bakiye yok");
        });
        
        it("DonationWithdrawn eventi yayınlanmalı", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await umutNFT.connect(minter1).mint({ value: mintPriceETH });
            
            await expect(umutNFT.withdraw())
                .to.emit(umutNFT, "DonationWithdrawn")
                .withArgs(beneficiary.address, mintPriceETH);
        });
        
        it("totalDonationsCollected güncellenmeli", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await umutNFT.connect(minter1).mint({ value: mintPriceETH });
            await umutNFT.connect(minter2).mint({ value: mintPriceETH });
            
            await umutNFT.withdraw();
            
            const expectedTotal = mintPriceETH * 2n;
            expect(await umutNFT.totalDonationsCollected()).to.equal(expectedTotal);
        });
    });
    
    describe("Admin Functions", function () {
        it("Owner USD fiyatını değiştirebilmeli", async function () {
            const newPriceUSD = 20n * 10n**8n; // $20
            
            await umutNFT.setMintPriceUSD(newPriceUSD);
            
            expect(await umutNFT.mintPriceUSD()).to.equal(newPriceUSD);
        });
        
        it("Owner olmayan fiyat değiştirememeli", async function () {
            const newPriceUSD = 20n * 10n**8n;
            
            await expect(
                umutNFT.connect(minter1).setMintPriceUSD(newPriceUSD)
            ).to.be.revertedWithCustomError(umutNFT, "OwnableUnauthorizedAccount");
        });
        
        it("PriceUpdatedUSD eventi yayınlanmalı", async function () {
            const newPriceUSD = 20n * 10n**8n;
            
            await expect(umutNFT.setMintPriceUSD(newPriceUSD))
                .to.emit(umutNFT, "PriceUpdatedUSD")
                .withArgs(MINT_PRICE_USD, newPriceUSD);
        });
    });
    
    describe("View Functions", function () {
        it("remainingSupply doğru hesaplanmalı", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await umutNFT.connect(minter1).mint({ value: mintPriceETH });
            
            expect(await umutNFT.remainingSupply()).to.equal(MAX_SUPPLY - 1);
        });
        
        it("contractBalance doğru dönmeli", async function () {
            const mintPriceETH = await umutNFT.getMintPriceInETH();
            
            await umutNFT.connect(minter1).mint({ value: mintPriceETH });
            
            expect(await umutNFT.contractBalance()).to.equal(mintPriceETH);
        });
        
        it("getMintPriceUSD doğru dönmeli", async function () {
            expect(await umutNFT.getMintPriceUSD()).to.equal(MINT_PRICE_USD);
        });
    });
    
    describe("Immutability", function () {
        it("Beneficiary adresi değiştirilemez olmalı", async function () {
            expect(await umutNFT.beneficiary()).to.equal(beneficiary.address);
        });
        
        it("Price feed adresi değiştirilemez olmalı", async function () {
            expect(await umutNFT.priceFeed()).to.equal(await mockPriceFeed.getAddress());
        });
    });
});
