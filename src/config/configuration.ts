import { ERC20_ABI } from 'src/stats/utils/abi/erc20Abi';
import { ERC20_ABI_POLYGON } from 'src/stats/utils/abi/erc20AbiPolygon';
import { LP_ABI } from 'src/stats/utils/abi/lpAbi';
import { LP_ABI_POLYGON } from 'src/stats/utils/abi/lpAbiPolygon';
import { MASTER_DIGI_ABI } from 'src/stats/utils/abi/masterDigiAbi';
import { MASTER_DIGI_ABI_POLYGON } from 'src/stats/utils/abi/masterDigiAbiPolygon';
import { MULTICALL_ABI } from 'src/utils/lib/abi/multicallAbi';
import { MULTICALL_ABI_POLYGON } from 'src/utils/lib/abi/multicallAbiPolygon';

export default () => ({
  mongo_uri: process.env.MONGO_URL,
  environment: process.env.NODE_ENV,
  chainId: process.env.CHAIN_ID || 97,
  networksId: {
    BSC: 56,
    POLYGON: 137,
    TELOS: 40,
  },
  chainNetworksAvailables: {
    1: {
      id: 1,
      description: 'Ethereum',
      symbol: 'eth',
      chain: 'ethereum',
    },
    56: {
      id: 56,
      description: 'BNB Chain',
      symbol: 'bnb',
      chain: 'bsc',
    },
    137: {
      id: 137,
      description: 'Polygon',
      symbol: 'matic',
      chain: 'matic',
    },
    40: {
      id: 40,
      description: 'Telos',
      symbol: 'TLOS',
      chain: 'TLOS',
    },
  },
  tokenListUrl: process.env.TOKEN_LIST_URL,
  dualFarmsListUrl: process.env.DUAL_FARMS_LIST_URL,
  billListUrl: process.env.BILL_LIST_URL,
  digidexListUrl: process.env.APP_LISTS_CONFIG_URL,
  graphUrl: process.env.GRAPH_URL,
  polygonGraphUrl: process.env.POLYGON_GRAPH_URL,
  telosGraphUrl: process.env.TELOS_GRAPH_URL,
  ethGraphUrl: process.env.ETH_GRAPH_URL,
  1: {
    contracts: {
      operational: '0xAbD7853b79e488bC1BD9e238A870167B074eb714',
      eth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    },
    operationalBalanceCurrency: [
      { address: 'ETH', mainToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
      {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        mainToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      },
      {
        address: '0x92DF60c51C710a1b1C20E42D85e221f3A1bFc7f2',
        mainToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      },
      {
        address: '0x6b0cc136f7babd971b5decd21690be65718990e2',
        isLP: true,
      },
      {
        address: '0x31bd914d44c1a37da653ba6765b716a9bc0ca5f1',
        isLP: true,
      },
    ],
    operationalMainData: {
      mainCurrency: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
    subgraph: {
      blocks: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
    },
  },
  97: {
    lottery: {
      address: '0xe42Ff4758C37ccC3A54004b176384477bbBe70D6',
      adminAddress: '0xb5e1Ec9861D7c1C99cB3d79dd602cC6122F0d7dc',
      adminKey: process.env.LOTTERY_ADMIN_KEY,
    },
    contracts: {
      masterDigi: '0xAf1B22cBDbB502B2089885bcd230255f8B80243b',
      digichain: '0x4732A86106064577933552FCea993D30BEC950a5',
      goldenDigichain: '0x9407026d236deae22cc1f3c419a9e47cbfcfe9e5',
      bnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      digichainBusd: '0x7Bd46f6Da97312AC2DBD1749f82E202764C0B914',
      digichainBnb: '0xF65C1C0478eFDe3c19b49EcBE7ACc57BB6B1D713',
      burn: '0x000000000000000000000000000000000000dead',
      mulltiCall: '0x67ADCB4dF3931b0C5Da724058ADC2174a9844412',
      auction: '0x80a01f81b92d21e39ff1276c4a81d25cb4dc4cdb',
      gDigichainTreasury: '0xec4b9d1fd8a3534e31fce1636c7479bcd29213ae',
    },
    appNodes: [
      'https://data-seed-prebsc-2-s2.binance.org:8545',
      'https://data-seed-prebsc-2-s2.binance.org:8545',
      'https://data-seed-prebsc-2-s2.binance.org:8545',
    ],
    iazoExposer: '0xe977E40f29f699F75db2A137Af0B3Db2152404b6',
    digiPriceGetter: '',
  },
  56: {
    lottery: {
      address: '0x451bCf562A4d747da3455bBAFACe988d56dA6D83',
      adminAddress: '0xCaE366497aC10De7f1faeBBf496E7dBD7764C6b3',
      adminKey: process.env.LOTTERY_ADMIN_KEY,
    },
    contracts: {
      masterDigi: '0x5c8D727b265DBAfaba67E050f2f739cAeEB4A6F9',
      digichain: '0x4732A86106064577933552FCea993D30BEC950a5',
      goldenDigichain: '0xddb3bd8645775f59496c821e4f55a7ea6a6dc299',
      bnb: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      digichainBusd: '0x7Bd46f6Da97312AC2DBD1749f82E202764C0B914',
      digichainBnb: '0xF65C1C0478eFDe3c19b49EcBE7ACc57BB6B1D713',
      burn: '0x000000000000000000000000000000000000dead',
      mulltiCall: '0x38ce767d81de3940CFa5020B55af1A400ED4F657',
      gDigichainTreasury: '0xec4b9d1fd8a3534e31fce1636c7479bcd29213ae',
      auction: '0xaeCB396Be7F19618Db4C44d8e2E8C908228515E9',
      pol: [
        '0x944694417A6cA0a70963D644A11d42C10e3af042',
        '0xaf42e9a6c5302926656071084182e2fe81b79ea5',
        '0x11587da834e3d9f25ad14fc28f6dd670e22f08f9',
      ],
      operational: '0x90274f67F02f555031f3Eb99b47213CE0A06D5B1',
      busd: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      eth: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      bsplit: '0x86ef5e73edb2fea111909fe35afcc564572acc06',
      billNft: '0xb0278e43dbd744327fe0d5d0aba4a77cbfc7fad8',
      billNftV2: '0x7fd203888661d1f0ae625ed599909f8f97698670',
    },
    digiPriceGetter: '0x5e545322b83626c745FE46144a15C00C94cBD803',
    olaCompoundLens: '0x183019dc7a8f8f1456df735862761cccf2e23009',
    appNodes: [
      // 'https://rpc.ankr.com/erigonbsc',
      // 'https://bscrpc.com',
      process.env.NODEREAL_NODE,
    ],
    archiveNode: process.env.ARCHIVE_BSC,
    lendingMarkets: [
      {
        name: 'BTC',
        contract: '0x5fce5D208DC325ff602c77497dC18F8EAdac8ADA',
        asset: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
      },
      {
        name: 'ETH',
        contract: '0xaA1b1E1f251610aE10E4D553b05C662e60992EEd',
        asset: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      },
      {
        name: 'DIGICHAIN',
        contract: '0xC2E840BdD02B4a1d970C87A912D8576a7e61D314',
        asset: '0x603c7f932ED1fc6575303D8Fb018fDCBb0f39a95',
      },
      {
        name: 'BUSD',
        contract: '0x0096B6B49D13b347033438c4a699df3Afd9d2f96',
        asset: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      },
      {
        name: 'USDT',
        contract: '0xdBFd516D42743CA3f1C555311F7846095D85F6Fd',
        asset: '0x55d398326f99059fF775485246999027B3197955',
      },
      {
        name: 'USDC',
        contract: '0x91B66a9Ef4f4CAD7F8AF942855C37Dd53520f151',
        asset: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      },
      {
        name: 'CAKE',
        contract: '0x3353f5bcfD7E4b146F2eD8F1e8D875733Cd754a7',
        asset: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      },
      {
        name: 'BNB',
        contract: '0x34878F6a484005AA90E7188a546Ea9E52b538F6f',
        asset: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      },
      {
        name: 'DOT',
        contract: '0x92D106c39aC068EB113B3Ecb3273B23Cd19e6e26',
        asset: '0x7083609fce4d1d8dc0c979aab8c869ea2c873402',
      },
    ],
    iazoExposer: '0xFdfb230bFa399EC32EA8e98c2E7E3CcD953C860A',
    lending: '0xCc7aaC69015a7645dfC39ddEB5902ca9FC0Bc15C',
    unitroller: '0xAD48B2C9DC6709a560018c678e918253a65df86e',
    abi: {
      masterDigi: MASTER_DIGI_ABI,
      multiCall: MULTICALL_ABI,
      lp: LP_ABI,
      erc20: ERC20_ABI,
    },
    feeLP: 0.15,
    baseCurrency: [
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      '0x4732A86106064577933552FCea993D30BEC950a5',
      '0x55d398326f99059ff775485246999027b3197955',
    ],
    subgraph: {
      blocks: 'https://api.thegraph.com/subgraphs/name/matthewlilley/bsc-blocks',
      principal: process.env.GRAPH_URL,
    },
    operationalBalanceCurrency: [
      { address: 'BNB', mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
      {
        address: '0x4732A86106064577933552FCea993D30BEC950a5',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      {
        address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      {
        address: '0x55d398326f99059fF775485246999027B3197955',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      {
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      {
        address: '0xd9025e25Bb6cF39f8c926A704039D2DD51088063',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      {
        address: '0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40',
        mainToken: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      },
      {
        address: '0x4F3266a56589357B4f8082918b14B923693e57f0',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      {
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      {
        address: '0x87bade473ea0513d4aa7085484aeaa6cb6ebe7e3',
        mainToken: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      },
      {
        address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        mainToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
    ],
    operationalMainData: {
      mainCurrency: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    },
  },
  137: {
    contracts: {
      masterDigi: '0x54aff400858Dcac39797a81894D9920f16972D1D',
      mulltiCall: '0x95028E5B8a734bb7E2071F96De89BABe75be9C8E',
      digichain: '0x5d47baba0d66083c52009271faf3f50dcc01023c',
      burn: '0x000000000000000000000000000000000000dead',
      billNftV2: '0xa35c3fcd306cf69fed19e8c7b15c8b3904ea609d',
      operational: '0x71C0C1001520e1568e17836Cc8a19d0dbdB2BD5f',
      pol: ['0x60dc928548b92b681beba07fc2551c5e5967a8e6'],
    },
    digiPriceGetter: '0x05D6C73D7de6E02B3f57677f849843c03320681c',
    appNodes: [
      'https://polygon-rpc.com',
      //'https://rpc-mainnet.matic.network',
      // 'https://matic-mainnet.chainstacklabs.com',
      // 'https://rpc-mainnet.maticvigil.com',
      // 'https://rpc-mainnet.matic.quiknode.pro',
      // 'https://matic-mainnet-full-rpc.bwarelabs.com',
    ],
    abi: {
      masterDigi: MASTER_DIGI_ABI_POLYGON,
      multiCall: MULTICALL_ABI_POLYGON,
      lp: LP_ABI_POLYGON,
      erc20: ERC20_ABI_POLYGON,
    },
    feeLP: 0.05,
    baseCurrency: ['0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'],
    subgraph: {
      blocks: 'https://api.thegraph.com/subgraphs/name/matthewlilley/polygon-blocks',
      principal: process.env.POLYGON_GRAPH_URL,
    },
    archiveNode: process.env.ARCHIVE_POLYGON,
    operationalBalanceCurrency: [
      {
        address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        mainToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      },
      {
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        mainToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      },
      {
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        mainToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      },
      {
        address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
        mainToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      },
      {
        address: '0x9ec257c1862f1bdf0603a6c20ed6f3d6bae6deb0',
        isLP: true,
      },
    ],
    operationalMainData: {
      mainToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      mainCurrency: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    },
  },
  40: {
    contracts: {
      masterDigi: '0x05eEB6df310125d95a5BaE2cB184374094f9e11e',
      mulltiCall: '0xa1a283f10f578201a97a8f69d8c15828b778f04b',
      digichain: '0x667fd83e24ca1d935d36717d305d54fa0cac991c2',
      burn: '0x000000000000000000000000000000000000dead',
      billNftV2: '0x9084C442286E23617694101d5575bEA48C2cf621',
    },
    digiPriceGetter: '0x29392EFEd565c13a0901Aeb88e32bf58EEb8a067',
    appNodes: [
      'http://test1.us.telos.net:7000/evm',
      // 'https://data-seed-prebsc-2-s2.binance.org:8545',
      // 'https://data-seed-prebsc-2-s2.binance.org:8545',
    ],
    subgraph: {
      blocks: 'https://telos.digidexgraphs.com/subgraphs/name/ape-swap/telos-blocks',
      principal: process.env.TELOS_GRAPH_URL,
    },
    abi: {
      masterDigi: MASTER_DIGI_ABI,
      multiCall: MULTICALL_ABI,
      lp: LP_ABI,
      erc20: ERC20_ABI,
    },
    archiveNode: process.env.ARCHIVE_TELOS,
  },
});
