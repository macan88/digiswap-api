export const LENDING_ABI = [
  {
    constant: false,
    inputs: [
      {
        internalType: 'contract ComptrollerOlaLeNLensInterface',
        name: 'unitroller',
        type: 'address',
      },
    ],
    name: 'viewLendingNetwork',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'totalSupply',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'totalBorrows',
            type: 'uint256',
          },
        ],
        internalType: 'struct OlaLeNLens.LendingNetworkView',
        name: '',
        type: 'tuple',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        internalType: 'contract CToken',
        name: 'market',
        type: 'address',
      },
    ],
    name: 'viewMarket',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'supplyUnits',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'supplyUsd',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'borrowsUnits',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'borrowsUsd',
            type: 'uint256',
          },
        ],
        internalType: 'struct OlaLeNLens.MarketView',
        name: '',
        type: 'tuple',
      },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
];
