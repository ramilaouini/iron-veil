// Lore, dialogue chronicles, guides and villain narrative for IRON VEIL: STORY ODYSSEY.
// Every fighter has their own narrative journey, personalized guide interactions, and unique ending.

export const HERO_LORE = {
  kael: {
    title: 'The Iron Exile',
    trait: 'Iron Will (+15% Guard Durability & +10% Counter Damage)',
    prologue: 'Kael was once the High Vanguard Commander of the Outer Bastion. When the Veil Sovereign consumed his garrison to fuel the Blood Circuit, Kael refused the cybernetic leash. Armed with his kinetic greatsword and the broken crest of his legion, he returns to tear down the Obsidian Spire.',
    motive: 'Avenge the fallen vanguard and smash the Sovereign\'s soul-harvesting core.',
    victoryEpilogue: 'With the Obsidian Throne shattered into lifeless slag, Kael knelt among the ashes of his fallen brothers. The Veil current receded, returning peace to the ruins. He planted his greatsword in the center of Sector Zero—not as a weapon, but as a monument for those who never gave up.',
  },
  nyra: {
    title: 'The Shadow Lotus',
    trait: 'Phantom Step (+20% Dash Distance & Evasive Invulnerability)',
    prologue: 'Raised inside the Sunken Conduits, Nyra was trained as the Sovereign\'s personal phantom assassin. But when she discovered her memories were synthetic constructs rewritten after every mission, she severed her neural tether. Now she strikes from the dark to assassinate her maker.',
    motive: 'Recover her true memories and dismantle the neural network enslaving the city.',
    victoryEpilogue: 'The master terminal dissolved into sparks. As the synthetic memories faded, Nyra felt the cold rain on her skin—real rain, untouched by the Veil\'s simulation. She dissolved into the night, free at last to write her own future across the neon horizon.',
  },
  bram: {
    title: 'The Colossal Smith',
    trait: 'Forge Armor (Resists Light Hitstun & +20% Throw Damage)',
    prologue: 'Bram built the colossal hydraulic pistons and geothermal reactors that sustain the city. When the Sovereign weaponized his life\'s work into a furnace of suffering, Bram forged his iron gauntlets and swore to demolish every brick he ever laid with his own bare hands.',
    motive: 'Overload the magma reactors and purge the Sovereign\'s war-furnace.',
    victoryEpilogue: 'The reactor roared its final note as Bram vented the magma conduits into the frozen sea. Steam engulfed the skyline. Wiping grease from his brow, the titan smiled. For the first time in sixty years, the machines had stopped screaming.',
  },
  sora: {
    title: 'The Storm Wanderer',
    trait: 'Thunderstrike (+15% Meter Generation & Electrified Specials)',
    prologue: 'A wandering cyber-ronin from the high mountain arrays, Sora seeks the mythical Prime Core—an ancient power source said to restore natural storms to a world trapped in artificial drought. Standing in his way is the Sovereign\'s iron veil.',
    motive: 'Reclaim the celestial energy grid and bring rain back to the dying earth.',
    victoryEpilogue: 'Sheathing his ionized katana as the Sovereign crumbled, Sora looked to the sky. Clouds broke open above the Spire. A cool, natural rain began to fall upon the city below. The wandering blade walked toward the dawn, his oath fulfilled.',
  },
  vex: {
    title: 'The Crimson Outcast',
    trait: 'Blood Frenzy (+25% Attack Speed & Life Steal below 30% HP)',
    prologue: 'A defected prototype soldier spliced with volatile crimson veil nanites, Vex was deemed unstable and scheduled for incineration. He broke through his containment chamber, slaughtered his handlers, and now seeks total destruction of the machine that made him a monster.',
    motive: 'Burn down the entire Blood Circuit and find peace in the flames.',
    victoryEpilogue: 'The crimson aura around Vex slowly flickered out. The nanites went dormant as the central beacon went dark. Looking down at his hands, he saw the synthetic red hue fade into calm bronze. The monster was gone. Only a survivor remained.',
  },
  sera: {
    title: 'The Solar Vanguard',
    trait: 'Solar Radiance (+15% Ultimate Damage & Auto-regenerating Meter)',
    prologue: 'A holy warrior of the Solar Sanctum, Sera wields the light of ancient fusion crystals. She views the Veil not as power, but as a parasite corrupting the human soul. She has descended from the upper orbital platforms to purge the darkness once and for all.',
    motive: 'Cleanse the corrupted circuit and ignite the eternal dawn.',
    victoryEpilogue: 'Light burst through the ruptured dome of the Obsidian Spire, blinding and warm. Sera raised her radiant blade high as the artificial night broke apart into shards of gold. The Blood Circuit was no more; the age of the Solar Dawn had arrived.',
  },
};

export const GUIDES = {
  orin: {
    name: 'Orin the Tech-Monk',
    title: 'Keeper of the Old Circuits',
    portrait: 'monk',
    quotes: [
      'Walk carefully, traveler. The Veil flows strongest through those who carry anger in their heart.',
      'Ahead lies an energy gate. The machines will not open it until their enforcers are dismantled.',
      'Remember: a timed parry turns their own force into ruin. Listen for the hum of their strike.',
      'I have unlocked a conduit here. Rest for a moment; let your nanites mend your wounds.',
      'The Sovereign believes all flesh is merely copper waiting to be burned. Prove him wrong.',
    ],
  },
  ciela: {
    name: 'Ciela the Scout',
    title: 'Rebel Recon Vanguard',
    portrait: 'scout',
    quotes: [
      'You found me! I thought I was scrap metal for sure. Here—take this power battery!',
      'Watch out for the drones above! They track your jump arcs with infrared lasers.',
      'The mini-boss in the next sector charges heavy shockwaves. Jump over them when he winds up!',
      'I managed to hack their supply cache. Grab these Veil Shards and upgrade your core!',
    ],
  },
};

export const SECTOR_LORE = [
  {
    id: 1,
    name: 'The Neon Outskirts',
    sub: 'Sector Zero: The Forgotten Perimeter',
    theme: 'Ruined cyberpunk alleyways, neon scaffolding, floating cargo girders, rain and rust.',
    bossName: 'Vex the Crimson Outcast',
    bossTitle: 'Prototype 00 - The Crimson Scythe',
    miniBossName: 'Vanguard Unit RX-9',
    intro: [
      ['orin', 'Welcome to the Outskirts, warrior. This is where the discarded remnants of the Circuit rot.'],
      ['orin', 'The Sovereign has placed Vanguard Unit RX-9 at the central bridge to prevent escape.'],
      ['hero', 'I am not looking to escape. I am heading inside.'],
      ['orin', 'Then break their perimeter. Watch for the floating crates—they hold Veil Shards to empower your frame.'],
    ],
    preBoss: [
      ['boss', 'You made it through my hunting grounds. Did you really think you were the only one who broke the leash?'],
      ['hero', 'You broke your leash only to become his guard dog, Vex.'],
      ['boss', 'Guard dog? No... I\'m the executioner! Let us see whose blood burns hotter!'],
    ],
    postBoss: [
      ['boss', 'Heh... your strikes have weight... The Aqueducts... Nyra is waiting down there... don\'t drown...'],
      ['hero', 'Rest now, Vex. Your circuit is broken.'],
      ['orin', 'Sector Zero is cleared. The path to the Sunken Aqueducts is open.'],
    ],
  },
  {
    id: 2,
    name: 'The Sunken Aqueducts',
    sub: 'Sector Sub-B: The Drowned Conduits',
    theme: 'Submerged subway tunnels, waterfalls, electrified acid pools, green neon algae.',
    bossName: 'Nyra the Shadow Lotus',
    bossTitle: 'High Phantom of the Deep Network',
    miniBossName: 'Phantom Stalker Ren',
    intro: [
      ['orin', 'The aqueducts once cooled the city\'s fusion hearts. Now they drown those who question the Sovereign.'],
      ['orin', 'Acidic water fills the chasms below. Step carefully across the moving pipes and jump pads.'],
      ['hero', 'I sense eyes in the mist.'],
      ['orin', 'Nyra\'s phantom ninjas patrol these shadows. Seek out our captured scouts—they know the layout.'],
    ],
    preBoss: [
      ['boss', 'You step into the dark as if you own it. You cannot strike what you cannot see.'],
      ['hero', 'Your blades are fast, Nyra, but your heart hesitates. You know the Sovereign is harvesting your people.'],
      ['boss', 'Knowledge is a burden. In the silence of the lotus, there is only the kill!'],
    ],
    postBoss: [
      ['boss', 'You saw through my mirage... perhaps... perhaps there really is another way...'],
      ['hero', 'Take your scouts and flee to the surface. I am going into the Foundry.'],
      ['orin', 'She was the Sovereign\'s sharpest blade. Without her, his eastern network collapses.'],
    ],
  },
  {
    id: 3,
    name: 'The Magma Foundry',
    sub: 'Sector Core: The Heart of Steel',
    theme: 'Scorching blast furnaces, rivers of molten ore, industrial crushers, steam jets.',
    bossName: 'Bram the Forge Titan',
    bossTitle: 'Chief Architect of the Circuit',
    miniBossName: 'Molten Juggernaut',
    intro: [
      ['orin', 'Feel the heat? We have reached the Core Foundry. This is where armor and cages alike are forged.'],
      ['orin', 'The Molten Juggernaut guards the smelting platform. Beware of flame vents and moving conveyor beams.'],
      ['hero', 'Bram\'s colossal forge... it must be shut down before he crafts another legion.'],
      ['orin', 'Destroy the coolant valves along your path to weaken the furnace barrier.'],
    ],
    preBoss: [
      ['boss', 'You made it to the anvil! Every bolt in this city bends to my hammer!'],
      ['hero', 'You built a prison and called it an empire, Bram.'],
      ['boss', 'Then come and break it! Let us see if your flesh can dent pure hardened steel!'],
    ],
    postBoss: [
      ['boss', '*pant*... Ha! That hit... almost knocked the gears right out of me... Good strike, kid.'],
      ['hero', 'The forge is quiet now, old man.'],
      ['boss', 'Go on up to the Spire. Tear the bastard\'s throne down for me.'],
    ],
  },
  {
    id: 4,
    name: 'The Obsidian Spire',
    sub: 'Apex Sector: The Throne of Ascension',
    theme: 'Anti-gravity crystalline citadel above the clouds, aurora skies, void anomalies, golden pillars.',
    bossName: 'Veil Sovereign Malakor',
    bossTitle: 'God of the Blood Circuit',
    miniBossName: 'Chrono Sentinel',
    intro: [
      ['orin', 'We have ascended beyond the clouds. Look below—the entire continent is trapped in the Veil\'s lattice.'],
      ['orin', 'The Chrono Sentinel and elite gatekeepers guard the ascent. Anti-gravity lifts will carry you up.'],
      ['hero', 'This ends today, Orin. No more tributes. No more sacrifices.'],
      ['orin', 'All of our hopes ride with your blade. Walk into the throne room and claim our freedom.'],
    ],
    preBoss: [
      ['boss', 'You climb over broken steel and dead champions only to arrive at your maker\'s feet.'],
      ['hero', 'You are no god, Malakor. You are a parasite sucking the marrow of a dying world.'],
      ['boss', 'I am the Circuit! I am the blood of progress! Without me, you are only dust. PERISH!'],
    ],
    postBoss: [
      ['boss', 'Impossible... the Veil... my empire... how can a mortal spark extinguish a star...?!'],
      ['hero', 'Because steel and circuitry can never replace the human spirit.'],
      ['orin', 'The Spire is falling! The Circuit is dead! The dawn... look at the dawn!'],
    ],
  },
];
