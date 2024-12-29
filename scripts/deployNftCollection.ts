import { compile, NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { contentToCell, NftCollection, royaltyParamsToCell } from '../wrappers/NftCollection';

export async function run(provider: NetworkProvider) {
    const ownerAddress = Address.parse(''); // адрес владельца коллекции
    const royaltyAddress = Address.parse(''); // адрес кошелька, на который будут приходить комиссии с продажи на маркетплейсах
    const feeAddress = Address.parse(''); // адрес кошелька, на который будут приходить комиссии с первоначальной продажи (1 ТОН)

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

    await nftCollection.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(nftCollection.address);

    // run methods on `nftMinter`
}
