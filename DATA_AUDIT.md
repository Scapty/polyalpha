# DATA_AUDIT.md — Raw Polymarket API Responses for Polybotalpha

## Positions API
### Response shape: array
### Total positions: 10
### First 3 positions (raw):
```json
[
  {
    "proxyWallet": "0x492442eab586f242b53bda933fd5de859c8a3782",
    "asset": "92073308864569362402131420269439121198880397409602860524558961937131100696150",
    "conditionId": "0x785a259108b6ad7e3b9c017abc6a93346cc382bc28af5ca827675a759dd2b7f8",
    "size": 461505.67,
    "avgPrice": 0.518665,
    "initialValue": 239366.83833055,
    "currentValue": 461505.67,
    "cashPnl": 222138.83166944998,
    "percentPnl": 92.80267610114427,
    "totalBought": 461505.67,
    "realizedPnl": 0,
    "percentRealizedPnl": 92.80267610114427,
    "curPrice": 1,
    "redeemable": true,
    "mergeable": false,
    "title": "Jazz vs. Suns: O/U 233.5",
    "slug": "nba-uta-phx-2026-03-28-total-233pt5",
    "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/super+cool+basketball+in+red+and+blue+wow.png",
    "eventId": "296573",
    "eventSlug": "nba-uta-phx-2026-03-28",
    "outcome": "Over",
    "outcomeIndex": 0,
    "oppositeOutcome": "Under",
    "oppositeAsset": "100098537923043704481084746569804130346222057861167914987339392370018629064004",
    "endDate": "2026-03-29",
    "negativeRisk": false
  },
  {
    "proxyWallet": "0x492442eab586f242b53bda933fd5de859c8a3782",
    "asset": "60200335366583529750107915773663861788137817376410291993258126224740571960537",
    "conditionId": "0x982b435c47eb55bec825ad62d79156a0d07e34e4700a89f374b579fd6d516632",
    "size": 457480.1,
    "avgPrice": 0.461992,
    "initialValue": 211352.1463592,
    "currentValue": 457480.1,
    "cashPnl": 246127.9536408,
    "percentPnl": 116.45396457081507,
    "totalBought": 457480.1,
    "realizedPnl": 0,
    "percentRealizedPnl": 116.45396457081507,
    "curPrice": 1,
    "redeemable": true,
    "mergeable": false,
    "title": "Capitals vs. Golden Knights: O/U 6.5",
    "slug": "nhl-wsh-las-2026-03-28-total-6pt5",
    "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/nhl.png",
    "eventId": "239518",
    "eventSlug": "nhl-wsh-las-2026-03-28",
    "outcome": "Over",
    "outcomeIndex": 0,
    "oppositeOutcome": "Under",
    "oppositeAsset": "62775010399467696204796960448044560306792892582729274810924761613250923220906",
    "endDate": "2026-03-29",
    "negativeRisk": false
  },
  {
    "proxyWallet": "0x492442eab586f242b53bda933fd5de859c8a3782",
    "asset": "14604356390830785819727448777986646870056683868868701432580394323193003246217",
    "conditionId": "0xbc27409ae29f2a617bdabdc30b1add320db3f0eb68aeb241dd32ca10c1daafcd",
    "size": 61196.26,
    "avgPrice": 0.529967,
    "initialValue": 32431.99832342,
    "currentValue": 61196.26,
    "cashPnl": 28764.26167658,
    "percentPnl": 88.69099396754893,
    "totalBought": 61196.26,
    "realizedPnl": 0,
    "percentRealizedPnl": 88.69099396754893,
    "curPrice": 1,
    "redeemable": true,
    "mergeable": false,
    "title": "Jazz vs. Suns: O/U 232.5",
    "slug": "nba-uta-phx-2026-03-28-total-232pt5",
    "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/super+cool+basketball+in+red+and+blue+wow.png",
    "eventId": "296573",
    "eventSlug": "nba-uta-phx-2026-03-28",
    "outcome": "Over",
    "outcomeIndex": 0,
    "oppositeOutcome": "Under",
    "oppositeAsset": "103167441381972243767063060675948920537024097977243648663001392834813145583422",
    "endDate": "2026-03-29",
    "negativeRisk": false
  }
]
```

### All field names in positions:
[
  "asset",
  "avgPrice",
  "cashPnl",
  "conditionId",
  "curPrice",
  "currentValue",
  "endDate",
  "eventId",
  "eventSlug",
  "icon",
  "initialValue",
  "mergeable",
  "negativeRisk",
  "oppositeAsset",
  "oppositeOutcome",
  "outcome",
  "outcomeIndex",
  "percentPnl",
  "percentRealizedPnl",
  "proxyWallet",
  "realizedPnl",
  "redeemable",
  "size",
  "slug",
  "title",
  "totalBought"
]

## Activity API
### Response shape: array
### Total activity items: 100
### First 3 activity items (raw):
```json
[
  {
    "proxyWallet": "0x492442eab586f242b53bda933fd5de859c8a3782",
    "timestamp": 1774762270,
    "conditionId": "0x9cd88a5f04d66aa5d468b1db0b5d9b446b86c0e8ce4e10340433b63dc091a295",
    "type": "REDEEM",
    "size": 30971.87,
    "usdcSize": 30971.87,
    "transactionHash": "0xbaa59e5363269e09815c4038c1dba671c8c811c18e83603ff4cd8a57c1a66e3c",
    "price": 0,
    "asset": "",
    "side": "",
    "outcomeIndex": 999,
    "title": "Spread: Spurs (-18.5)",
    "slug": "nba-sas-mil-2026-03-28-spread-away-18pt5",
    "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/super+cool+basketball+in+red+and+blue+wow.png",
    "eventSlug": "nba-sas-mil-2026-03-28",
    "outcome": "",
    "name": "0x492442EaB586F242B53bDa933fD5dE859c8A3782-1766317541188",
    "pseudonym": "Multicolored-Self",
    "bio": "",
    "profileImage": "",
    "profileImageOptimized": ""
  },
  {
    "proxyWallet": "0x492442eab586f242b53bda933fd5de859c8a3782",
    "timestamp": 1774762270,
    "conditionId": "0xd3e666cb65e62eb67b91c7b3f2f0b41a4bcb697e73f1ea0dab9e7ad89ad08a15",
    "type": "REDEEM",
    "size": 443020.944803,
    "usdcSize": 443020.944803,
    "transactionHash": "0xbaa59e5363269e09815c4038c1dba671c8c811c18e83603ff4cd8a57c1a66e3c",
    "price": 0,
    "asset": "",
    "side": "",
    "outcomeIndex": 999,
    "title": "Wild vs. Bruins: O/U 6.5",
    "slug": "nhl-min-bos-2026-03-28-total-6pt5",
    "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/nhl.png",
    "eventSlug": "nhl-min-bos-2026-03-28",
    "outcome": "",
    "name": "0x492442EaB586F242B53bDa933fD5dE859c8A3782-1766317541188",
    "pseudonym": "Multicolored-Self",
    "bio": "",
    "profileImage": "",
    "profileImageOptimized": ""
  },
  {
    "proxyWallet": "0x492442eab586f242b53bda933fd5de859c8a3782",
    "timestamp": 1774762270,
    "conditionId": "0x17dafc4d9c1128c17f936e35f6772d02c0eb2f637b883b95f8dc891740d2d6cc",
    "type": "REDEEM",
    "size": 526517.616625,
    "usdcSize": 526517.616625,
    "transactionHash": "0xbaa59e5363269e09815c4038c1dba671c8c811c18e83603ff4cd8a57c1a66e3c",
    "price": 0,
    "asset": "",
    "side": "",
    "outcomeIndex": 999,
    "title": "Pistons vs. Timberwolves",
    "slug": "nba-det-min-2026-03-28",
    "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/super+cool+basketball+in+red+and+blue+wow.png",
    "eventSlug": "nba-det-min-2026-03-28",
    "outcome": "",
    "name": "0x492442EaB586F242B53bDa933fD5dE859c8A3782-1766317541188",
    "pseudonym": "Multicolored-Self",
    "bio": "",
    "profileImage": "",
    "profileImageOptimized": ""
  }
]
```

### All field names in activity:
[
  "asset",
  "bio",
  "conditionId",
  "eventSlug",
  "icon",
  "name",
  "outcome",
  "outcomeIndex",
  "price",
  "profileImage",
  "profileImageOptimized",
  "proxyWallet",
  "pseudonym",
  "side",
  "size",
  "slug",
  "timestamp",
  "title",
  "transactionHash",
  "type",
  "usdcSize"
]

## Sample titles for category audit
### First 20 position titles:
1. title="Jazz vs. Suns: O/U 233.5" slug="nba-uta-phx-2026-03-28-total-233pt5"
2. title="Capitals vs. Golden Knights: O/U 6.5" slug="nhl-wsh-las-2026-03-28-total-6pt5"
3. title="Jazz vs. Suns: O/U 232.5" slug="nba-uta-phx-2026-03-28-total-232pt5"
4. title="Spread: Hawks (-14.5)" slug="nba-sac-atl-2026-03-28-spread-home-14pt5"
5. title="Utah vs. Kings: O/U 5.5" slug="nhl-utah-lak-2026-03-28-total-5pt5"
6. title="Senators vs. Lightning: O/U 5.5" slug="nhl-ott-tb-2026-03-28-total-5pt5"
7. title="Spread: Hawks (-13.5)" slug="nba-sac-atl-2026-03-28-spread-home-13pt5"
8. title="Spurs vs. Bucks: O/U 227.5" slug="nba-sas-mil-2026-03-28-total-227pt5"
9. title="Spurs vs. Bucks: O/U 225.5" slug="nba-sas-mil-2026-03-28-total-225pt5"
10. title="Spurs vs. Bucks: O/U 226.5" slug="nba-sas-mil-2026-03-28-total-226pt5"