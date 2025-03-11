import { HStack, Heading, Image, Stack } from "@chakra-ui/react";
import { WalletButton } from "@vechain/vechain-kit";
import logo from "../../assets/logo.png";

export const Navbar = () => {
  return (
    <Stack
      direction={"row"}
      justify={"center"}
      w={"full"}
      borderBottom={"1px solid #EEEEEE"}
    >
      <HStack justify={"space-between"} p={2} maxW={"1000px"} w={"full"}>
        <HStack spacing={2}>
          <Image src={logo} alt="logo" w={"50px"} rounded="full" />
          <Heading size={"sm"}>VeChain Smart Accounts</Heading>
        </HStack>

        <HStack spacing={4}>
          <WalletButton mobileVariant="icon" connectionVariant="popover" />
        </HStack>
      </HStack>
    </Stack>
  );
};
