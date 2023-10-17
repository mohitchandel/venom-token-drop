import { Address, getRandomNonce, toNano, zeroAddress } from "locklift";
import BigNumber from "bignumber.js";

async function main() {
  const signer = (await locklift.keystore.getSigner("0"))!;

  // Address of initial token supply recipient (write your own)
  const initialSupplyTo = new Address("0:8f2e9698de6ee662125b7bc09173a51f4935f3c7b8b3e1514f6fc21e17eb1cdf");
  // Address of token owner (write your own)
  const rootOwner = new Address("0:8f2e9698de6ee662125b7bc09173a51f4935f3c7b8b3e1514f6fc21e17eb1cdf");
  // Name of the token
  const name = "BP Venom Token";
  // Symbol of the token
  const symbol = "BPVT";
  // How many token will be issued instantly after deploy
  const initialSupply = 10000000;
  // The number of decimals the token uses
  const decimals = 18;
  // If `true`, disables token minting
  const disableMint = false;
  // If `true`, disables token burning by root
  const disableBurnByRoot = false;
  // If `true`, pauses token burning
  const pauseBurn = false;

  const TokenWallet = locklift.factory.getContractArtifacts("TokenWallet");

  const { contract: tokenRoot } = await locklift.factory.deployContract({
    contract: "TokenRoot",
    publicKey: signer.publicKey,
    initParams: {
      deployer_: zeroAddress, // this field should be zero address if deploying with public key (see source code)
      randomNonce_: getRandomNonce(),
      rootOwner_: rootOwner,
      name_: name,
      symbol_: symbol,
      decimals_: decimals,
      walletCode_: TokenWallet.code,
    },
    constructorParams: {
      initialSupplyTo: initialSupplyTo,
      initialSupply: new BigNumber(initialSupply).shiftedBy(decimals).toFixed(),
      deployWalletValue: toNano(1),
      mintDisabled: disableMint,
      burnByRootDisabled: disableBurnByRoot,
      burnPaused: pauseBurn,
      remainingGasTo: zeroAddress,
    },
    value: toNano(5),
  });

  console.log(` Token ${name} deployed at ${tokenRoot.address}`);

  const { contract } = await locklift.factory.deployContract({
    contract: "TokenDistribution",
    publicKey: signer.publicKey,
    initParams: {
      _nonce: locklift.utils.getRandomNonce(),
      _owner: new Address("0:8f2e9698de6ee662125b7bc09173a51f4935f3c7b8b3e1514f6fc21e17eb1cdf"),
    },
    constructorParams: {
      distributedTokenRoot: tokenRoot.address,
      supply: new BigNumber(initialSupply).shiftedBy(decimals).toFixed(),
      sendRemainingGasTo: new Address("0:8f2e9698de6ee662125b7bc09173a51f4935f3c7b8b3e1514f6fc21e17eb1cdf"),
    },
    value: locklift.utils.toNano(2),
  });
  const tokenDistribution = contract;

  console.log(`Contract deployed at: ${tokenDistribution.address.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
