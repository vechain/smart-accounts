import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Grid,
  Heading,
  Image,
  Link,
  Text,
} from "@chakra-ui/react";
import CleanifyLogo from "../assets/cleanify.png";
import MugshotLogo from "../assets/mugshot.png";
import EVEarnLogo from "../assets/evearn.png";

export interface SupportedProjectProps {
  href: string;
  logo: string;
  name: string;
}

export const SupportedProject = () => {
  const projects = [
    { href: "https://cleanify.vet", logo: CleanifyLogo, name: "Cleanify" },
    { href: "https://mugshot.vet", logo: MugshotLogo, name: "Mugshot" },
    { href: "https://evearn.io", logo: EVEarnLogo, name: "EVEarn" },
    {
      href: "https://greencart.ai",
      logo: "https://play-lh.googleusercontent.com/SezsjuPjwTJoM5XDRhVu6Hhzb2VGdNQuQ43SmBv2lsRuzxJWZnanvDvY4b3l3HTGJ1U=w240-h480-rw",
      name: "GreenCart",
    },
    {
      href: "https://www.vechain.org",
      logo: "https://vechain.org/wp-content/uploads/2025/02/VeChain_Icon_Quartz_300ppi.png",
      name: "VeChain",
    },
  ];

  return (
    <Card justifyContent={"center"} alignItems={"center"} variant={"outline"}>
      <CardHeader>
        <Heading size={"md"}>Supported by</Heading>
      </CardHeader>

      <CardBody justifyContent={"center"}>
        <Grid
          templateColumns={["repeat(3, 1fr)", "repeat(5, 1fr)"]}
          gap={8}
          justifyContent={"center"}
        >
          {projects.map((project) => (
            <SupportedProjectItem key={project.name} {...project} />
          ))}
        </Grid>
      </CardBody>
    </Card>
  );
};

const SupportedProjectItem = ({ href, logo, name }: SupportedProjectProps) => {
  return (
    <Box
      justifyContent={"center"}
      alignItems={"center"}
      display={"flex"}
      flexDirection={"column"}
    >
      <Link href={href} isExternal>
        <Image src={logo} alt={`${name} logo`} w={"80px"} rounded="full" />
      </Link>
      <Text>{name}</Text>
    </Box>
  );
};
