import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano,
} from '@ton/core';

export type NftCollectionConfig = {
    ownerAddress: Address;
    nextItemIndex: number;
    content: Cell;
    nftItemCode: Cell;
    royaltyParams: Cell;
    purchaseFee: bigint;
    feeAddress: Address;
    common?: bigint;
    uncommon?: bigint;
    rare?: bigint;
    mythical?: bigint;
    legendary?: bigint;
    immortal?: bigint;
};

function bufferToChunks(buff: Buffer, chunkSize: number): Buffer[] {
    const chunks: Buffer[] = [];
    while (buff.byteLength > 0) {
        chunks.push(buff.subarray(0, chunkSize));
        buff = buff.subarray(chunkSize);
    }

    return chunks;
}

function makeSnakeCell(data: Buffer): Cell {
    const chunks = bufferToChunks(data, 127);

    if (chunks.length === 0) {
        return beginCell().endCell();
    }

    if (chunks.length === 1) {
        // @ts-ignore
        return beginCell().storeBuffer(chunks[0]).endCell();
    }

    let curCell = beginCell();

    for (let i = chunks.length - 1; i >= 0; i--) {
        const chunk = chunks[i];
        // @ts-ignore
        curCell.storeBuffer(chunk);

        if (i - 1 >= 0) {
            const nextCell = beginCell();
            nextCell.storeRef(curCell);
            curCell = nextCell;
        }
    }

    return curCell.endCell();
}

export function encodeOffChainContent(content: string): Cell {
    let data = Buffer.from(content);
    const offChainPrefix = Buffer.from([0x01]);
    data = Buffer.concat([offChainPrefix, data]);

    return makeSnakeCell(data);
}

export function contentToCell(collectionMeta: string, nftCommonMeta: string): Cell {
    const collectionMetaCell = encodeOffChainContent(collectionMeta);
    const nftCommonMetaCell = beginCell().storeBuffer(Buffer.from(nftCommonMeta)).endCell();

    return beginCell().storeRef(collectionMetaCell).storeRef(nftCommonMetaCell).endCell();
}

export function cellToContent(
    collectionMetaCell: Cell,
    nftCommonMetaCell: Cell,
): { typeCollectionMeta: number; collectionMeta: string; typeNftCommonMeta: number; nftCommonMeta: string } {
    const collectionMetaSlice = collectionMetaCell.beginParse();
    const nftCommonMetaSlice = nftCommonMetaCell.beginParse();

    // collectionMetaSlice.skip(8);
    // nftCommonMetaSlice.skip(8);

    const typeCollectionMeta = collectionMetaSlice.loadUint(8);
    const collectionMeta = collectionMetaSlice.loadStringTail();
    const typeNftCommonMeta = nftCommonMetaSlice.loadUint(8);
    const nftCommonMeta = nftCommonMetaSlice.loadStringTail();

    return {
        typeCollectionMeta,
        collectionMeta,
        typeNftCommonMeta,
        nftCommonMeta,
    };
}

export function royaltyParamsToCell(numerator: number, denominator: number, royaltyAddress: Address): Cell {
    return beginCell().storeUint(numerator, 16).storeUint(denominator, 16).storeAddress(royaltyAddress).endCell();
}

export function NftCollectionConfigToCell(config: NftCollectionConfig): Cell {
    return beginCell()
        .storeAddress(config.ownerAddress)
        .storeUint(config.nextItemIndex, 64)
        .storeRef(config.content)
        .storeRef(config.nftItemCode)
        .storeRef(config.royaltyParams)
        .storeCoins(config.purchaseFee)
        .storeAddress(config.feeAddress)
        .storeCoins(config.common || 0)
        .storeCoins(config.uncommon || 0)
        .storeCoins(config.rare || 0)
        .storeCoins(config.mythical || 0)
        .storeCoins(config.legendary || 0)
        .storeCoins(config.immortal || 0)
        .endCell();
}

export class NftCollection implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new NftCollection(address);
    }

    static createFromConfig(config: NftCollectionConfig, code: Cell, workchain = 0) {
        const data = NftCollectionConfigToCell(config);
        const init = { code, data };
        return new NftCollection(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendPurchase(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; itemIndex: number; rarity: number; ownerAddress: Address; amount: bigint },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x6117d13b, 32)
                .storeUint(0, 64)
                .storeUint(opts.itemIndex, 64)
                .storeCoins(opts.rarity)
                .storeAddress(opts.ownerAddress)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async sendGetRoyaltyParams(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x3d22e46, 32).storeUint(0, 64).endCell(),
        });
    }

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; itemIndex: number; amount: bigint; nftContent: Cell },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x318f361, 32)
                .storeUint(0, 64)
                .storeUint(opts.itemIndex, 64)
                .storeCoins(opts.amount)
                .storeRef(opts.nftContent)
                .endCell(),
        });
    }

    async sendBatchMint(provider: ContractProvider, via: Sender, opts: {}) {}

    async sendChangeOwner(provider: ContractProvider, via: Sender, opts: { value: bigint; newOwner: Address }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x93b05b31, 32).storeUint(0, 64).storeAddress(opts.newOwner).endCell(),
        });
    }

    async sendChangeContent(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; newContent: Cell; royaltyParams: Cell },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0xec29200, 32)
                .storeUint(0, 64)
                .storeRef(opts.newContent)
                .storeRef(opts.royaltyParams)
                .endCell(),
        });
    }

    async sendChangeFee(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; newChangeFee: bigint; newFeeAddress: Address },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x476c06a8, 32)
                .storeUint(0, 64)
                .storeCoins(opts.newChangeFee)
                .storeAddress(opts.newFeeAddress)
                .endCell(),
        });
    }

    async getCollectionData(provider: ContractProvider): Promise<{
        nextItemIndex: number;
        collectionContent: Cell;
        ownerAddress: Address;
    }> {
        const res = await provider.get('get_collection_data', []);
        const nextItemIndex = res.stack.readNumber();
        const collectionContent = res.stack.readCell();
        const ownerAddress = res.stack.readAddress();

        return {
            nextItemIndex,
            collectionContent,
            ownerAddress,
        };
    }

    async getContent(provider: ContractProvider): Promise<{
        collectionMeta: Cell;
        nftCommonMeta: Cell;
    }> {
        const res = await provider.get('get_content', []);
        const collectionMeta = res.stack.readCell();
        const nftCommonMeta = res.stack.readCell();

        return {
            collectionMeta,
            nftCommonMeta,
        };
    }

    async getNftAddressByIndex(provider: ContractProvider, index: number): Promise<Address> {
        const res = await provider.get('get_nft_address_by_index', [{ type: 'int', value: toNano(index) }]);

        return res.stack.readAddress();
    }

    async getRoyaltyParams(
        provider: ContractProvider,
    ): Promise<{ numerator: number; denominator: number; royaltyAddress: Address }> {
        const res = await provider.get('royalty_params', []);
        const numerator = res.stack.readNumber();
        const denominator = res.stack.readNumber();
        const royaltyAddress = res.stack.readAddress();

        return {
            numerator,
            denominator,
            royaltyAddress,
        };
    }

    async getNftContent(provider: ContractProvider, index: number, individualContent: Cell): Promise<Cell> {
        const res = await provider.get('get_nft_content', [
            { type: 'int', value: BigInt(index) },
            { type: 'cell', cell: individualContent },
        ]);

        return res.stack.readCell();
    }

    async getFees(provider: ContractProvider): Promise<{ purchaseFee: bigint; feeAddress: Address }> {
        const res = await provider.get('get_fees', []);
        const purchaseFee = res.stack.readBigNumber();
        const feeAddress = res.stack.readAddress();

        return { purchaseFee, feeAddress };
    }

    async getRarityCount(provider: ContractProvider): Promise<bigint | null> {
        const res = await provider.get('get_rarity_count', [{ type: 'int', value: 1n }]);
        return res.stack.readBigNumberOpt();
    }
}
