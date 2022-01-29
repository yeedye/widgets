import { ThirdwebSDK } from "@3rdweb/sdk";
import { Text, Button, Flex, Icon, Tooltip, useClipboard, useToast } from "@chakra-ui/react";
import { IoWalletOutline } from "react-icons/io5";
import { useAccount, useBalance } from "wagmi";
import { RiMoneyDollarCircleLine } from "react-icons/ri";
import { useTokenModule } from "./tokenHooks";
import { useEffect } from "react";
import { useQuery } from "react-query";

interface IConnectedWallet {
  sdk? : ThirdwebSDK;
  tokenAddress?: string;
}

export const ConnectedWallet: React.FC<IConnectedWallet> = ({ sdk, tokenAddress }) => {
  const toast = useToast();
  const [{ data }, disconnect] = useAccount();
  const { onCopy } = useClipboard(data?.address || "");
  const tokenModule = useTokenModule(sdk, tokenAddress);

  const { data: balance } = useQuery(
    ["balance", data?.address, tokenAddress], 
    async () => {
      if (!tokenAddress || !data?.address) return;

      return await tokenModule?.balanceOf(data.address);
    }, 
    {
      enabled: !!data?.address && !!tokenModule,
    }
  )

  const copyAddress = () => {
    onCopy();
    toast({
      title: "Address copied to clipboard",
      status: "success",
      duration: 5000,
      isClosable: true,
    })
  }

  if (!data?.address) {
    return null;
  }

  return (
    <>
      <Tooltip label="Copy address" hasArrow>
        <Button 
          variant="outline"
          size="sm"
          color="gray.800"
          leftIcon={<Icon as={IoWalletOutline} color="gray.500" boxSize={4} />}
          onClick={copyAddress}
        >
          {data?.address?.slice(0, 6)}...{data?.address?.slice(-4)}
        </Button>
      </Tooltip>
      <Flex
        height="32px"
        px="10px"
        borderRadius="md"
        borderColor="gray.200"
        borderWidth="1px"
        align="center"
        gap={1}
      >
        <Icon as={RiMoneyDollarCircleLine} boxSize={4} color="gray.500" />
        <Text fontSize="sm" fontWeight="semibold">
          {balance?.displayValue} {balance?.symbol}
        </Text>
      </Flex>
      <Button colorScheme="red" size="sm" onClick={disconnect}>
        Disconnect
      </Button>
    </>
  )
}