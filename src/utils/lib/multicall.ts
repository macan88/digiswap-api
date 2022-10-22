import { AbiItem } from 'web3-utils';
import { Interface } from '@ethersproject/abi';
import { getWeb3 } from './web3';
import { MULTICALL_ABI } from './abi/multicallAbi';
import configuration from 'src/config/configuration';

interface Call {
  address: string; // Address of the contract
  name: string; // Function name on the contract (exemple: balanceOf)
  params?: any[]; // Function params
}

export const multicall = async (abi: any[], calls: Call[], blockNumber?: number, chainId: number = 56) => {
  const web3 = getWeb3(chainId);
  const multi = new web3.eth.Contract(MULTICALL_ABI as unknown as AbiItem, getMulticallAddress(chainId));
  const itf = new Interface(abi);

  const calldata = calls.map((call) => [call.address.toLowerCase(), itf.encodeFunctionData(call.name, call.params)]);
  const { returnData } = await multi.methods.aggregate(calldata).call(undefined, blockNumber);
  const res = returnData.map((call, i) => itf.decodeFunctionResult(calls[i].name, call));
  return res;
};

export const multicallNetwork = async (abi: any[], calls: Call[], chainId = 56) => {
  const web3 = getWeb3(chainId);
  const multi = new web3.eth.Contract(
    getMulticallAbiNetwork(chainId) as unknown as AbiItem,
    getMulticallAddressNetwork(chainId),
  );
  const itf = new Interface(abi);

  const calldata = calls.map((call) => {
    if (call.address[chainId]) {
      return [call.address[chainId].toLowerCase(), itf.encodeFunctionData(call.name, call.params)];
    } else {
      return [call.address.toLowerCase(), itf.encodeFunctionData(call.name, call.params)];
    }
  });
  const { returnData } = await multi.methods.aggregate(calldata).call();
  const res = returnData.map((call, i) => itf.decodeFunctionResult(calls[i].name, call));
  return res;
};

const getMulticallAddress = (chainId = 56) => {
  return configuration()[chainId].contracts.mulltiCall;
};

const getMulticallAddressNetwork = (chainId: number) => {
  return configuration()[chainId].contracts.mulltiCall;
};

const getMulticallAbiNetwork = (chainId: number) => {
  return configuration()[chainId].abi.multiCall;
};
