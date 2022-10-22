import { DIGI_PRICE_GETTER } from 'src/stats/utils/abi/digiPriceGetter';
import { ERC20_ABI } from 'src/stats/utils/abi/erc20Abi';
import { LP_ABI } from 'src/stats/utils/abi/lpAbi';
import { multicall } from 'src/utils/lib/multicall';
import { getBalanceNumber } from 'src/utils/math';

export async function getLpInfo(
  tokenAddress,
  payoutTokenAddress,
  digiPriceGetterAddress,
  blockNumber,
  chainId: number = 137,
) {
  try {
    const [reserves, decimals, token0, token1, supply, balanceOf] = await multicall(
      LP_ABI,
      [
        {
          address: tokenAddress,
          name: 'getReserves',
        },
        {
          address: tokenAddress,
          name: 'decimals',
        },
        {
          address: tokenAddress,
          name: 'token0',
        },
        {
          address: tokenAddress,
          name: 'token1',
        },
        {
          address: tokenAddress,
          name: 'totalSupply',
        },
      ],
      blockNumber,
      chainId,
    );

    const [
      token0Name,
      token0Symbol,
      token0Decimals,
      token1Name,
      token1Symbol,
      token1Decimals,
      payoutTokenName,
      payoutTokenSymbol,
      payoutTokenDecimals,
    ] = await multicall(
      ERC20_ABI,
      [
        {
          address: token0[0],
          name: 'name',
        },
        {
          address: token0[0],
          name: 'symbol',
        },
        {
          address: token0[0],
          name: 'decimals',
        },
        {
          address: token1[0],
          name: 'name',
        },
        {
          address: token1[0],
          name: 'symbol',
        },
        {
          address: token1[0],
          name: 'decimals',
        },
        {
          address: payoutTokenAddress,
          name: 'name',
        },
        {
          address: payoutTokenAddress,
          name: 'symbol',
        },
        {
          address: payoutTokenAddress,
          name: 'decimals',
        },
      ],
      blockNumber,
      chainId,
    );

    const lpPrice = await multicall(
      DIGI_PRICE_GETTER,
      [
        {
          address: digiPriceGetterAddress,
          name: 'getLPPrice',
          params: [tokenAddress, decimals[0]],
        },
      ],
      blockNumber,
      chainId,
    );

    const lpPriceFormatted = getBalanceNumber(lpPrice, decimals[0]);
    const totalSupply = supply / 10 ** decimals[0];
    const staked = balanceOf / 10 ** decimals[0];

    const q0 = reserves._reserve0;
    const q1 = reserves._reserve1;
    return {
      address: tokenAddress,
      token0: {
        address: token0[0],
        symbol: token0Symbol[0],
        name: token0Name[0],
        decimals: token0Decimals[0],
      },
      q0,
      token1: {
        address: token1[0],
        symbol: token1Symbol[0],
        name: token1Name[0],
        decimals: token1Decimals[0],
      },
      q1,
      totalSupply,
      staked,
      decimals: decimals[0],
      payoutToken: {
        address: payoutTokenAddress,
        name: payoutTokenName[0],
        symbol: payoutTokenSymbol[0],
        decimals: payoutTokenDecimals[0],
      },
      tokens: [token0[0], token1[0]],
      lpPrice: lpPriceFormatted,
    };
  } catch (error) {
    console.log('inusual a', tokenAddress);
    console.log(error);
  }
}
