/**
 * gamedata.js
 * -----------------------------------------------------------------------
 * Default game-system data seeded from "DM_info.pdf" (the Quevela ruleset).
 * This is the DM's starting library: spells, items, sword styles, world
 * lore, races, and enemies. The DM can extend/override any of this from
 * the DM Tools panel — see db.addCustomSkill() in db.js.
 *
 * Everything here is plain data (no logic) so it can be swapped for a
 * real API response (`GET /api/gamedata`) without touching the UI code.
 * -----------------------------------------------------------------------
 */

const GameData = {

  /* ---------------------------------------------------------------- *
   * The seven core attributes players spend points on.
   * ---------------------------------------------------------------- */
  attributes: ["Damage", "Speed", "Stealth", "Vitality", "Magic", "Knowledge", "Fortitude"],
  attributeCap: 10, // hard cap per attribute

  /* ---------------------------------------------------------------- *
   * Magic: four elements, each with tiers. Sub Category spells require
   * talent in two or more elements and are flagged `subCategory: true`.
   * ---------------------------------------------------------------- */
  magic: {
    fire: {
      label: "Fire",
      summary: "By releasing and controlling concentrated energy into your surroundings, you can spark fires and control fire in your environment.",
      tiers: {
        beginner: [
          { name: "Fireball", desc: "Focus a surge of heat into one point, igniting the gases and launching them at the enemy." },
          { name: "Heat Flash", desc: "Using the light energy from heat, blind the enemy momentarily by exaggerating the light in a small fire." },
          { name: "Hot Hands", desc: "Infuse your hands with fire, allowing you to burn anybody you touch." },
          { name: "Smoke Bomb", desc: "Combine simple Fire and Water magic to create a cloud of steam/smoke to avoid an enemy.", subCategory: true },
        ],
        intermediate: [
          { name: "Fire Wave", desc: "Use the heat of your body to form a large wall of fire, then push it at the enemy dealing AOE damage." },
          { name: "Explosion", desc: "Create fire, expand it, and release its energy quickly causing a massive explosion — not much accuracy or control." },
          { name: "Blue Blast", desc: "Create a flame so hot it becomes blue, fired directly at the enemy, scorching them." },
        ],
        advanced: [
          { name: "Fire Ring", desc: "Cast controlled fire around enemies to create a ring of fire, effectively trapping them." },
          { name: "Flame Enchant", desc: "Use your control of fire to coat your (or someone else's) weapon in fire." },
          { name: "Pyromancy", desc: "Become immune to fire by surrounding yourself with a more powerful flame that wards off any other fire, slowly consuming mana." },
        ],
        unique: [
          { name: "Fire Enhance", desc: "Enhance the heat of an already lit flame. A weak user only gets utility use; a skilled user can enhance a spell's power." },
          { name: "Portable Stove", desc: "Utilizing both earth and fire magic, create an earthen pan and heat its bottom to cook food or clean water." },
          { name: "Flare Gun", desc: "Create a weak but massive shot of fire and shoot it into the air to call allies over — may also call unwanted enemies." },
          { name: "Fire Brand", desc: "Use fire to brand a symbol or word onto someone or yourself. Cannot be removed." },
          { name: "Permanent Fire", desc: "Create a flame that cannot go out even without fuel, draining your mana as its power source." },
          { name: "Fireworks", desc: "Create colorful flames that can distract or impress people." },
        ],
        ultimate: [
          { name: "Purple Blast", desc: "Create a powerful flame so hot it becomes purple, firing it straight at your enemy — a very powerful blast at the cost of lots of mana." },
          { name: "Fire Ignite", desc: "Ignite an incredibly powerful fire all around an enemy, setting them ablaze. Unavoidable." },
          { name: "Wildfire", desc: "Unleash a powerful wave of self-sustaining fire into the environment, scorching everything in its path." },
          { name: "Lightning Strike", desc: "Strike your enemy with lightning. Requires proficiency in Water, Fire and Wind magic to create a cloud and increase its electrical charge.", subCategory: true },
          { name: "Meteor", desc: "Combine Earth and Fire magic to make a massive ball of earth, then apply fire to it, creating a meteor.", subCategory: true },
        ],
      },
    },
    water: {
      label: "Water",
      summary: "By manipulating the hydrogen and oxygen atoms in the air using your mana, you can create and telekinetically manipulate water in the air.",
      tiers: {
        beginner: [
          { name: "Water Blast", desc: "A simple water spell that shoots a bit of water at a quick speed." },
          { name: "Puddle", desc: "Summon puddles of water on the floor to potentially trip your opponent." },
        ],
        intermediate: [
          { name: "Jet Shot", desc: "Create a blob of water, compress it into a torpedo shape, and fire it at the enemy with power and speed." },
          { name: "Water Wave", desc: "Create a big wave of water to move back a large group of enemies, without dealing much damage." },
          { name: "Ice Smash", desc: "Create a big piece of ice over an opponent's head using Fire magic to remove the heat from water, then drop it on them.", subCategory: true },
        ],
        advanced: [
          { name: "Water Dolls", desc: "Control multiple balls of water to create small water figures that can jump an enemy, attacking from all angles." },
          { name: "Mud Stop", desc: "Manipulate water into the ground to create mud, slowing the enemy and stopping them in their tracks." },
          { name: "Suffocation", desc: "Suffocate the target by stopping the movement of their blood, stopping their heart. Requires great control." },
          { name: "Adrenaline Rush", desc: "Manipulate the water in your own blood to increase heart rate, letting you move and react quicker at the cost of your health. Last resort." },
          { name: "Icicle Burst", desc: "Create multiple shards of ice using Fire and Water magic to remove heat, firing them at the enemy in a multi-shot burst.", subCategory: true },
        ],
        unique: [
          { name: "Water Breathing", desc: "Manipulate the oxygen in inhaled water so only oxygen enters your body underwater, letting you breathe. Consumes mana over time." },
          { name: "Water Distill", desc: "Create water with simple water magic and heat it with fire magic to distill it into clean water." },
          { name: "River-flow", desc: "Push boats forward with water magic, allowing faster water travel." },
          { name: "Cloudy Day", desc: "Use wind and water magic to create rain clouds at will — purely cosmetic, makes it rain out of nowhere.", subCategory: true },
        ],
        ultimate: [
          { name: "Water Leviathan", desc: "Create a large body of water shaped into a massive leviathan, impervious to (but incapable of) physical attacks; the caster shoots water spells from it." },
          { name: "Encashment", desc: "Trap opponents in a body of water that follows their center of mass, limiting movement and eventually drowning them. Works on several people at once." },
          { name: "Flash-flood", desc: "Gush water into the environment, disrupting all activity and likely killing many. Highly destructive." },
        ],
      },
    },
    wind: {
      label: "Wind",
      summary: "By using your mana you can manipulate the speed of air around you.",
      tiers: {
        beginner: [
          { name: "Wind Gust", desc: "A simple wind spell that gusts powerful wind at an enemy, possibly moving them back." },
          { name: "Speed Boost", desc: "Manipulate the wind around you to increase your movement speed." },
          { name: "Imbalance", desc: "Throw off an enemy's balance by slightly moving their limbs, making it difficult to attack or dodge." },
        ],
        intermediate: [
          { name: "Deafen", desc: "Deafen and confuse an opponent by creating strong, sharp air pressure inside their ears." },
          { name: "Wind Charge", desc: "An advanced Speed Boost — launch yourself at your enemy with incredible speed and power. Hard to aim, very damaging." },
          { name: "Wind Bullet", desc: "Compress air into a small ball and shoot it at the enemy, piercing a hole into anything if the user is skilled enough." },
        ],
        advanced: [
          { name: "Wind Cutters", desc: "Slice enemies using concentrated mana and air shot quickly, from a distance or up close." },
          { name: "Decapitation", desc: "Concentrate air pressure into a small area and shoot it at an enemy's neck. Easy to dodge due to its small size." },
          { name: "Smack Down", desc: "Lift the opponent using wind, then smack them onto the ground." },
          { name: "Debris Storm", desc: "Gather debris on the ground, launch it at an enemy, then create a spiral of debris on them." },
        ],
        unique: [
          { name: "Wind Blast", desc: "A big blast of wind that blows back enemies or the caster to escape or create distance quickly. Not very combat effective." },
          { name: "Flight", desc: "Manipulate the wind under your feet to raise yourself up and fly quickly with skill." },
          { name: "Wind Call", desc: "Amplify your voice with wind control to call for help or get everyone's attention." },
          { name: "Fire Dispel", desc: "Remove the air/oxygen from a fire to extinguish it. Requires extreme control — can accidentally empower the fire instead." },
        ],
        ultimate: [
          { name: "Suffocation", desc: "Use great control of air to expand the air inside someone's lungs, causing them to suffocate to death." },
          { name: "Tornado", desc: "Create a powerful, building flow of wind that becomes a massive tornado you can launch at a group of enemies." },
        ],
      },
    },
    earth: {
      label: "Earth",
      summary: "You can manipulate and multiply the atoms in the ground to make compact stones or blocks using the earth.",
      tiers: {
        beginner: [
          { name: "Rock Dart", desc: "Summon a simple dart or ball of compacted earth and launch it to stagger the enemy." },
          { name: "Rock Wall", desc: "Manipulate the earth to create a simple wall in front of you and the enemy, blocking sight and attack." },
        ],
        intermediate: [
          { name: "Rock Ensnare", desc: "Manipulate the earth around an enemy to ensnare them in a tight ball of earth." },
          { name: "Gear Up", desc: "Create a shield and sword out of earth — quality depends on mastery and available resources." },
        ],
        advanced: [
          { name: "Clay Drill", desc: "Create a rapidly spinning drill of earth that can be fired to drill into an enemy." },
          { name: "Quick Sand", desc: "Manipulate the earth to create quick sand, trapping the enemy. (Countered by Sword Water Style.)" },
          { name: "Armour Up", desc: "Create armour from the earth around you — quality depends on available resources." },
          { name: "Heal", desc: "Manipulate natural resources in water and earth to heal a wound — effectiveness depends on skill. Requires some fire skill to close the wound with heat.", subCategory: true },
        ],
        unique: [
          { name: "Clay Wagon", desc: "Manipulate earth into a wheeled wagon you can move with mana — a means of transport." },
          { name: "Figure Create", desc: "Manipulate earth into a small doll or figure of someone — accuracy depends on how well you know them." },
          { name: "Trap", desc: "Create a trapdoor that drops any enemy who steps on it into a pit of spikes." },
          { name: "Clay Manipulation", desc: "Manipulate earth into any structure your imagination and skill allow, such as a house or statue." },
        ],
        ultimate: [
          { name: "Clay Giant", desc: "Create a giant clay doll (with its own health) that regenerates when damaged, at the cost of mana. Can shoot darts of earth." },
          { name: "Sink Hole", desc: "Create a massive sink hole underneath a large group of enemies to trap or kill them." },
          { name: "Volcano", desc: "Requires high skill in both fire and earth magic — spontaneously generate an actively erupting volcano, causing great havoc.", subCategory: true },
        ],
      },
    },
  },

  /* Non-elemental "Intellectual" magic skills — not tied to a single element tier. */
  intellectualSkills: [
    { name: "Intuition", desc: "See your opponent's moves before they do them, making it easier to dodge." },
    { name: "Manifest", desc: "Align your thoughts and beliefs into reality, bending logic to your will." },
    { name: "Manipulate", desc: "Encourage your opponent to do whatever you please, using magic power to convince them." },
    { name: "Hallucinate", desc: "Cause your opponent to hallucinate several versions of you. Stronger casters can make the opponent genuinely feel the hallucinations' attacks." },
    { name: "Degrade", desc: "Mentally deteriorate your enemy, making them less aware and slowly driving them into madness." },
  ],

  /* ---------------------------------------------------------------- *
   * Items: scrolls, potions, gear (with quality tiers), artifacts.
   * ---------------------------------------------------------------- */
  items: {
    scrolls: {
      summary: "Anything that allows you to learn a spell. Roll to learn it on the spot (10+ succeeds). One-time use, even on failure. Missing a prerequisite spell gives a -2 disadvantage.",
      tiers: ["Beginner", "Intermediate", "Advanced", "Unique", "Ultimate"],
      elementRollTable: { 1: "Fire", 2: "Water", 3: "Wind", 4: "Earth" },
    },
    potions: [
      { name: "Healing Potion", desc: "Heals the player for 75% of their HP. Rare — most commonly found in the Elven Heaps or Elovian Farlands." },
      { name: "Fire Potion", desc: "Deals fire damage to low-constitution players, but increases fire resistance after drinking." },
      { name: "Love Potion", desc: "Gives the drinker +10 Charisma; everyone flirts with them when spoken to." },
    ],
    gearQualityTiers: ["Damaged", "Artisan", "Noble", "Pristine"],
    gearSets: [
      { race: "Demi-Human", bonus: "Sword/spear combat and Constitution", slots: ["Warriors Headband (Constitution)", "Crusaders Helmet (Slash Resistance)", "Warriors Armplates (sword/spear roll bonus)"] },
      { race: "Human", bonus: "Charisma; can disguise the wearer in human territory", slots: ["Biblical-motif regalia (headware/chest/arm/foot/weapon slots — details TBD by DM)"] },
      { race: "Demon", bonus: "Constitution and Strength", slots: ["Forged from tough metals of the Badlands caves (slot details TBD by DM)"] },
      { race: "Orc", bonus: "Blunt damage and Constitution", slots: ["Heavy stone and scavenged gear (slot details TBD by DM)"] },
      { race: "Elf", bonus: "Dexterity and Wisdom", slots: ["Lightweight gear for moving through trees (slot details TBD by DM)"] },
      { race: "Elovian", bonus: "Wisdom and magic-related attacks; increases mana capacity", slots: ["Mana-focused regalia (slot details TBD by DM)"] },
      { race: "Godly", bonus: "Large bonuses to the god's respective expertise", slots: ["Artifacts left behind by the gods (slot details TBD by DM)"] },
      { race: "Cursed", bonus: "Unique bonuses, blessed or cursed", slots: ["Special gear blessed/cursed by the Gods or a Crafter (slot details TBD by DM)"] },
    ],
    artifacts: [
      { name: "Elovian Mana Crystal", desc: "Flow mana into the crystal to see any place or person you know the appearance of." },
      { name: "Sacrificial Dagger", desc: "Used on 10 living humans, this mana-infused blade returns a god from the dead — the revival's location and identity cannot be chosen." },
    ],
  },

  /* ---------------------------------------------------------------- *
   * Sword styles — mastery track: Beginner -> Intermediate -> Advanced
   * -> Veteran -> Noble -> Master -> God. Only one style may reach God.
   * Veteran is the cap if training all four styles.
   * ---------------------------------------------------------------- */
  swordStyles: [
    {
      name: "Sword Saint Style",
      origin: "Northern region — developed by outcast Elovians with no talent for magic.",
      desc: "Swift, elegant strikes. Effective against rogues and smaller enemies; ineffective against large brutes who shrug off small slashes.",
    },
    {
      name: "Sword Brute Style",
      origin: "Badlands — developed by demons to train the young against Orc raids.",
      desc: "Large, heavy strikes using the whole body's chain of motion. Effective against big, tanky enemies; ineffective against smaller, agile ones.",
    },
    {
      name: "Sword Water Style",
      origin: "The swamps, home to an elf village with poor footing for archery.",
      desc: "Wind magic used to imitate flowing water, letting the user move freely in bad terrain while enemies get stuck. Effective against magic users trying to keep distance; ineffective against enemies who don't need distance, like rogues.",
    },
    {
      name: "Sword Fiend Style",
      origin: "The woods, home to the Demi-Humans — developed to fight humans.",
      desc: "Quick, animal-like claw strikes built to break shields and spears. Very effective against human sword/spear/shield wielders; ineffective against thick-skinned animals or monsters without weapons.",
    },
  ],
  swordMasteryLevels: ["Beginner", "Intermediate", "Advanced", "Veteran", "Noble", "Master", "God"],

  /* ---------------------------------------------------------------- *
   * World: Quevela and its five regions.
   * ---------------------------------------------------------------- */
  world: {
    name: "Quevela",
    regions: [
      { name: "Elven Heaps", desc: "A fast forest filled with wild animals. Elegant elves hunt and survive using quiet tactics; mostly peaceful." },
      { name: "BadLands", desc: "A red-hot wasteland where demons and orcs are constantly at war. Barren, but powerful brute weaponry can be found." },
      { name: "Supalania", desc: "The biggest landmass, fully colonized by humans devoted to the Gods' goal of destroying the Elovian rebels. Demi-humans in between prevent that goal." },
      { name: "Demihuman Turf", desc: "Half-breeds rejected by other nations flee here. They refuse to take sides, the sole mitigator preventing an eventual war." },
      { name: "Elovian Farlands", desc: "The mysterious Elovians keep to themselves, studying magic and sorcery. Not much is known about what happens there." },
    ],
  },

  /* ---------------------------------------------------------------- *
   * Races / Factions
   * ---------------------------------------------------------------- */
  races: [
    { name: "Elovian", desc: "Dedicated to study; mostly wizards and mages with their own secret language. The most advanced spellcasters, some seeking to kill spirits and the Gods themselves." },
    { name: "Human", desc: "Ancestors of the Elovians. Serve the Gods as religious warriors, fighting for the Gods' ultimate goal of retaking the world." },
    { name: "Elves", desc: "Weak in strength but excel at wind magic and bows, with a secret arrow technique. Isolated and sneaky, hidden in dense forests." },
    { name: "Orks", desc: "Sworn enemies of most semi-human races. No hesitation to kill; live in large, self-trained warbands wielding swords and spears." },
    { name: "Demons", desc: "A harsher human offshoot — physically strong, naturally aggressive from their harsh homeland, with suppressed magical ability. Can be won over by genuine kindness." },
    { name: "Gods", desc: "Powerful spirit-beings born from ancient humans who learned magic. Hold a grudge against humanity but manipulate humans into worship anyway." },
    { name: "Demi-Gods", desc: "Offspring of Gods, born with extreme mana that attracts strong monsters. Rarely survive to adulthood, but could rival the Gods if they do." },
    { name: "Demi-Humans", desc: "Animal-featured people, the second-largest race. Welcoming to others; the main opposition to god- and human-controlled empires." },
  ],

  /* ---------------------------------------------------------------- *
   * Enemies / Monsters
   * ---------------------------------------------------------------- */
  enemies: {
    global: [
      { name: "Mercenaries", desc: "Hireable by anyone to kill anybody or anything for a price. Skill varies widely." },
      { name: "Slimes", desc: "Weak monsters found nearly everywhere, able to use beginner-level spells of their region." },
    ],
    "Elven Heaps": [
      { name: "Elemental Wolves", desc: "Weak in Constitution, but can use varying elements up to Intermediate level, plus sharp claws in close combat." },
    ],
    BadLands: [
      { name: "Dragons", desc: "Extremely powerful, rarely seen monsters living in the unexplored northern Badlands. Usually found in groups." },
    ],
    Supalania: [],
    "Demi-human Turf": [],
    "Elovian Farlands": [],
  },

  /* ---------------------------------------------------------------- *
   * Adventurers' Guild ranks and rules.
   * ---------------------------------------------------------------- */
  guild: {
    ranks: ["F", "D", "C", "B", "A", "S"],
    maxPartySize: 10,
    rules: [
      "A new party always starts at F rank and may only take jobs of its current rank.",
      "A party must take and complete at least one job every month to stay together.",
      "After 5 successful jobs at a rank, the party may ask the guildmaster to rank up — all members must agree.",
    ],
  },
};

// Flatten every spell across all elements/tiers into one lookup array —
// used by the "unlock threshold" picker in the DM Tools panel.
GameData.allSpells = Object.entries(GameData.magic).flatMap(([elementKey, element]) =>
  Object.entries(element.tiers).flatMap(([tier, spells]) =>
    spells.map((s) => ({ ...s, element: elementKey, elementLabel: element.label, tier }))
  )
);

if (typeof module !== "undefined") module.exports = GameData;
