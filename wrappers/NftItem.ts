import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type NftItemConfig = {
    index: number;
    collectionAddress: Address;
};

export function itemContentToCell(content: string): Cell {
    return beginCell().storeStringTail(content).endCell();
}

export function nftContentToCell(rarity: number, ownerAddress: Address): Cell {
    let content: string;
    switch (rarity) {
        case 0:
            content = 'common.json';
            break;
        case 1:
            content = 'uncommon.json';
            break;
        case 2:
            content = 'rare.json';
            break;
        case 3:
            content = 'mythical.json';
            break;
        case 4:
            content = 'legendary.json';
            break;
        default:
            content = 'immortal.json';
            break;
    }

    return beginCell()
        .storeAddress(ownerAddress)
        .storeRef(beginCell().storeStringTail(content).endCell())
        .storeAddress(ownerAddress)
        .endCell();
}

export function NftItemConfigToCell(config: NftItemConfig): Cell {
    return beginCell().storeUint(config.index, 64).storeAddress(config.collectionAddress).endCell();
}

export class NftItem implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new NftItem(address);
    }

    static createFromConfig(config: NftItemConfig, code: Cell, workchain = 0) {
        const data = NftItemConfigToCell(config);
        const init = { code, data };
        return new NftItem(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getNftData(provider: ContractProvider): Promise<{
        init: boolean;
        index: number;
        collectionAddress: Address;
        ownerAddress: Address;
        content: Cell;
        editorAddress: Address;
    }> {
        const res = await provider.get('get_nft_data', []);
        const init = res.stack.readBoolean();
        const index = res.stack.readNumber();
        const collectionAddress = res.stack.readAddress();
        const ownerAddress = res.stack.readAddress();
        const content = res.stack.readCell();
        const editorAddress = res.stack.readAddress();

        return {
            init,
            index,
            collectionAddress,
            ownerAddress,
            content,
            editorAddress,
        };
    }
}
