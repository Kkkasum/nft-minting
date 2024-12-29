import { compile, NetworkProvider } from '@ton/blueprint';
import { Address, beginCell, toNano } from '@ton/core';
import { contentToCell, NftCollection, royaltyParamsToCell } from '../wrappers/NftCollection';

export async function run(provider: NetworkProvider) {
    const ownerAddress = Address.parse('0QB_MpZaOhVMdN4Q6NsRCGYpHsOYqxiEuqIGsyUhweQnaQ4g'); // адрес владельца коллекции
    const royaltyAddress = Address.parse('kf8zMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM_BP'); // адрес кошелька, на который будут приходить комиссии с продажи на маркетплейсах
    const feeAddress = Address.parse('0QB_MpZaOhVMdN4Q6NsRCGYpHsOYqxiEuqIGsyUhweQnaQ4g'); // адрес кошелька, на который будут приходить комиссии с первоначальной продажи (1 ТОН)

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

    const { nextItemIndex } = await nftCollection.getCollectionData();

    await nftCollection.sendMint(provider.sender(), {
        value: toNano('0.05'),
        itemIndex: nextItemIndex,
        amount: toNano('0.05'),
        nftContent: beginCell()
            .storeAddress(ownerAddress)
            .storeRef(beginCell().storeBuffer(Buffer.from('rare.json')).endCell())
            .storeAddress(ownerAddress)
            .endCell(),
    });
}
