## NFT

На TON используется контракт nft-collection для создания коллекции NFT-предметов.
С помощью этого контракта создаются (минтятся) отдельные NFT-предметы (nft-item).

### Деплой контрактов

Перед запуском скрипты не забудьте изменить параметы в файле scripts/deployNftCollection.ts.
Чтобы создать коллекцию нфт, нужно задеплоить контракт nft-collection. Для этого в терминале вводите команду

```bash
npx blueprint run
```

и выбираете deployNftCollection. Далее, выбираете сеть (testnet - это сеть, предназначенная для тестирования контрактов),
выбираете способ подключения кошелька (выбирайте TonConnect), подключаете через приложения кошелька по QR-коду и в вашем кошельке появится транзакция для подтверждения транзакции.
В терминале выведется адрес контракта.

### Взаимодействие с контрактом

Для покупки нфт отправляете транзакцию на задеплоенный контракт нфт-коллекции с body:

```
beginCell()
    .storeUint(0x6117d13b, 32)
    .storeUint(0, 64)
    .storeUint(itemIndex, 64)
    .storeCoins(rarity)
    .storeAddress(ownerAddress)
    .storeCoins(toNano('0.05'))
.endCell()
```

1. itemIndex - это порядковый индекс следующей нфт. Его можно получить с помощью POST-запрос на эндпоинт
   https://toncenter.com/api/v3/runGetMethod (https://testnet.toncenter.com/api/v3/index.html#/api%2Fv2/api_v3_post_v2_rungetmethod)
   с телом запроса

```
{
  "address": "", // адрес контракт нфт-коллекции
  "method": "get_collection_data",
  "stack": []
}
```

Пример ответа:

```
{
  "gas_used": 1875,
  "exit_code": 0,
  "stack": [
    {
      "type": "num",
      "value": "0x2"
    },
    {
      "type": "cell",
      "value": "te6cckEBAQEARwAAigFodHRwczovL3N0YXJzZmluYW5jZS5mcmExLmRpZ2l0YWxvY2VhbnNwYWNlcy5jb20vbmZ0L2NvbGxlY3Rpb24uanNvbjs7C/Y="
    },
    {
      "type": "cell",
      "value": "te6cckEBAQEAJAAAQ4AP5lLLR0KpjpvCHRtiIQzFI9hzFWMQl1RA1mSkODyE7TBfHEYT"
    }
  ]
}
```

Первый элемент поля stack (0x2) является itemIndex. С покупкой/минтом новой нфт это значение увеличивается на 1.

2. rarity - это число от 0 до 5, где число соответствует редкости: 0 - common, 1 - uncommon, 2 - rare, 3 - mythical, 4 - legendary, 5 - immortal.
3. ownerAddress - это адрес пользователя, который покупает нфт.
