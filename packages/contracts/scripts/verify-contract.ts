import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import FormData from "form-data";
import { execSync } from "child_process";

interface NetworkInfo {
  id: string;
  name: string;
}

// Network mappings
const NETWORKS: Record<string, NetworkInfo> = {
  mainnet: { id: "100009", name: "VeChain Mainnet" },
  testnet: { id: "100010", name: "VeChain Testnet" },
};

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: ts-node verify-contract.ts <contract-address> <network> [contract-name] [--partial-match]"
    );
    console.error("Available networks: mainnet, testnet");
    console.error("Options:");
    console.error(
      "  --partial-match  Try partial match if full match fails (metadata hash only)"
    );
    console.error(
      "Example: ts-node verify-contract.ts 0x123... mainnet SimpleAccount --partial-match"
    );
    process.exit(1);
  }

  const contractAddress = args[0];
  const network = args[1];
  let contractName = "SimpleAccount";
  let usePartialMatch = false;

  // Parse the remaining arguments
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--partial-match") {
      usePartialMatch = true;
    } else if (!args[i].startsWith("--")) {
      contractName = args[i];
    }
  }

  // Validate network
  if (!NETWORKS[network]) {
    console.error(`Error: Network '${network}' not supported.`);
    console.error("Available networks: mainnet, testnet");
    process.exit(1);
  }

  const chainId = NETWORKS[network].id;
  const networkName = NETWORKS[network].name;
  const verificationMode = usePartialMatch ? "partial match" : "full match";

  console.log(
    `Verifying ${contractName} at ${contractAddress} on ${networkName} (chainId: ${chainId}) using ${verificationMode}...`
  );

  // Paths for temporary files
  const tempDir = path.join(__dirname, `../temp-verify-${contractAddress}`);

  // Create temp directory if it doesn't exist
  if (fs.existsSync(tempDir)) {
    console.log("Cleaning up existing temp directory...");
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  fs.mkdirSync(tempDir, { recursive: true });

  // Define contract paths based on contractName
  let contractPath: string;
  let contractFilePattern: string;

  if (contractName === "SimpleAccount") {
    contractPath = "contracts/accounts/SimpleAccount.sol";
    contractFilePattern = "accounts/SimpleAccount";

    // Create directories for SimpleAccount
    fs.mkdirSync(path.join(tempDir, "contracts/accounts/callback"), {
      recursive: true,
    });

    // Copy contract files
    fs.copyFileSync(
      path.join(__dirname, "../contracts/accounts/SimpleAccount.sol"),
      path.join(tempDir, "contracts/accounts/SimpleAccount.sol")
    );

    fs.copyFileSync(
      path.join(
        __dirname,
        "../contracts/accounts/callback/TokenCallbackHandler.sol"
      ),
      path.join(tempDir, "contracts/accounts/callback/TokenCallbackHandler.sol")
    );
  } else if (contractName === "SimpleAccountFactory") {
    contractPath = "contracts/accounts/SimpleAccountFactory.sol";
    contractFilePattern = "accounts/SimpleAccountFactory";

    // Create directories for SimpleAccountFactory
    fs.mkdirSync(path.join(tempDir, "contracts/accounts/callback"), {
      recursive: true,
    });

    // Copy contract files
    fs.copyFileSync(
      path.join(__dirname, "../contracts/accounts/SimpleAccountFactory.sol"),
      path.join(tempDir, "contracts/accounts/SimpleAccountFactory.sol")
    );

    fs.copyFileSync(
      path.join(__dirname, "../contracts/accounts/SimpleAccount.sol"),
      path.join(tempDir, "contracts/accounts/SimpleAccount.sol")
    );

    fs.copyFileSync(
      path.join(
        __dirname,
        "../contracts/accounts/callback/TokenCallbackHandler.sol"
      ),
      path.join(tempDir, "contracts/accounts/callback/TokenCallbackHandler.sol")
    );
  } else {
    console.error(`Error: Contract '${contractName}' not supported.`);
    console.error("Supported contracts: SimpleAccount, SimpleAccountFactory");
    process.exit(1);
  }

  // Extract metadata from compiled artifacts
  console.log(`Extracting metadata for ${contractName}...`);

  // Find build-info files to extract metadata
  const buildInfoDir = path.join(__dirname, "../artifacts/build-info");

  if (!fs.existsSync(buildInfoDir)) {
    console.error(
      "Build info directory not found. Make sure you have compiled the contracts."
    );
    process.exit(1);
  }

  const buildInfoFiles = fs
    .readdirSync(buildInfoDir)
    .filter((file) => file.endsWith(".json"));

  if (buildInfoFiles.length === 0) {
    console.error(
      "No build-info files found. Make sure you have compiled the contracts."
    );
    process.exit(1);
  }

  // Find metadata in build-info files
  let metadata = null;

  for (const file of buildInfoFiles) {
    const buildInfoPath = path.join(buildInfoDir, file);
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));

    if (
      buildInfo.output &&
      buildInfo.output.contracts &&
      buildInfo.output.contracts[contractPath] &&
      buildInfo.output.contracts[contractPath][contractName]
    ) {
      const contractOutput =
        buildInfo.output.contracts[contractPath][contractName];

      if (contractOutput.metadata) {
        metadata = JSON.parse(contractOutput.metadata);
        console.log(`Found metadata in ${file}`);
        break;
      }
    }
  }

  if (!metadata) {
    console.error(
      `Metadata for ${contractName} not found in any build-info file.`
    );
    process.exit(1);
  }

  // Save metadata to temp directory
  const metadataPath = path.join(tempDir, "metadata.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Extract source files from metadata
  const filesToInclude: string[] = [];

  if (metadata.sources) {
    console.log("Contract sources found in metadata:");
    Object.keys(metadata.sources).forEach((source) => {
      console.log(` - ${source}`);

      // If it's a local file (not from node_modules), add it to the list
      if (!source.includes("node_modules")) {
        filesToInclude.push(source);
      }
    });
  } else {
    console.error("No sources found in metadata file");
    process.exit(1);
  }

  // Create form data for Sourcify API
  const form = new FormData();
  form.append("address", contractAddress);
  form.append("chain", chainId);

  // Add match type if partial match is requested
  if (usePartialMatch) {
    form.append("match", "metadata-only");
  }

  // Add metadata
  console.log("Adding metadata.json...");
  form.append("files", fs.createReadStream(metadataPath), {
    filename: "metadata.json",
    contentType: "application/json",
  });

  // Add source files
  for (const file of filesToInclude) {
    const filePath = path.join(__dirname, "..", file);

    if (fs.existsSync(filePath)) {
      console.log(`Adding ${file}...`);
      form.append("files", fs.createReadStream(filePath), {
        filename: file,
        contentType: "text/plain",
      });
    } else {
      console.warn(`Warning: File ${filePath} not found.`);
    }
  }

  // Submit verification request
  console.log("Submitting verification request to Sourcify...");
  try {
    // First check if the contract is already verified
    const checkUrl = `https://sourcify.dev/server/check-by-addresses?addresses=${contractAddress}&chainIds=${chainId}`;
    console.log(`Checking if contract is already verified: ${checkUrl}`);

    const checkResponse = await axios.get(checkUrl);
    const checkData = checkResponse.data;

    if (
      checkData &&
      checkData.length > 0 &&
      (checkData[0].status === "perfect" || checkData[0].status === "partial")
    ) {
      console.log("\nContract is already verified on Sourcify!");
      console.log(
        `You can view it here: https://sourcify.dev/lookup/${chainId}/${contractAddress}`
      );
      return;
    }

    // If not verified, proceed with verification
    const response = await axios.post(
      "https://sourcify.dev/server/verify",
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      }
    );

    console.log(
      "Verification response:",
      JSON.stringify(response.data, null, 2)
    );

    if (response.status === 200) {
      console.log("\nVerification successful!");
      console.log(
        `Contract is now verified on Sourcify: https://sourcify.dev/lookup/${chainId}/${contractAddress}`
      );
    }
  } catch (err) {
    const error = err as any;
    if (error.response) {
      console.error("Verification failed with status:", error.response.status);
      console.error(
        "Error message:",
        JSON.stringify(error.response.data, null, 2)
      );

      // Handle bytecode mismatch error
      if (
        error.response.data &&
        typeof error.response.data === "object" &&
        error.response.data.error &&
        (error.response.data.error.includes("bytecode length doesn't match") ||
          error.response.data.error ===
            "The recompiled bytecode length doesn't match the onchain bytecode length.")
      ) {
        console.log("\nBytecode mismatch detected!");

        if (!usePartialMatch) {
          console.log(
            "Try running the command again with the --partial-match flag:"
          );
          console.log(
            `npx ts-node scripts/verify-contract.ts ${contractAddress} ${network} ${contractName} --partial-match`
          );
          console.log(
            "\nThis will attempt to verify based on metadata hash only, which is less strict."
          );
        } else {
          console.log(
            "\nEven partial match verification failed. This can happen if:"
          );
          console.log(
            "1. The contract was deployed with a different compiler version or settings"
          );
          console.log(
            "2. The contract was deployed with constructor parameters"
          );
          console.log(
            "3. The contract was deployed from a different source code than what you're trying to verify"
          );
        }
      }

      // Handle already verified
      if (
        error.response.data &&
        typeof error.response.data === "string" &&
        error.response.data.includes("already verified")
      ) {
        console.log("\nThe contract seems to be already verified on Sourcify.");
        console.log(
          `You can check it here: https://sourcify.dev/lookup/${chainId}/${contractAddress}`
        );
      }
    } else {
      console.error("Error:", error.message);
    }
  }

  // Clean up the temp directory
  console.log("Cleaning up temporary files...");
  fs.rmSync(tempDir, { recursive: true, force: true });
}

main().catch((err: unknown) => {
  console.error("Error during verification:", err);
});
