import { compile, NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { contentToCell, NftCollection, royaltyParamsToCell } from '../wrappers/NftCollection';
import { NftItem } from '../wrappers/NftItem';

export async function run(provider: NetworkProvider) {
    const ownerAddress = Address.parse('0QB_MpZaOhVMdN4Q6NsRCGYpHsOYqxiEuqIGsyUhweQnaQ4g');
    const royaltyAddress = Address.parse('kf8zMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM_BP');
    const feeAddress = Address.parse('0QB_MpZaOhVMdN4Q6NsRCGYpHsOYqxiEuqIGsyUhweQnaQ4g');

    const contentCell = contentToCell(
        'https://starsfinance.fra1.digitaloceanspaces.com/nft/collection.json',
        'https://starsfinance.fra1.digitaloceanspaces.com/nft/items/',
    );
    const royaltyParamsCell = royaltyParamsToCell(10, 100, royaltyAddress);

    const nftCollection = provider.open(
        NftCollection.createFromConfig(
            {
                ownerAddress: ownerAddress,
                nextItemIndex: 0,
                content: contentCell,
                nftItemCode: await compile('NftItem'),
                royaltyParams: royaltyParamsCell,
                purchaseFee: toNano('1'),
                feeAddress: feeAddress,
            },
            await compile('NftCollection'),
        ),
    );

    const { purchaseFee } = await nftCollection.getFees();
    const { nextItemIndex } = await nftCollection.getCollectionData();

    await nftCollection.sendPurchase(provider.sender(), {
        value: purchaseFee,
        itemIndex: nextItemIndex,
        rarity: 0,
        amount: toNano('0.05'),
        ownerAddress: ownerAddress,
    });

    const nftItem = provider.open(
        NftItem.createFromConfig(
            {
                index: nextItemIndex,
                collectionAddress: nftCollection.address,
            },
            await compile('NftItem'),
        ),
    );

    await provider.waitForDeploy(nftItem.address, 20);
}
