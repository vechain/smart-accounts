import { Box, useColorModeValue } from "@chakra-ui/react";
import { Home } from "./pages/Home";
import { Navbar } from "./components/Navbar";

function App() {
  const gradient = useColorModeValue(
    "radial-gradient(900px circle at 10% -10%, rgba(19,229,197,0.18) 0%, transparent 55%), radial-gradient(900px circle at 100% 20%, rgba(123,63,228,0.12) 0%, transparent 55%), #F7F9FC",
    "radial-gradient(900px circle at 10% -10%, rgba(19,229,197,0.18) 0%, transparent 50%), radial-gradient(900px circle at 90% 20%, rgba(123,63,228,0.22) 0%, transparent 50%), radial-gradient(700px circle at 50% 100%, rgba(19,229,197,0.08) 0%, transparent 60%), #05070F"
  );

  return (
    <Box minH="100vh" w="full" backgroundImage={gradient}>
      <Navbar />
      <Box
        as="main"
        maxW="1200px"
        mx="auto"
        px={{ base: 4, md: 8 }}
        pt={{ base: 6, md: 10 }}
        pb={{ base: 12, md: 20 }}
      >
        <Home />
      </Box>
    </Box>
  );
}

export default App;
