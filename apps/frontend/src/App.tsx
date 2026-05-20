import { Box } from "@chakra-ui/react";
import { Home } from "./pages/Home";
import { Navbar } from "./components/Navbar";

function App() {
  return (
    <Box minH="100vh" w="full">
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
