import { ColorModeScript } from '@chakra-ui/react'
import { BundleDropModule, ThirdwebSDK } from "@3rdweb/sdk";
import {
  Button,
  ButtonProps,
  Center,
  ChakraProvider,
  Flex,
  Grid,
  Heading,
  Icon,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Spinner,
  Stack,
  Tab,
  Text,
  useToast,
} from "@chakra-ui/react";
import { css, Global } from "@emotion/react";
import { BigNumber, BigNumberish } from "ethers";
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { IoDiamondOutline } from "react-icons/io5";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "react-query";
import { Provider, useNetwork } from "wagmi";
import { ConnectWalletButton } from "../shared/connect-wallet-button";
import { ConnectedWallet } from "../shared/connected-wallet";
import { Footer } from "../shared/footer";
import { NftCarousel, NFTImageOrVideo } from "../shared/nft-carousel";
import { parseError } from "../shared/parseError";
import { DropSvg } from "../shared/svg/drop";
import chakraTheme from "../shared/theme";
import { fontsizeCss } from "../shared/theme/typography";
import { useFormatedValue } from "../shared/tokenHooks";
import { useAddress } from "../shared/useAddress";
import { useConnectors } from "../shared/useConnectors";
import { useSDKWithSigner } from "../shared/useSdkWithSigner";
import { isExtensionVideoFile } from "../utils/isExtensionVideoFile";

function parseHugeNumber(totalAvailable: BigNumberish = 0) {
  const bn = BigNumber.from(totalAvailable);
  if (bn.gte(Number.MAX_SAFE_INTEGER - 1)) {
    return "Unlimited";
  }
  const number = bn.toNumber();
  return new Intl.NumberFormat(undefined, {
    notation: bn.gte(1_00_000) ? "compact" : undefined,
  }).format(number);
}

interface DropWidgetProps {
  startingTab?: "claim" | "inventory";
  colorScheme?: "light" | "dark";
  rpcUrl?: string;
  contractAddress: string;
  expectedChainId: number;
  tokenId: string;
}

type Tab = "claim" | "inventory";

interface ModuleInProps {
  module?: BundleDropModule;
  expectedChainId: number;
}

interface HeaderProps extends ModuleInProps {
  sdk?: ThirdwebSDK;
  tokenAddress?: string;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  tokenId: string;
  expectedChainId: number;
}

const Header: React.FC<HeaderProps> = ({
  sdk,
  tokenAddress,
  activeTab,
  setActiveTab,
  module,
  expectedChainId,
  tokenId,
}) => {
  const address = useAddress();
  const [{ data: network }] = useNetwork();
  const chainId = useMemo(() => network?.chain?.id, [network]);

  const isEnabled = !!module && !!address && chainId === expectedChainId;

  const activeButtonProps: ButtonProps = {
    borderBottom: "4px solid",
    borderBottomColor: "blue.500",
  };

  const inactiveButtonProps: ButtonProps = {
    color: "gray.500",
  };

  const activeClaimCondition = useQuery(
    ["claim-condition", { tokenId }],
    async () => {
      return module?.getActiveClaimCondition(tokenId);
    },
    { enabled: isEnabled && tokenId.length > 0 },
  );

  const available = parseHugeNumber(activeClaimCondition.data?.availableSupply);

  return (
    <Stack
      as="header"
      px="28px"
      direction="row"
      spacing="20px"
      w="100%"
      flexGrow={0}
      borderBottom="1px solid rgba(0,0,0,.1)"
      justify="space-between"
    >
      <Stack direction="row" spacing={5}>
        <Button
          h="48px"
          fontSize="subtitle.md"
          fontWeight="700"
          borderY="4px solid transparent"
          {...(activeTab === "claim" ? activeButtonProps : inactiveButtonProps)}
          variant="unstyled"
          borderRadius={0}
          onClick={() => setActiveTab("claim")}
        >
          Mint{available ? ` (${available})` : ""}
        </Button>
        <Button
          h="48px"
          fontSize="subtitle.md"
          fontWeight="700"
          borderY="4px solid transparent"
          {...(activeTab === "inventory"
            ? activeButtonProps
            : inactiveButtonProps)}
          variant="unstyled"
          borderRadius={0}
          onClick={() => setActiveTab("inventory")}
        >
          Inventory
        </Button>
      </Stack>
      <ConnectedWallet sdk={sdk} tokenAddress={tokenAddress} />
    </Stack>
  );
};

interface ClaimPageProps {
  module?: BundleDropModule;
  sdk?: ThirdwebSDK;
  expectedChainId: number;
  tokenId: string;
}

const ClaimButton: React.FC<ClaimPageProps> = ({
  module,
  sdk,
  expectedChainId,
  tokenId,
}) => {
  const address = useAddress();
  const [{ data: network }] = useNetwork();
  const chainId = useMemo(() => network?.chain?.id, [network]);
  const [claimSuccess, setClaimSuccess] = useState(false);

  const isEnabled = !!module && !!address && chainId === expectedChainId;

  const tokenMetadata = useQuery(
    ["token-metadata", { tokenId }],
    async () => {
      return module?.get(tokenId);
    },
    { enabled: !!module && tokenId.length > 0 },
  );

  const activeClaimCondition = useQuery(
    ["claim-condition", { tokenId }],
    async () => {
      return module?.getActiveClaimCondition(tokenId);
    },
    { enabled: isEnabled && tokenId.length > 0 },
  );

  const [quantity, setQuantity] = useState(1);
  const priceToMint = BigNumber.from(
    activeClaimCondition?.data?.pricePerToken || 0,
  ).mul(quantity);
  const currency = activeClaimCondition?.data?.currency;
  const claimed = tokenMetadata.data?.supply || BigNumber.from(0);
  const totalAvailable = activeClaimCondition.data?.maxMintSupply || "0";

  const tokenModule = useMemo(() => {
    if (!currency || !sdk) {
      return undefined;
    }
    return sdk.getTokenModule(currency);
  }, [currency, sdk]);

  const formatedPrice = useFormatedValue(
    priceToMint,
    tokenModule,
    expectedChainId,
  );

  // const isNotSoldOut = claimed.lt(BigNumber.from(totalAvailable));
  const available = BigNumber.from(activeClaimCondition.data?.availableSupply || 0);
  const isNotSoldOut = available.gt(BigNumber.from(0));

  useEffect(() => {
    let t = setTimeout(() => setClaimSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [claimSuccess]);

  const toast = useToast();

  const claimMutation = useMutation(
    () => {
      if (!address || !module) {
        throw new Error("No address or module");
      }
      return module.claim(tokenId, quantity);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries();
        toast({
          title: "Successfuly claimed.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      },
      onError: (err) => {
        toast({
          title: "Minting failed",
          description: parseError(err),
          status: "error",
          duration: 9000,
          isClosable: true,
        });
      },
    },
  );

  const isLoading = activeClaimCondition.isLoading;

  const canClaim = isNotSoldOut && address;

  const quantityLimit =
    activeClaimCondition?.data?.quantityLimitPerTransaction || 1;

  const quantityLimitBigNumber = useMemo(() => {
    const bn = BigNumber.from(quantityLimit);
    const unclaimedBn = BigNumber.from(
      activeClaimCondition.data?.availableSupply || 0,
    );

    if (unclaimedBn.lt(bn)) {
      return unclaimedBn;
    }
    return bn;
  }, [quantityLimit]);

  const showQuantityInput =
    canClaim &&
    quantityLimitBigNumber.gt(1) &&
    quantityLimitBigNumber.lte(1000);

  if (!isEnabled) {
    return <ConnectWalletButton expectedChainId={expectedChainId} />;
  }

  return (
    <Stack spacing={4} align="center" w="100%">
      <Flex w="100%" direction={{ base: "column", md: "row" }} gap={2}>
        {showQuantityInput && (
          <NumberInput
            inputMode="numeric"
            value={quantity}
            onChange={(stringValue, value) => {
              if (stringValue === "") {
                setQuantity(0);
              } else {
                setQuantity(value);
              }
            }}
            min={1}
            max={quantityLimitBigNumber.toNumber()}
            maxW={{ base: "100%", md: "100px" }}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        )}
        <Button
          isLoading={isLoading || claimMutation.isLoading}
          isDisabled={!canClaim}
          leftIcon={<IoDiamondOutline />}
          onClick={() => claimMutation.mutate()}
          isFullWidth
          colorScheme="blue"
          fontSize={{ base: "label.md", md: "label.lg" }}
        >
          {!isNotSoldOut
            ? "Sold out"
            : canClaim
            ? `Mint${
                priceToMint.eq(0)
                  ? " (Free)"
                  : formatedPrice
                  ? ` (${formatedPrice})`
                  : ""
              }`
            : "Minting Unavailable"}
        </Button>
      </Flex>
      <Text size="label.md" color="green.800">
        {`${parseHugeNumber(claimed)} / ${parseHugeNumber(
          claimed.add(available)
        )} claimed`}
      </Text>
    </Stack>
  );
};

const ClaimPage: React.FC<ClaimPageProps> = ({
  module,
  sdk,
  expectedChainId,
  tokenId,
}) => {
  const tokenMetadata = useQuery(
    ["token-metadata", { tokenId }],
    async () => {
      return module?.get(tokenId);
    },
    { enabled: !!module && tokenId.length > 0 },
  );

  if (tokenMetadata.isLoading) {
    return (
      <Center w="100%" h="100%">
        <Stack direction="row" align="center">
          <Spinner />
          <Heading size="label.sm">Loading...</Heading>
        </Stack>
      </Center>
    );
  }

  const metaData = tokenMetadata.data?.metadata;

  return (
    <Center w="100%" h="100%">
      <Flex direction="column" align="center" gap={4} w="100%">
        <Grid
          bg="#F2F0FF"
          border="1px solid rgba(0,0,0,.1)"
          borderRadius="20px"
          w="178px"
          h="178px"
          placeContent="center"
          overflow="hidden"
        >
          {metaData?.image ||
          (metaData?.animation_url &&
            isExtensionVideoFile(metaData.animation_url)) ? (
            <NFTImageOrVideo
              image={metaData?.image}
              animation_url={metaData?.animation_url}
              title={metaData?.name}
            />
          ) : (
            <Icon maxW="100%" maxH="100%" as={DropSvg} />
          )}
        </Grid>
        <Heading size="display.md" fontWeight="title" as="h1">
          {metaData?.name}
        </Heading>
        {metaData?.description && (
          <Heading noOfLines={2} as="h2" size="subtitle.md">
            {metaData.description}
          </Heading>
        )}
        <ClaimButton
          module={module}
          tokenId={tokenId}
          expectedChainId={expectedChainId}
          sdk={sdk}
        />
      </Flex>
    </Center>
  );
};

const InventoryPage: React.FC<ModuleInProps> = ({
  module,
  expectedChainId,
}) => {
  const address = useAddress();
  const ownedDrops = useQuery(
    "inventory",
    () => module?.getOwned(address || ""),
    { enabled: !!module && !!address },
  );

  if (ownedDrops.isLoading) {
    return (
      <Center w="100%" h="100%">
        <Stack direction="row" align="center">
          <Spinner />
          <Heading size="label.sm">Loading...</Heading>
        </Stack>
      </Center>
    );
  }

  const ownedDropsMetadata = ownedDrops.data?.map((d) => ({
    ...d.metadata,
    supply: d.supply?.toNumber(),
  }));

  if (!address) {
    return (
      <Center w="100%" h="100%">
        <Stack spacing={4} direction="column" align="center">
          <Heading size="label.sm">
            Connect your wallet to see your owned drops
          </Heading>
          <ConnectWalletButton expectedChainId={expectedChainId} />
        </Stack>
      </Center>
    );
  }

  if (!ownedDropsMetadata?.length) {
    return (
      <Center w="100%" h="100%">
        <Stack direction="row" align="center">
          <Heading size="label.sm">No drops owned yet</Heading>
        </Stack>
      </Center>
    );
  }

  return <NftCarousel metadata={ownedDropsMetadata} />;
};

const Body: React.FC = ({ children }) => {
  return (
    <Flex as="main" px="28px" w="100%" flexGrow={1}>
      {children}
    </Flex>
  );
};

interface DropWidgetProps {
  startingTab?: Tab;
  colorScheme?: "light" | "dark";
  rpcUrl?: string;
  contractAddress: string;
  expectedChainId: number;
  relayUrl: string | undefined;
  ipfsGateway?: string;
}

const DropWidget: React.FC<DropWidgetProps> = ({
  startingTab = "claim",
  rpcUrl,
  contractAddress,
  expectedChainId,
  tokenId,
  relayUrl,
  ipfsGateway,
}) => {
  const [activeTab, setActiveTab] = useState(startingTab);

  const sdk = useSDKWithSigner({
    expectedChainId,
    rpcUrl,
    relayUrl,
    ipfsGateway,
  });
  const address = useAddress();

  const dropModule = useMemo(() => {
    if (!sdk || !contractAddress) {
      return undefined;
    }
    return sdk.getBundleDropModule(contractAddress);
  }, [sdk]);

  const activeClaimCondition = useQuery(
    ["claim-condition"],
    async () => {
      return dropModule?.getActiveClaimCondition(tokenId);
    },
    { enabled: !!dropModule && tokenId.length > 0 },
  );

  const claimed = activeClaimCondition.data?.currentMintSupply || "0";
  const totalAvailable = activeClaimCondition.data?.maxMintSupply || "0";

  const owned = useQuery(
    ["numbers", "owned", { address }],
    async () => {
      const owned = await dropModule?.getOwned(address || "");
      return BigNumber.from(owned?.length || 0);
    },
    {
      enabled: !!dropModule && !!address,
    },
  );

  const isNotSoldOut = parseInt(claimed) < parseInt(totalAvailable);

  const numOwned = BigNumber.from(owned.data || 0).toNumber();
  useEffect(() => {
    if (owned.data?.gt(0) && isNotSoldOut) {
      setActiveTab("inventory");
    }
  }, [numOwned, isNotSoldOut]);

  return (
    <Flex
      position="fixed"
      top={0}
      left={0}
      bottom={0}
      right={0}
      flexDir="column"
      borderRadius="1rem"
      overflow="hidden"
      shadow="0px 1px 1px rgba(0,0,0,0.1)"
      border="1px solid"
      borderColor="blackAlpha.100"
      bg={chakraTheme.colors.backgroundLight}
    >
      <Header
        sdk={sdk}
        tokenAddress={activeClaimCondition.data?.currency}
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab)}
        module={dropModule}
        tokenId={tokenId}
        expectedChainId={expectedChainId}
      />
      <Body>
        {activeTab === "claim" ? (
          <ClaimPage
            module={dropModule}
            tokenId={tokenId}
            sdk={sdk}
            expectedChainId={expectedChainId}
          />
        ) : (
          <InventoryPage
            module={dropModule}
            expectedChainId={expectedChainId}
          />
        )}
      </Body>
      {/* <Footer /> */}
    </Flex>
  );
};

const queryClient = new QueryClient();
const urlParams = new URL(window.location.toString()).searchParams;

const App: React.FC = () => {
  const expectedChainId = Number(urlParams.get("chainId"));
  const contractAddress = urlParams.get("contract") || "";
  const rpcUrl = urlParams.get("rpcUrl") || ""; //default to expectedChainId default
  const tokenId = urlParams.get("tokenId") || "";
  const relayUrl = urlParams.get("relayUrl") || "";
  let ipfsGateway = urlParams.get("ipfsGateway") || "";

  if (ipfsGateway.length === 0) {
    // handle origin split ipfs gateways
    if (
      window.location.origin.includes(".ipfs.") ||
      window.location.origin.startsWith("https://")
    ) {
      // we need to take the right part of the .ipfs. part
      ipfsGateway = window.location.origin.split(".ipfs.")[1];
      ipfsGateway = `https://${ipfsGateway}/ipfs/`;
    } else if (
      ipfsGateway.startsWith("http") &&
      window.location.pathname.startsWith("/ipfs/")
    ) {
      ipfsGateway = window.location.origin + "/ipfs/";
    }
  }

  const connectors = useConnectors(expectedChainId, rpcUrl);

  return (
    <>
      <Global
        styles={css`
          :host,
          :root {
            ${fontsizeCss};
          }
        `}
      />
      <QueryClientProvider client={queryClient}>
        <ChakraProvider theme={chakraTheme}>
          <Provider autoConnect connectors={connectors}>
            <DropWidget
              rpcUrl={rpcUrl}
              contractAddress={contractAddress}
              expectedChainId={expectedChainId}
              tokenId={tokenId}
              relayUrl={relayUrl}
              ipfsGateway={ipfsGateway}
            />
          </Provider>
        </ChakraProvider>
      </QueryClientProvider>
    </>
  );
};

ReactDOM.render(<>
    <ColorModeScript initialColorMode={chakraTheme.config.initialColorMode} />
    <App />
  </>, document.getElementById("root"));
