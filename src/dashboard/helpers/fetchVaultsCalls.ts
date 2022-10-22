//import { VaultConfig } from 'config/constants/types';

interface Call {
  address: string; // Address of the contract
  name: string; // Function name on the contract (exemple: balanceOf)
  params?: any[]; // Function params
}

const fetchVaultCalls = (vault: any, chainId: number): Call[] => {
  const stratAddress = vault.stratAddress[chainId];
  const { stakeToken, rewardToken, masterchef } = vault;
  const masterchefCalls = [
    // Masterchef total alloc points
    {
      address: masterchef.address[chainId],
      name: 'totalAllocPoint',
    },
    // Vaulted farm pool info
    {
      address: masterchef.address[chainId],
      name: 'poolInfo',
      params: [masterchef.pid[chainId]],
    },
    // Masterchef strategy info
    {
      address: masterchef.address[chainId],
      name: 'userInfo',
      params: [masterchef.pid[chainId], stratAddress],
    },
  ];
  const calls = [
    // Stake token balance in masterchef
    {
      address: stakeToken.address[chainId],
      name: 'balanceOf',
      params: [masterchef.address[chainId]],
    },
  ];
  const bananaPoolCalls = [
    // Digichain pool info
    {
      address: masterchef.address[chainId],
      name: 'poolInfo',
      params: [0],
    },
    // Total digichain staked in pool
    {
      address: rewardToken.address[chainId],
      name: 'balanceOf',
      params: [masterchef.address[chainId]],
    },
  ];
  return [...masterchefCalls, ...calls, ...bananaPoolCalls];
};

export default fetchVaultCalls;
