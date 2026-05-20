import {
  Button,
  HStack,
  Text,
  useClipboard,
  Icon,
  ButtonProps,
  ImageProps,
  TextProps,
} from "@chakra-ui/react";
import React, { useEffect } from "react";
import { AddressIcon } from "./AddressIcon";

import { FaCheck, FaCopy } from "react-icons/fa6";
import { FaWallet } from "react-icons/fa";
import { humanAddress } from "../utils";

interface IAddressButton extends ButtonProps {
  address: string;
  showAddressIcon?: boolean;
  showCopyIcon?: boolean;
  showInfoIcon?: boolean;
  addressTextProps?: TextProps;
  buttonSize?: string;
  imageProps?: ImageProps;
  showFullAddress?: boolean;
  charAtStart?: number;
  charAtEnd?: number;
}
export const AddressButton: React.FC<IAddressButton> = ({
  address,
  showAddressIcon = true,
  showCopyIcon = true,
  showInfoIcon = false,
  addressTextProps = {},
  buttonSize = "md",
  imageProps = {},
  showFullAddress = false,
  charAtStart = 6,
  charAtEnd = 4,
  ...props
}) => {
  const { onCopy, hasCopied, setValue } = useClipboard(address);

  const { onClick, ...otherProps } = props;

  const onClickHandler = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    if (onClick) onClick(e);
    if (showCopyIcon) onCopy();
  };

  useEffect(() => {
    setValue(address);
  }, [address, setValue]);

  const spacing = ["xs", "sm"].includes(buttonSize) ? 2 : 3;

  return (
    <Button
      data-cy={`address-button-${address}`}
      size={buttonSize}
      onClick={onClickHandler}
      pl={showAddressIcon ? 1 : 3}
      pr={3}
      borderRadius="full"
      variant="outline"
      borderColor="border.subtle"
      bg="whiteAlpha.50"
      _light={{ bg: "blackAlpha.50" }}
      _hover={{
        bg: "whiteAlpha.100",
        borderColor: "border.brand",
        _light: { bg: "white" },
      }}
      transition="all 0.15s ease"
      {...otherProps}
    >
      <HStack
        justify={"flex-start"}
        spacing={spacing}
        h="full"
      >
        {showInfoIcon && (
          <Icon
            data-cy="address-button-info-icon"
            aria-label="View details"
            as={FaWallet}
            color="text.muted"
          />
        )}
        {showAddressIcon && (
          <AddressIcon address={address} rounded="full" {...imageProps} />
        )}
        <Text
          fontFamily="mono"
          fontWeight={500}
          letterSpacing="-0.01em"
          {...addressTextProps}
        >
          {showFullAddress
            ? address
            : humanAddress(address, charAtStart, charAtEnd)}
        </Text>
        {showCopyIcon && (
          <Icon
            data-cy="address-button-copy-icon"
            aria-label="Copy Address"
            as={hasCopied ? FaCheck : FaCopy}
            color={hasCopied ? "brand.400" : "text.muted"}
            boxSize="12px"
            transition="color 0.15s ease"
          />
        )}
      </HStack>
    </Button>
  );
};

export const AddressButtonGhostVariant = (props: IAddressButton) => (
  <AddressButton
    buttonSize="sm"
    imageProps={{
      rounded: "full",
      boxSize: "20px",
    }}
    addressTextProps={{
      fontSize: "sm",
      fontWeight: 500,
    }}
    {...props}
  />
);
