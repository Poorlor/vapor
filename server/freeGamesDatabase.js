// Free "No Cost" packages reported as +1 for Game Collector:
// https://steamcommunity.com/discussions/forum/30/682986591933763369/
// https://steamcommunity.com/sharedfiles/filedetails/?id=2950176844
// Screenshot list: https://pastein.ru/t/2BZ
// Store package IDs and zero-price eligibility are rechecked before every claim.
const FREE_GAMES_DATABASE = [
  { appid: 272060, subid: 36561, name: 'Serena', type: 'Game' },
  { appid: 397720, subid: 88162, name: 'Romance of the Three Kingdoms Maker', type: 'Game' },
  { appid: 8650, subid: 13261, name: 'RACE 07: Andy Priaulx Crowne Plaza Raceway', type: 'DLC', requiresAppid: 8600 },
  { appid: 346290, subid: 59373, name: 'Penumbra: Necrologue', type: 'Mod', requiresAppid: 57300 },
  { appid: 1515950, subid: 534367, name: 'Capcom Arcade Stadium', type: 'Game' },
  { appid: 351940, subid: 153186, name: 'The Descendant (Episode 1)', type: 'Game' },
  { appid: 319830, subid: 232574, name: 'AX:EL - Air XenoDawn', type: 'Game' },
  { appid: 608990, subid: 222994, name: 'The Archotek Project (Demo)', type: 'Game' },
  { appid: 769920, subid: 290964, name: 'Odysseus Kosmos and his Robot Quest: Episode 1', type: 'Game' },
  { appid: 260410, subid: 33333, name: 'Get Off My Lawn!', type: 'Game' },
  { appid: 312150, subid: 50430, name: 'Wild Warfare', type: 'Game' },
  { appid: 339120, subid: 56656, name: "Fork Parker's Holiday Profit Hike", type: 'Game' },
  { appid: 302380, subid: 45705, name: 'Floating Point', type: 'Game' },
  { appid: 845070, subid: 264193, name: 'The Awesome Adventures of Captain Spirit', type: 'Game' },
  { appid: 232770, subid: 420511, name: 'POSTAL', type: 'Game' },
  { appid: 270170, subid: 35848, name: 'Depression Quest', type: 'Game' },
  { appid: 420540, subid: 85604, name: 'RTK Maker - Face CG “RTK13” Set', type: 'DLC', requiresAppid: 397720 },
  { appid: 534110, subid: 129484, name: 'Agent Origins', type: 'Series' },
  { appid: 298180, subid: 66435, name: 'The Desolate Hope', type: 'Game' },
  { appid: 583950, subid: 555176, name: 'Artifact Classic', type: 'Game' },
  { appid: 1269260, subid: 555169, name: 'Artifact Foundry', type: 'Game' },
  // Additional candidates: Steam guide above; TSW 7 +1: https://www.reddit.com/r/FreeGamesOnSteam/comments/1whb3mt/
  { appid: 532210, subid: 496891, name: 'Life is Strange 2 (Episode 1)', type: 'Game' },
  { appid: 1755910, subid: 629728, name: 'Capcom Arcade 2nd Stadium', type: 'Game' },
  { appid: 267130, subid: 35063, name: 'Star Swarm Stress Test', type: 'Game' },
  { appid: 4678800, subid: 1768268, name: 'Train Sim World 7: Free Starter Edition', type: 'Game' },
];

module.exports = { FREE_GAMES_DATABASE };
