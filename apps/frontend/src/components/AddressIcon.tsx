import React from "react";
import { HTMLChakraProps, Image } from "@chakra-ui/react";
import { getPicassoImgSrc } from "../utils";

interface IAddressIcon extends HTMLChakraProps<"img"> {
  address: string;
}
export const AddressIcon: React.FC<IAddressIcon> = ({ address, ...props }) => {
  return <Picasso address={address} {...props} />;
};

interface IPicasso extends HTMLChakraProps<"img"> {
  address: string;
}
const Picasso: React.FC<IPicasso> = ({ address, ...props }) => {
  return (
    <Image
      data-cy={`address-icon-${address}`}
      objectFit="cover"
      src={getPicassoImgSrc(address)}
      h="100%"
      {...props}
    />
  );
};
