// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/DragonRewardDistributor.sol";

/**
 * @title DeployDragonRewardDistributor
 * @notice Deploy DragonRewardDistributor to BSC Mainnet with state migration
 *
 * Generated: 2026-03-15T00:33:43.242Z
 * Claimers: 167
 *
 * Usage:
 *   forge script script/DeployDragonRewardDistributor.s.sol:DeployDragonRewardDistributor --rpc-url $RPC_URL -vvv
 *   forge script script/DeployDragonRewardDistributor.s.sol:DeployDragonRewardDistributor --rpc-url $RPC_URL --broadcast
 */
contract DeployDragonRewardDistributor is Script {
    uint256 constant MIGRATION_EPOCH = 69;
    bytes32 constant MIGRATION_MERKLE_ROOT = 0x3194c47f5f3f59a2d48b3936314be470250935d89ee980c971b06fc2b89d2eb4;

    function run() external {
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address dragonToken = vm.envAddress("DRAGON_TOKEN_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("\n========================================");
        console.log("DRAGON REWARD DISTRIBUTOR DEPLOYMENT");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Operator:", operator);
        console.log("Dragon Token:", dragonToken);

        (address[] memory users, uint256[] memory amounts) = getMigrationData();
        console.log("Migration Users:", users.length);

        vm.startBroadcast(deployerPrivateKey);

        DragonRewardDistributor distributor = new DragonRewardDistributor(operator);
        console.log("DragonRewardDistributor deployed at:", address(distributor));

        distributor.setTargetToken(dragonToken);
        console.log("Target token set");

        distributor.initializeFromV2(
            MIGRATION_EPOCH,
            MIGRATION_MERKLE_ROOT,
            users,
            amounts
        );
        console.log("Migration complete!");
        console.log("  Epoch:", distributor.currentEpoch());
        console.log("  Initialized:", distributor.initialized());

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("DragonRewardDistributor:", address(distributor));
        console.log("Owner:", deployer);
        console.log("Operator:", operator);
        console.log("Target Token:", dragonToken);
        console.log("\n========================================");
        console.log("NEXT STEPS");
        console.log("========================================");
        console.log("1. Pause old contract");
        console.log("2. emergencyWithdraw DRAGON from old contract");
        console.log("3. Transfer DRAGON to new contract:", address(distributor));
        console.log("4. Update server .env with new contract address");
        console.log("5. Test a claim on new contract");
        console.log("========================================\n");
    }

    function getMigrationData() internal pure returns (address[] memory users, uint256[] memory amounts) {
        users = new address[](167);
        amounts = new uint256[](167);

        users[0] = 0x545BDa840366390aC986306744159d8E2948C0A1;
        amounts[0] = 4482477992889744842165607;

        users[1] = 0x1b80D0C2574e253a5aa5C01ba4b56B140AeE8639;
        amounts[1] = 755025942688845652452926;

        users[2] = 0x47d03822d1ca87aE26fC631c8C0D60c16561868D;
        amounts[2] = 600757832491000266957305;

        users[3] = 0x3A832453f6d7f589266e6bc4a824aF348326561C;
        amounts[3] = 841563908809160263876666;

        users[4] = 0x5f77eeaEeb2b193CCcF6862D2a654db1607B9C1D;
        amounts[4] = 844650179187354177616027;

        users[5] = 0xd37d8F748F0fbd832f680bBe93DED6BC011d4629;
        amounts[5] = 381868681042019485950967;

        users[6] = 0x757fA12131528fAD8742A8AC1f49d01dB9AA996B;
        amounts[6] = 245449632559543529493049;

        users[7] = 0xEcF47f4ca730fa271434D52A15bA1Cb1c08EDDAd;
        amounts[7] = 271600675111310378102037;

        users[8] = 0xB7DF610DDd0371268208c8450c42Df5cf6Ba6887;
        amounts[8] = 525587998422667382759728;

        users[9] = 0x7B2e487bAd98FbdA96E6675bf273C9DA61AdE94D;
        amounts[9] = 452898939211076404156294;

        users[10] = 0xABDbCB0309D7F5e81CA9618Ea3b71C13a490A71c;
        amounts[10] = 45950287345641205157606;

        users[11] = 0x8BA48e58F97942c2D2a87381A6bd4c387199a910;
        amounts[11] = 487395404262986654960234;

        users[12] = 0x44adF8f93cD3C55e41eCd508Db5634128072cA1a;
        amounts[12] = 403962048445224288914398;

        users[13] = 0xaA4aF65cf4f890C7E84dD37e3f070dbad6C75915;
        amounts[13] = 298544828446240498060083;

        users[14] = 0x9A0a9d743EC3353C81734d6568b72E5ec7f4C21f;
        amounts[14] = 256401626234289257153248;

        users[15] = 0xd90c3B94CD4384a665966d902a22433e2D75139e;
        amounts[15] = 151371619907511965491011;

        users[16] = 0x3cbc6A8d764B2088B3cbb8286ecf01ee46ef6F43;
        amounts[16] = 837483739542044326331121;

        users[17] = 0xd917cce2b13640B7F2A5a2F48d6AeF95008EB8D2;
        amounts[17] = 145298593233257820667142;

        users[18] = 0x0Dc014fdFBB16B2cD77EA98679f8Eb2f3D4c7225;
        amounts[18] = 226988423787493356466582;

        users[19] = 0x369848B001d3Db38A12609955f7f3615a8633Bc5;
        amounts[19] = 382940269241782247939070;

        users[20] = 0xd6267dC678B13fc0Ed94bef16A7962AcECe3a496;
        amounts[20] = 137627349186899122706256;

        users[21] = 0xEe245aFF275877c9075A77a391d2FB78B60DF981;
        amounts[21] = 110680798653479729027531;

        users[22] = 0xf65221c52c11d3dAF5CeD6BE60988DA3dC3538bF;
        amounts[22] = 278950158640133288250655;

        users[23] = 0x37dae2aAa033De9E68369bEfE337f45fF9E95fD3;
        amounts[23] = 329197493291449038240640;

        users[24] = 0x45D730dA4E3723DDa40ca248DD93F9CE9Da92Ab3;
        amounts[24] = 309259353876829653019295;

        users[25] = 0xCF5D9cB0Cb2ebFf14c5166CF79f8174f8197fcD5;
        amounts[25] = 515507001006988369033432;

        users[26] = 0xbE68cE192597867c3eeA9b66F8c3FB69A694aBb9;
        amounts[26] = 326588944964313890679573;

        users[27] = 0x08a184bA18C7d875715184D727999558dEe37c53;
        amounts[27] = 296422667629295978893464;

        users[28] = 0xE494492ac84DA0aaE166398d23F7007c0E89D254;
        amounts[28] = 100628236560826992211102;

        users[29] = 0xc336A1315a315ee596CBbc881c1c392BF12c9865;
        amounts[29] = 6610989159131649419783;

        users[30] = 0x750f9706905266474cdc9474B830c80615B2e3d9;
        amounts[30] = 222121714146798337019775;

        users[31] = 0xd079456175C2A247C924f703Aa34132B47AdFAe8;
        amounts[31] = 162036644683849376190967;

        users[32] = 0x9b197011b6c97380F0B5A9e6D21F3ae3D67988a2;
        amounts[32] = 223389609235443683411086;

        users[33] = 0x5462a9eFB89520Be5dc0a9E126207b0E0a5973E7;
        amounts[33] = 169187796922681266192359;

        users[34] = 0xe538E3a3D8aae0DB58F9e4E419eB65D857077BBc;
        amounts[34] = 170739529716935335008362;

        users[35] = 0xfbb64Cb305c88890ef81A8cDA289dcbD4E4C5c47;
        amounts[35] = 116459446672383539865068;

        users[36] = 0x43a7e0636145E806947763b870EEfB492F46DdCA;
        amounts[36] = 92189689329585356615142;

        users[37] = 0xae5A461b56FCc6594656dc853657E6c5a3f22a87;
        amounts[37] = 142653168031792587039152;

        users[38] = 0x1B9a00192f37BB52D7c0312971A1180e3e144Bd3;
        amounts[38] = 137657331240248101851139;

        users[39] = 0x7a19096774f046c38E898Be07a1C8fd154c061BE;
        amounts[39] = 142194876895230327370619;

        users[40] = 0xC299b99cDFA6FdaA2E6D5DD288d6e4faacFDAdeF;
        amounts[40] = 141221796799196080991465;

        users[41] = 0x8CF9A24C8E58736657E8764EAc4Bf86Ed217f101;
        amounts[41] = 131385715497797357931952;

        users[42] = 0xBd1591144bDD48bb5A6F02c198Ec99B466550DFe;
        amounts[42] = 55066337619688615132863;

        users[43] = 0xA7c08411e3Ba7f789224066eA7Df024F0dAB5af8;
        amounts[43] = 175227405892541475007688;

        users[44] = 0xEF9E9106929db0ce720f7cFaD31E883FB6C0096b;
        amounts[44] = 133916519575529541507404;

        users[45] = 0xfbf6B4E7D2c300093959e2e0473689e5F03d446E;
        amounts[45] = 128104719387232014770346;

        users[46] = 0xa68cCd6e0B791d0889E3ACde0117644aCB99A482;
        amounts[46] = 151950410915074773698090;

        users[47] = 0x85589b7Bc68737d888E24e363405D57BD19a845a;
        amounts[47] = 12816136986967279947221;

        users[48] = 0x347Fc97240a6988A0989E68C6e1604e59Abb5628;
        amounts[48] = 84234045372095304248521;

        users[49] = 0x896Dc30968c8a706a56a116029cf7c5D33eAfBAa;
        amounts[49] = 127040520692947273440103;

        users[50] = 0x2381E5F9574c166f0f32baC8acE96Ca7F03f010B;
        amounts[50] = 61647449782666360188812;

        users[51] = 0xa88D1F1873376b65D639537ABF4763794F34Cb82;
        amounts[51] = 61394031494417455523176;

        users[52] = 0xEE909782aa6927616Efb2236A654BE9C1C9476ee;
        amounts[52] = 12504643145723509885024;

        users[53] = 0x2FbbbB6a9D7Ea7C041A77C502972353511f0D4aC;
        amounts[53] = 102901500741936100556261;

        users[54] = 0xfADb2242042cd076201626Df5359b4DE9D3DD165;
        amounts[54] = 41614436173107515285296;

        users[55] = 0x9213EF70a85F89bFA22a571f2AC8eC35d443c935;
        amounts[55] = 102185555166340188865894;

        users[56] = 0xB9f2fCDFb951aEd26B7C29873143bD3438BB7e9d;
        amounts[56] = 81070559317344707273492;

        users[57] = 0xbD281002Ff9c40625a1A4E8A77906d8570642921;
        amounts[57] = 121183952590305235659899;

        users[58] = 0xdF9E1bAfc762AD0Fd66886D2054B141D58E3aC69;
        amounts[58] = 98043228809391091359667;

        users[59] = 0x01D41c17675a733fc92d583d9FC326EFf18cEbc3;
        amounts[59] = 82300316765692300756600;

        users[60] = 0xBA924680301A8A4fa0225f18bd85b591d80dA8bB;
        amounts[60] = 36827330783969555838303;

        users[61] = 0xBafC5b52c21a655D6eFf4f496543fFcB105b7FAB;
        amounts[61] = 131144313090683624611374;

        users[62] = 0xFCF43501D87D3799E53cCE8386E6e5d8D9CBdf0F;
        amounts[62] = 93481455045547852367406;

        users[63] = 0x3c84B3b05307d21c4579c13b134EFDd4755D2E01;
        amounts[63] = 27936722619826117476086;

        users[64] = 0x361ec5C1c79cfa3878950aC3b0e4b586C928DD00;
        amounts[64] = 42596765348820641856634;

        users[65] = 0x88d06526a3617052E3A4889f2b1f6E968fC7f5AC;
        amounts[65] = 6182929604564563408308;

        users[66] = 0x42b71Fb1D5E4746541B1c2A580C7677CFe477F12;
        amounts[66] = 77527485771420370010888;

        users[67] = 0xAf80940f8085A8987Ac66A22E6B08e7294cC9539;
        amounts[67] = 83067382303825687495255;

        users[68] = 0xBb9a3E4Fb4F1F9F27376c9237441637c5457037c;
        amounts[68] = 39903837203749688559557;

        users[69] = 0x841499b70A843999b2b114CB25b5c9EFE3780268;
        amounts[69] = 45355804543011882239737;

        users[70] = 0x1f9Df16d51B98D95325e6F0969bf1e02008E288B;
        amounts[70] = 3423435872866191606618;

        users[71] = 0xB2De7A7a64FE0Fc9096a04789895C01a4A757445;
        amounts[71] = 67416227231386183884905;

        users[72] = 0xBaDc42c8e01e0B60b1664E62cc5b40ef2C2333D8;
        amounts[72] = 40384503200624348441449;

        users[73] = 0x52305D5D48796Faf9B591C2bCb1CAfF4AF9259bb;
        amounts[73] = 82410282950684000864405;

        users[74] = 0x15032c5Ef2749e2D37E09b06384B3E06c0e0a239;
        amounts[74] = 69585425366786138550833;

        users[75] = 0x57903e8856b7D5aA9bDD56B8AD475a7Bc1EcacC3;
        amounts[75] = 24539370214274660772697;

        users[76] = 0x17fB74cD680D1c7090016f276F900d8Af37250C1;
        amounts[76] = 45105050608642197089543;

        users[77] = 0x4E5525Ff13c2c998b3d1bF551Ec10748fb0f6e8a;
        amounts[77] = 33706750133485993550743;

        users[78] = 0x5e490AC166377d9EAe3D9C3dF81a14EC42E88115;
        amounts[78] = 48163481337106587655045;

        users[79] = 0x12834BF6F9C4A80801C0c5D19eF9A19dCba8B292;
        amounts[79] = 58155795767046187207594;

        users[80] = 0x939F5461Fa70e75188F3A3a822e006b8262804Cd;
        amounts[80] = 72832660882598249592933;

        users[81] = 0xF394af536B7678820Ba31Afe6364d6C8A6bE9545;
        amounts[81] = 43911120279992676928527;

        users[82] = 0x01E61B68208491979E4EAd60eB55E39118e719a5;
        amounts[82] = 8279361410745311237121;

        users[83] = 0x5adfA2D32064722Bee64eDbc34be95c8a06D7159;
        amounts[83] = 61611648286252821402942;

        users[84] = 0x998463dd08CA19b52463dB5F56B91A66dC7e7A3e;
        amounts[84] = 50457558773926485049573;

        users[85] = 0x8135e447826548562ef8D09f05c5e6FD4C3ad284;
        amounts[85] = 58956851118777860522557;

        users[86] = 0xCbdFD469f56a82fa251c483feF7966350aF62174;
        amounts[86] = 51356040743671260934492;

        users[87] = 0x7BF427CD1C3ff0D22927aFaf20BcC7f120E5960e;
        amounts[87] = 16120960260208773087852;

        users[88] = 0x9E2d910b9160B920eC64112Bc41B1CDaD50490BB;
        amounts[88] = 24272443007056162198315;

        users[89] = 0x5FC45AA8aeB8b6a09ab49D2C49212D542107E5Fb;
        amounts[89] = 58007970394949209921793;

        users[90] = 0x4C1fbc38201c108D20d85054343A8d6282b7B392;
        amounts[90] = 9973557677389923862230;

        users[91] = 0x5cF4dEc7e51C3C2443b7c02246b3370Bdb3759C8;
        amounts[91] = 4460972564870040349138;

        users[92] = 0x4AD8bF06B7a860776FfE23D279F4381000798b64;
        amounts[92] = 52529586711812327590044;

        users[93] = 0x0477485FCbA44dA5253E9631Ac2C120CfEb8460E;
        amounts[93] = 52036855781071905983802;

        users[94] = 0x82d782E6b5CbBb32F5b9EDde3DAaaEA11143e6Eb;
        amounts[94] = 17480412088309768165699;

        users[95] = 0xd1045d10DcAf31b16470666d9739B1dB4C056b27;
        amounts[95] = 43002798217464009646049;

        users[96] = 0x205632c928BDAb1dBB7A74a2783cf0b7412607f2;
        amounts[96] = 17243250655710679577878;

        users[97] = 0x100d38681cB1bD9E1E768aA6b951D51cE12667b7;
        amounts[97] = 38804514502212181676358;

        users[98] = 0xE42C37F8f382fe2F2E042B518c5e72d3247100E8;
        amounts[98] = 31369952521960532537219;

        users[99] = 0x52337358dC01d2eD08885C69E0b05CE4CC9c256a;
        amounts[99] = 46023120961077146605716;

        users[100] = 0xF13b8F825A76AF807f52a41b70ac3278e9EC9CE8;
        amounts[100] = 21720951083568980259255;

        users[101] = 0xD30D927Ecf31F8e0e5C0ae7933cf5b55E54394fB;
        amounts[101] = 15291680997516459382180;

        users[102] = 0x975cD152BB29EC6cB6DF57FAcA525f76A219D433;
        amounts[102] = 10237285742555195836140;

        users[103] = 0x4814De70f14f253A5069267f82B56464FBCe6Ea0;
        amounts[103] = 14347039027339437283333;

        users[104] = 0x94Fd9511a02e291887A6B922b57B220C6D86C237;
        amounts[104] = 16934410760023709936359;

        users[105] = 0x158203957867c01731aD8cb003e6884CF5749c90;
        amounts[105] = 16437394368917396076200;

        users[106] = 0x62046cb6e43A9E9bd079378D4670c025a75Ad725;
        amounts[106] = 46309873386278496658536;

        users[107] = 0xd28a9F57821abc39129B29923009E579A136157B;
        amounts[107] = 942999771744443941514;

        users[108] = 0xbEB275f15B19673f6Ca080568F77e329125Ca869;
        amounts[108] = 942279578924704596525;

        users[109] = 0x91cbe063DB9c76987719193a308f63a3e76691E9;
        amounts[109] = 33172558955604038699219;

        users[110] = 0x98806D4D599Df20f825E176B6809A81Fe552168d;
        amounts[110] = 22117791871284619252931;

        users[111] = 0x3FFbcbD7DbC4a72CA7eF24c2c1422E8F0cE9BE86;
        amounts[111] = 3400616682163127767408;

        users[112] = 0x76D6D73c36767bA489C3E5D66B0E69a265D5C080;
        amounts[112] = 27098732263750751646309;

        users[113] = 0x81885c4d14a52B3f934011156306fbFf3a464912;
        amounts[113] = 4288069049088513824785;

        users[114] = 0xf36f194f5df2E0Daa3bB23b20f4687EddD75fbFe;
        amounts[114] = 53679890801224786037975;

        users[115] = 0xEafa867382262825A6eA72F8524FeDd64312d2B1;
        amounts[115] = 25681833788021038599745;

        users[116] = 0x50DE595f94813d063bd3CA9ef8331a3C1D59B2ed;
        amounts[116] = 27333625005964024640405;

        users[117] = 0x3b3E116b397fC750d1B316112C6C65DfE2592269;
        amounts[117] = 15520289888024917129802;

        users[118] = 0x5Da777AfD9D29b21A3f389Ba32c77aFC08e54EdE;
        amounts[118] = 14452409617386841156520;

        users[119] = 0x39B7eC229deCc1805b8A313F2f49aC53bFffF637;
        amounts[119] = 11695818835738276867951;

        users[120] = 0xb1Bd5F9984Ba5177Fbf3116702C7522220978d41;
        amounts[120] = 9043349063744255017969;

        users[121] = 0x2f4eBF82d5A464a3a065c79348827DD055978d4C;
        amounts[121] = 34702763640957942550729;

        users[122] = 0x00149443a521C62AF61CDC19c1BaAd8e6c9Ba10c;
        amounts[122] = 12102276995656827610765;

        users[123] = 0x9eb7098Ec46E9BdFfA37aa98b754A8853C70639A;
        amounts[123] = 47661660883115640542508;

        users[124] = 0x135e8fa216064928245392af8a9E7adF33400834;
        amounts[124] = 32308441585463248535701;

        users[125] = 0x9cF27d6826471A39A988263ad138138198a4dC8E;
        amounts[125] = 25344161208911876027684;

        users[126] = 0x2B3F52CfF90070443c2C7Befa3aE7AC55A78a712;
        amounts[126] = 15842801061330172503903;

        users[127] = 0x50aC1281508ea3882C6E7ad9A66Df95E91cDF135;
        amounts[127] = 62662895081915697295508;

        users[128] = 0x38de71beD9455Fa91B2428F135443caEd7A38762;
        amounts[128] = 41308960143473445923683;

        users[129] = 0xf496912b76D0214e767Edcf2EfF9c3eaaEaDAe41;
        amounts[129] = 1734847281934761090767;

        users[130] = 0x7Ff14421950Ee600f80158947F11a7419Fa2485e;
        amounts[130] = 24128669793706391044851;

        users[131] = 0xD206FacF7aA9752c87049a3e8dCB674c42399A66;
        amounts[131] = 2748377676668046778507;

        users[132] = 0x183338c0683fb9bd0A48DaB1d1De3795578d8D45;
        amounts[132] = 13849894932808375124250;

        users[133] = 0x8b984BCe8d85D8e2EA2050d3bD26B4d2C493a3cF;
        amounts[133] = 9114137876410036910513;

        users[134] = 0x5f4a4005100A4fB2c4d255583b73Ac818BA630d0;
        amounts[134] = 21536755968111580924967;

        users[135] = 0xF0aa0851f77BF98D825E03a16Ff828d66cFf17fb;
        amounts[135] = 24715162528629065763359;

        users[136] = 0x784551029170D6AB61272e277C1179e05BC74E55;
        amounts[136] = 220714595031921149608269;

        users[137] = 0x8347ED06276865dA6d8D91307780821E4ECc2835;
        amounts[137] = 44239496657424102382702;

        users[138] = 0x9ad914beAe536524c052dE8A46Eb7412E902339f;
        amounts[138] = 38598413322044949521159;

        users[139] = 0x47bd4953D56B22503A39C034226d756BD8a6458B;
        amounts[139] = 66339870720365289116849;

        users[140] = 0x565d7f88353fE7A1C9Dcd7e07d3544CE9a263ED8;
        amounts[140] = 649100852779262971693;

        users[141] = 0x30094FDAc434CcDDb48118acbE7a844d15e33b1c;
        amounts[141] = 8600387634407775372306;

        users[142] = 0x4c35c9D6Dc3fA31D0bA2a788E17DFBd6AE32B67E;
        amounts[142] = 87859100718550904524152;

        users[143] = 0xF733fc639407b1e90013cB001CF930264e539d39;
        amounts[143] = 984451741097646350451373;

        users[144] = 0x512A0D53800F3FF441925965BcaAbB25ebf0eAbD;
        amounts[144] = 49725153008947046323024;

        users[145] = 0x560A9db4D8cEFc9272f71838A8eC8024BC98532f;
        amounts[145] = 11005707623614694908056;

        users[146] = 0x70B4ecfB9B7d167F258e0B7Df6203be8360B2071;
        amounts[146] = 72204263099252687227927;

        users[147] = 0x68e9faD9082879c18d7F212A049f2b18a2fCbd39;
        amounts[147] = 7759436738105365206977;

        users[148] = 0x6b0E1B5A24AA58C1e540B62644af8b8A13977823;
        amounts[148] = 523047577239612972998565;

        users[149] = 0x77122a6d7705927099109BEe1248d29EDfBB3527;
        amounts[149] = 9388356240474057713716;

        users[150] = 0x01a5e11B6A076d62a3811C1BdCbad083817E4643;
        amounts[150] = 690337317539506197595;

        users[151] = 0x2AC3a2de2382b6Cc369D3D04Cf86D59DA0a8B4e0;
        amounts[151] = 45823003590011233323175;

        users[152] = 0x7457FfD4e9F471262e98150C6a27a1449D56f4D0;
        amounts[152] = 61112705026913434183202;

        users[153] = 0xB906a64D4a5e184519982434c7e19781C79d4BcA;
        amounts[153] = 15023526374060539272673;

        users[154] = 0x1D668CDA70434Be18c60323487676f41CF28A407;
        amounts[154] = 14243485029272824836476;

        users[155] = 0x1cE3Df7CCFcf33888353E42b9Dfc2f96d0da364a;
        amounts[155] = 15174681693670514202780;

        users[156] = 0x59D2105A080e9BD118CBB2e529bdD594F37A3Acc;
        amounts[156] = 18452917604589860625893;

        users[157] = 0xE1D0d1f41F52371f0f276C44aD543A6Bae1cA8DD;
        amounts[157] = 402739094930179678120283;

        users[158] = 0xFa288681a9D0dE284c92f4b2A2D2c81eEEC7C6be;
        amounts[158] = 30704267022238127514377;

        users[159] = 0xee519665682f6fa8E0C5ace9C4E276B3d2822830;
        amounts[159] = 12544949630089722329070;

        users[160] = 0x06B28651c12e9Fd3368AA8c81387E81812475c9e;
        amounts[160] = 33272497813090966674132;

        users[161] = 0x456Aef982C5Ef58e6Ea5FBd77f46f91BfcA1Eb48;
        amounts[161] = 23645632617421100027703;

        users[162] = 0x50d4fCC8C5b755e9Faf330cAdb901D85A5E60Bf0;
        amounts[162] = 138793466325371207597185;

        users[163] = 0x37De61085a5A5e1A86AAb35fB75DfB6D6A59ADe0;
        amounts[163] = 29272277598810109878548;

        users[164] = 0x134FF57a06d73f6f5DA0e8fc7cA111D0bc9Ef087;
        amounts[164] = 5322505110375974578003;

        users[165] = 0x8b41f8744Ca2c6429f611F0a19B54edA4Ed50A07;
        amounts[165] = 5275203797642607327513;

        users[166] = 0x7279F1c59aA089DCa11Faa0A86C75f7d8529d172;
        amounts[166] = 5808910429424768942085;

        return (users, amounts);
    }
}
