import { expect } from "chai";
import {
  Address,
  Contract,
  ProviderRpcClient,
  Signer,
  WalletTypes,
  getRandomNonce,
  toNano,
  zeroAddress,
} from "locklift";
import { FactorySource } from "../build/factorySource";
import BigNumber from "bignumber.js";

let tokenDistribution: Contract<FactorySource["TokenDistribution"]>;
let tokenRoot: Contract<FactorySource["TokenRoot"]>;
let signer: Signer;
let account: any;

const ZERO_ADDRESS = "0:0000000000000000000000000000000000000000000000000000000000000000";

describe("Test Sample contract", async function () {
  before(async () => {
    signer = (await locklift.keystore.getSigner("0"))!;
    const { account: accountAddOperation } = await locklift.factory.accounts.addNewAccount({
      type: WalletTypes.WalletV3,
      value: toNano(100000),
      publicKey: signer.publicKey,
    });
    account = accountAddOperation;
    const { contract: tip3root } = await locklift.factory.deployContract({
      contract: "TokenRoot",
      publicKey: signer.publicKey,
      initParams: {
        randomNonce_: 0,
        deployer_: new Address(ZERO_ADDRESS),
        name_: "test",
        symbol_: "tst",
        decimals_: 9,
        rootOwner_: account.address,
        walletCode_: locklift.factory.getContractArtifacts("TokenWallet").code,
      },
      constructorParams: {
        initialSupplyTo: account.address,
        initialSupply: new BigNumber("10000").shiftedBy(9).toFixed(),
        deployWalletValue: 100000000,
        mintDisabled: true,
        burnByRootDisabled: true,
        burnPaused: false,
        remainingGasTo: account.address,
      },
      value: toNano(2),
    });
    tokenRoot = tip3root;
  });
  describe("Contracts", async function () {
    it("Load contract factory", async function () {
      const tokenDistribution = locklift.factory.getContractArtifacts("TokenDistribution");

      expect(tokenDistribution.code).not.to.equal(undefined, "Code should be available");
      expect(tokenDistribution.abi).not.to.equal(undefined, "ABI should be available");
      expect(tokenDistribution.tvc).not.to.equal(undefined, "tvc should be available");
    });

    it("Deploy contract", async function () {
      const { contract } = await locklift.factory.deployContract({
        contract: "TokenDistribution",
        publicKey: signer.publicKey,
        initParams: {
          _nonce: locklift.utils.getRandomNonce(),
          _owner: account.address,
        },
        constructorParams: {
          distributedTokenRoot: tokenRoot.address,
          supply: new BigNumber("10000").shiftedBy(9).toFixed(),
          sendRemainingGasTo: account.address,
        },
        value: locklift.utils.toNano(2),
      });
      tokenDistribution = contract;

      expect(
        await locklift.provider.getBalance(tokenDistribution.address).then(balance => Number(balance)),
      ).to.be.above(0);
    });

    it("Send supply to tokensale wallet", async function () {
      // get TokenWallet address of owner and instantiate it via factory
      const { value0: ownerWalletAddress } = await tokenRoot.methods
        .walletOf({
          answerId: 0,
          walletOwner: account.address,
        })
        .call();
      const ownerWallet = locklift.factory.getDeployedContract("TokenWallet", ownerWalletAddress);

      // get TokenWallet address of tokensale and instantiate it via factory.
      // so, we can call _distributedTokenWallet method of tokensale as a variant
      const { value0: tokenDistWalletAddress } = await tokenRoot.methods
        .walletOf({
          answerId: 0,
          walletOwner: tokenDistribution.address,
        })
        .call();
      const tokenDistWallet = locklift.factory.getDeployedContract("TokenWallet", tokenDistWalletAddress);

      // transfering token supply to tokensale wallet for future sales
      await ownerWallet.methods
        .transfer({
          amount: new BigNumber("10000").shiftedBy(9).toFixed(),
          recipient: tokenDistribution.address,
          deployWalletValue: 100000000,
          remainingGasTo: account.address,
          notify: false,
          payload: "",
        })
        .send({
          from: account.address,
          amount: toNano(1.11),
        });
      const tokenDistBalance = await tokenDistWallet.methods.balance({ answerId: 0 }).call();
      expect(tokenDistBalance.value0).to.be.eq(new BigNumber("10000").shiftedBy(9).toFixed());
    });

    it("Interact with contract", async function () {
      const amount = 4000000000;

      const aliceS = (await locklift.keystore.getSigner("0"))!;
      const { account: alice } = await locklift.factory.accounts.addNewAccount({
        type: WalletTypes.WalletV3,
        value: toNano(10000),
        publicKey: aliceS.publicKey,
      });
      const { value0: aliceWalletAddress } = await tokenRoot.methods
        .walletOf({
          answerId: 0,
          walletOwner: alice.address,
        })
        .call();
      const aliceWallet = locklift.factory.getDeployedContract("TokenWallet", aliceWalletAddress);

      const bobS = (await locklift.keystore.getSigner("1"))!;
      const { account: bob } = await locklift.factory.accounts.addNewAccount({
        type: WalletTypes.WalletV3,
        value: toNano(10000),
        publicKey: bobS.publicKey,
      });
      const { value0: bobWalletAddress } = await tokenRoot.methods
        .walletOf({
          answerId: 0,
          walletOwner: bob.address,
        })
        .call();
      const bobWallet = locklift.factory.getDeployedContract("TokenWallet", bobWalletAddress);

      const jackS = (await locklift.keystore.getSigner("2"))!;
      const { account: jack } = await locklift.factory.accounts.addNewAccount({
        type: WalletTypes.WalletV3,
        value: toNano(10000),
        publicKey: jackS.publicKey,
      });
      const { value0: jackWalletAddress } = await tokenRoot.methods
        .walletOf({
          answerId: 0,
          walletOwner: jack.address,
        })
        .call();
      const jackWallet = locklift.factory.getDeployedContract("TokenWallet", jackWalletAddress);

      // const wallets = [aliceWalletAddress, bobWalletAddress, jackWalletAddress];
      const wallets = [alice.address, bob.address, jack.address];

      await tokenDistribution.methods
        .whiteListAddresses({
          _walletAddresses: wallets,
        })
        .sendExternal({ publicKey: signer.publicKey });

      const walletResponse = await tokenDistribution.methods.getWhiteListedAddresses({}).call();

      expect(walletResponse.whiteListedWallets.length).to.be.equal(wallets.length);

      const tracing = await locklift.tracing.trace(
        await tokenDistribution.methods.distributeTokens({ amount }).send({
          from: account.address,
          amount: String(Number(toNano(1))),
        }),
      );

      const aliceNewBalance = await aliceWallet.methods.balance({ answerId: 0 }).call();
      expect(aliceNewBalance.value0).to.be.equal(String(amount));

      const bobNewBalance = await bobWallet.methods.balance({ answerId: 0 }).call();
      expect(bobNewBalance.value0).to.be.equal(String(amount));

      const jackNewBalance = await jackWallet.methods.balance({ answerId: 0 }).call();
      expect(jackNewBalance.value0).to.be.equal(String(amount));
    });
  });
});
