import { compile } from '@ton/blueprint';
import { beginCell, Cell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import { cellToContent, contentToCell, NftCollection, royaltyParamsToCell } from '../wrappers/NftCollection';
import { itemContentToCell, NftItem } from '../wrappers/NftItem';

describe('NftCollection', () => {
    let code: Cell;
    let nftItemCode: Cell;

    beforeAll(async () => {
        code = await compile('NftCollection');
        nftItemCode = await compile('NftItem');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let sender: SandboxContract<TreasuryContract>;
    let nftCollection: SandboxContract<NftCollection>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        sender = await blockchain.treasury('sender');

        const contentCell = contentToCell(
            'https://starsfinance.fra1.digitaloceanspaces.com/nft/collection.json',
            'https://starsfinance.fra1.digitaloceanspaces.com/nft/',
        );
        const royaltyParamsCell = royaltyParamsToCell(10, 100, deployer.address);

        nftCollection = blockchain.openContract(
            NftCollection.createFromConfig(
                {
                    ownerAddress: deployer.address,
                    nextItemIndex: 1,
                    content: contentCell,
                    nftItemCode: nftItemCode,
                    royaltyParams: royaltyParamsCell,
                    purchaseFee: toNano('1'),
                    feeAddress: deployer.address,
                },
                code,
            ),
        );

        const deployResult = await nftCollection.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nftCollection are ready to use
    });

    it('should purchase', async () => {
        const { purchaseFee } = await nftCollection.getFees();
        const { nextItemIndex } = await nftCollection.getCollectionData();

        const nftItem = await blockchain.openContract(
            NftItem.createFromConfig(
                {
                    index: nextItemIndex,
                    collectionAddress: nftCollection.address,
                },
                nftItemCode,
            ),
        );

        const purchaseResult = await nftCollection.sendPurchase(sender.getSender(), {
            value: purchaseFee,
            itemIndex: nextItemIndex,
            rarity: 1,
            amount: toNano('0.05'),
            ownerAddress: deployer.address,
        });
        expect(purchaseResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            success: true,
        });
        expect(purchaseResult.transactions).toHaveTransaction({
            from: nftCollection.address,
            to: nftItem.address,
            deploy: true,
            success: true,
        });
        expect(purchaseResult.transactions).toHaveTransaction({
            from: nftCollection.address,
            to: deployer.address,
            success: true,
        });

        const { index, collectionAddress, ownerAddress, content, editorAddress } = await nftItem.getNftData();
        expect(index).toEqual(nextItemIndex);
        expect(collectionAddress).toEqualAddress(nftCollection.address);
        expect(ownerAddress).toEqualAddress(deployer.address);
        expect(content).toEqualCell(itemContentToCell('uncommon.json'));
        expect(editorAddress).toEqualAddress(deployer.address);
    });

    it('should not purchase if rarity purchase limit', async () => {
        const { purchaseFee } = await nftCollection.getFees();

        for (let i = 0; i < 1001; i++) {
            let { nextItemIndex } = await nftCollection.getCollectionData();
            const nftItem = await blockchain.openContract(
                NftItem.createFromConfig(
                    {
                        index: nextItemIndex,
                        collectionAddress: nftCollection.address,
                    },
                    nftItemCode,
                ),
            );

            const purchaseResult = await nftCollection.sendPurchase(sender.getSender(), {
                value: purchaseFee,
                itemIndex: nextItemIndex,
                rarity: 1,
                amount: toNano('0.05'),
                ownerAddress: deployer.address,
            });
            expect(purchaseResult.transactions).toHaveTransaction({
                from: sender.address,
                to: nftCollection.address,
                success: true,
            });
            expect(purchaseResult.transactions).toHaveTransaction({
                from: nftCollection.address,
                to: nftItem.address,
                success: true,
            });
        }

        let { nextItemIndex } = await nftCollection.getCollectionData();
        const purchaseResult = await nftCollection.sendPurchase(sender.getSender(), {
            value: purchaseFee,
            itemIndex: nextItemIndex,
            rarity: 1,
            amount: toNano('0.05'),
            ownerAddress: deployer.address,
        });
        expect(purchaseResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            exitCode: 409,
            aborted: true,
        });
    });

    it('should not purchase if unknown rarity', async () => {
        let { nextItemIndex } = await nftCollection.getCollectionData();
        const { purchaseFee } = await nftCollection.getFees();

        const purchaseResult = await nftCollection.sendPurchase(sender.getSender(), {
            value: purchaseFee,
            itemIndex: nextItemIndex,
            rarity: 100,
            amount: toNano('0.05'),
            ownerAddress: deployer.address,
        });
        expect(purchaseResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            exitCode: 408,
            aborted: true,
        });
    });

    it('should not purchase if tons less than purchase fee', async () => {
        const { purchaseFee } = await nftCollection.getFees();
        const { nextItemIndex } = await nftCollection.getCollectionData();

        const purchaseResult = await nftCollection.sendPurchase(sender.getSender(), {
            value: purchaseFee - toNano('0.05'),
            itemIndex: nextItemIndex,
            rarity: 1,
            amount: toNano('0.05'),
            ownerAddress: deployer.address,
        });
        expect(purchaseResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            exitCode: 404,
            aborted: true,
        });
    });

    it('should not purchase for invalid item index', async () => {
        const { purchaseFee } = await nftCollection.getFees();
        const { nextItemIndex } = await nftCollection.getCollectionData();

        const purchaseResult = await nftCollection.sendPurchase(sender.getSender(), {
            value: purchaseFee,
            itemIndex: nextItemIndex + 1,
            rarity: 1,
            amount: toNano('0.05'),
            ownerAddress: deployer.address,
        });
        expect(purchaseResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            exitCode: 402,
            aborted: true,
        });
    });

    it('should get royalty params', async () => {});

    it('should mint for owner', async () => {
        const { nextItemIndex } = await nftCollection.getCollectionData();
        const itemContentCell = itemContentToCell('new');

        const mintResult = await nftCollection.sendMint(deployer.getSender(), {
            value: toNano('0.1'),
            itemIndex: nextItemIndex,
            amount: toNano('0.05'),
            nftContent: beginCell()
                .storeAddress(deployer.address)
                .storeRef(itemContentCell)
                .storeAddress(deployer.address)
                .endCell(),
        });
        expect(mintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            success: true,
        });

        const nftItem = await blockchain.openContract(
            NftItem.createFromConfig(
                {
                    index: nextItemIndex,
                    collectionAddress: nftCollection.address,
                },
                nftItemCode,
            ),
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: nftCollection.address,
            to: nftItem.address,
            deploy: true,
            success: true,
        });

        const { index, collectionAddress, ownerAddress, content, editorAddress } = await nftItem.getNftData();
        expect(index).toEqual(nextItemIndex);
        expect(collectionAddress).toEqualAddress(nftCollection.address);
        expect(ownerAddress).toEqualAddress(deployer.address);
        expect(content).toEqualCell(itemContentCell);
        expect(editorAddress).toEqualAddress(deployer.address);
    });

    it('should not mint for invalid item index', async () => {
        const { nextItemIndex } = await nftCollection.getCollectionData();
        const itemContentCell = itemContentToCell('new');

        const mintResult = await nftCollection.sendMint(deployer.getSender(), {
            value: toNano('0.1'),
            itemIndex: nextItemIndex + 1,
            amount: toNano('0.05'),
            nftContent: beginCell()
                .storeAddress(deployer.address)
                .storeRef(itemContentCell)
                .storeAddress(deployer.address)
                .endCell(),
        });
        expect(mintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            exitCode: 402,
            aborted: true,
        });
    });

    it('should not mint for others', async () => {
        const { nextItemIndex } = await nftCollection.getCollectionData();
        const itemContentCell = itemContentToCell('new');

        const mintResult = await nftCollection.sendMint(sender.getSender(), {
            value: toNano('0.1'),
            itemIndex: nextItemIndex,
            amount: toNano('0.05'),
            nftContent: beginCell()
                .storeAddress(sender.address)
                .storeRef(itemContentCell)
                .storeAddress(sender.address)
                .endCell(),
        });
        expect(mintResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            exitCode: 401,
            aborted: true,
        });
    });

    it('should change owner for owner', async () => {
        const newOwner = await blockchain.treasury('newOwner');

        const changeOwnerResult = await nftCollection.sendChangeOwner(deployer.getSender(), {
            value: toNano('0.05'),
            newOwner: newOwner.address,
        });
        expect(changeOwnerResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            success: true,
        });

        const { ownerAddress } = await nftCollection.getCollectionData();
        expect(ownerAddress).toEqualAddress(newOwner.address);
    });

    it('should not change owner for others', async () => {
        const newOwner = await blockchain.treasury('newOwner');

        const changeOwnerResult = await nftCollection.sendChangeOwner(sender.getSender(), {
            value: toNano('0.05'),
            newOwner: newOwner.address,
        });
        expect(changeOwnerResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            aborted: true,
            exitCode: 401,
        });
    });

    it('should change content for owner', async () => {
        const newCollectionMeta = 'new';
        const newNftCommonMeta = 'common-new';

        const newContentCell = contentToCell(newCollectionMeta, newNftCommonMeta);
        const newRoyaltyParamsCell = royaltyParamsToCell(5, 100, deployer.address);

        const changeContentResult = await nftCollection.sendChangeContent(deployer.getSender(), {
            value: toNano('0.05'),
            newContent: newContentCell,
            royaltyParams: newRoyaltyParamsCell,
        });
        expect(changeContentResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            success: true,
        });

        const content = await nftCollection.getContent();
        const { typeCollectionMeta, collectionMeta, typeNftCommonMeta, nftCommonMeta } = cellToContent(
            content.collectionMeta,
            content.nftCommonMeta,
        );
        console.log(typeCollectionMeta, collectionMeta, typeNftCommonMeta, nftCommonMeta);
        expect(collectionMeta).toEqual(newCollectionMeta);
        expect(nftCommonMeta).toEqual(newNftCommonMeta);
    });

    it('should not change content for others', async () => {
        const newCollectionMeta = 'new';
        const newNftCommonMeta = 'common-new';

        const newContentCell = contentToCell(newCollectionMeta, newNftCommonMeta);
        const newRoyaltyParamsCell = royaltyParamsToCell(5, 100, deployer.address);

        const changeContentResult = await nftCollection.sendChangeContent(sender.getSender(), {
            value: toNano('0.05'),
            newContent: newContentCell,
            royaltyParams: newRoyaltyParamsCell,
        });
        expect(changeContentResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            exitCode: 401,
            aborted: true,
        });
    });

    it('should change fee for owner', async () => {
        const newChangeFee = toNano('2');
        const newFeeAddress = (await blockchain.treasury('newFeeAddress')).address;

        const changeFeeResult = await nftCollection.sendChangeFee(deployer.getSender(), {
            value: toNano('0.05'),
            newChangeFee: newChangeFee,
            newFeeAddress: newFeeAddress,
        });
        expect(changeFeeResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            success: true,
        });

        const feesAfter = await nftCollection.getFees();
        expect(feesAfter.purchaseFee).toEqual(newChangeFee);
        expect(feesAfter.feeAddress).toEqualAddress(newFeeAddress);
    });

    it('should not change fee for others', async () => {
        const newChangeFee = toNano('2');
        const newFeeAddress = await blockchain.treasury('newFeeAddress');

        const changeFeeResult = await nftCollection.sendChangeFee(sender.getSender(), {
            value: toNano('0.05'),
            newChangeFee: newChangeFee,
            newFeeAddress: newFeeAddress.address,
        });
        expect(changeFeeResult.transactions).toHaveTransaction({
            from: sender.address,
            to: nftCollection.address,
            exitCode: 401,
            aborted: true,
        });
    });
});
