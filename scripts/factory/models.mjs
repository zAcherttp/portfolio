// Source meshes for the factory line and the art direction rules that give each
// connected piece ("part") a tone role. A model is every mesh component of the
// building's blueprint, placed as the blueprint places it (glTF frame: UE yaw
// θ is a turn of -θ about y, UE (X, Y, Z) cm is (X, Z, Y) / 100 m). Bounds are
// in the actor frame, y up; connection ports sit 1 m up on the local z axis.
//
// Items also name their base-colour texture (and material tint): the render
// step averages it per part for the coloured belt items. Only the averaged
// colours reach the site.
//
// Roles: 0 base, 1 structure, 2 detail, 3 subject (the belt items), 4 lit (the
// accent that wakes when the machine runs). SPIN marks parts that turn around
// the model's y axis; EMITTER the glowing body a building's light comes from;
// POWERED a lamp lit by the line's power.

const BUILD = "FactoryGame/Content/FactoryGame/Buildable/Factory";
const RES = "FactoryGame/Content/FactoryGame/Resource";

/**
 * Machines share MM_Factory_Array: TX2D_FactoryBase_* hold a layer per
 * surface kind, and only the last layer's MREO has emissive, round each port
 * and indicator. Faces whose TEXCOORD_0 lands there glow.
 */
const FACTORY_GLOW = {
  mask: "FactoryGame/Content/FactoryGame/Buildable/-Shared/Material/Resources/TX2D_FactoryBase_MREO_LAYER8.png",
  channel: 2,
  // Inputs' stripes sit on the mask's dim squares (0.29), outputs' brackets
  // on its bright ones (0.67): both glow.
  threshold: 0.2,
  // MM_Factory_Array's Input_Color and Output_Color: the bright squares are
  // outputs, read per pixel.
  colour: "#ffba00",
  output: { colour: "#1bffd5", threshold: 0.5 },
};

/** The smelter albedo's orange paint, by colour. */
const ORANGE_PAINT = ([r, g, b]) => r > 200 && g > 100 && g < 180 && b < 60;

export const BASE = 0;
export const STRUCTURE = 1;
export const DETAIL = 2;
export const SUBJECT = 3;
export const LIT = 4;
export const SPIN = 8;
/** Flat cards the game textures with alpha; drawn as geometry they are slabs. */
export const HIDDEN = 16;
/** Where a building's light comes from: it casts no shadow of that light. */
export const EMITTER = 32;
/** A lamp that glows while the line has power, in the power colour. */
export const POWERED = 64;
/** Cut from a decal's tile: drawn only where the tile is opaque. */
export const CUTOUT = 128;

const size = (p) => p.max.map((v, i) => v - p.min[i]);
const diagonal = (p) => Math.hypot(...size(p));

/** Footing, small details, everything else. */
function generic(p, footing) {
  if (p.max[1] < footing) return BASE;
  if (diagonal(p) < 0.6) return DETAIL;
  return STRUCTURE;
}

/** The drill head wakes with the miner; its moving parts are the skinned mesh. */
function miner(p) {
  if (p.bone === "drill") return LIT;
  return generic(p, 1.4);
}

/** Every part of an item shares one role; items are the subject of the line. */
const item = () => SUBJECT;

export const MODELS = [
  {
    name: "miner-mk1",
    glow: FACTORY_GLOW,
    components: [
      { source: `${BUILD}/MinerMK1/Mesh/MinerMk1_static.glb` },
      // Build_MinerMk1's MainMesh_skl: the drill, engine, cables and the reload
      // gripper, animated by BPA_MinerMk1 with the Mk.2 miner's clips. Idle
      // holds Startup's first frame; Startup runs into a Drilling loop; every
      // 30 s of producing, Reload plays over the gripper from reloadbase down.
      {
        source: `${BUILD}/MinerMK1/Mesh/SK_MinerMk1.glb`,
        skeletal: {
          folder: `${BUILD}/MinerMk2/Animation`,
          clips: {
            idle: ["Startup", { first: 0, last: 0 }],
            startup: ["Startup"],
            producing: ["Drilling"],
            reload: ["Reload"],
          },
          layer: { root: "reloadbase", clip: "reload" },
        },
      },
    ],
    role: miner,
  },
  {
    name: "smelter",
    glow: FACTORY_GLOW,
    components: [
      // Build_SmelterMk1 turns the body half a turn and nudges it back 30 cm.
      {
        source: `${BUILD}/SmelterMk1/Mesh/SmelterMk1_static.glb`,
        yaw: Math.PI,
        offset: [0, 0, -0.3],
      },
      // The tower is the vertex-animated mesh, a child of the body: it turns
      // and shifts with it, then sits 5 cm up.
      {
        source: `${BUILD}/SmelterMk1/Mesh/SM_VAT_Smelter_01.glb`,
        yaw: Math.PI,
        offset: [0, 0.05, -0.3],
        glow: [
          // The forge's mouth on top, round the burner socket the smoke
          // leaves by, glows in the game; the albedo paints it orange. (The
          // AO masks' blue channel also lights slits beside the windows;
          // they stay plain.)
          {
            mask: `${BUILD}/SmelterMk1/Texture/TX_SK_Smelter_01_BC.png`,
            test: ORANGE_PAINT,
            dark: ([, y]) => y < 7.5,
          },
          // The strip down the tower's front, painted the same orange,
          // glows as its power lamp.
          {
            mask: `${BUILD}/SmelterMk1/Texture/TX_SK_Smelter_01_BC.png`,
            test: ORANGE_PAINT,
            dark: ([, y, z]) => y < 4.5 || y > 7.2 || z < 3,
            power: true,
          },
        ],
        // MI_VAT_Smelter_*: position and rotation textures, clip seconds.
        vat: {
          clips: {
            idle: ["TX_Smelter_Idle_Pos", "TX_Smelter_Idle_Quat", 1.266667],
            startup: [
              "TX_Smelter_Startup_POS",
              "TX_Smelter_Startup_QUAT",
              1.266667,
            ],
            producing: [
              "TX_Smelter_Producing_2_POS",
              "TX_Smelter_Producing_2_QUAT",
              2.533334,
            ],
            shutdown: [
              "TX_Smelter_Shutdown_POS",
              "TX_Smelter_Shutdown_QUAT",
              1.033333,
            ],
          },
        },
      },
    ],
    role: (p) => generic(p, 0.5),
  },
  {
    name: "constructor",
    glow: FACTORY_GLOW,
    components: [
      { source: `${BUILD}/ConstructorMk1/Mesh/ConstructorMk1_static.glb` },
      // The press and its arms are the vertex-animated mesh.
      {
        source: `${BUILD}/ConstructorMk1/Mesh/SM_VAT_Constructor_MK1.glb`,
        // MI_VAT_Constructorr: one producing loop, 119 frames at 30 fps.
        vat: {
          clips: {
            producing: ["TX_Constructor_POS", "TX_Constructor_QUAT", 119 / 30],
          },
        },
      },
    ],
    role: (p) => generic(p, 0.5),
    // The deck on top is a grate: a flat card the decal atlas's grate tile
    // cuts into bars (DecalColor_Masked, ColorAtlas_Alb's alpha).
    cutout: {
      mask: "FactoryGame/Content/FactoryGame/Buildable/-Shared/Texture/ColorAtlas_Alb.png",
      region: [0, 0.125, 0.28, 0.42],
      size: 128,
    },
  },
  {
    name: "depot",
    // MI_CentralStorage_01 (MM_FactoryBaked) glows E8CF76 where its
    // reflection map's blue channel is set: the input's three stripes.
    glow: {
      mask: `${BUILD}/CentralStorage/Texture/TX_CentralStorage_Refl.png`,
      channel: 2,
      colour: "#e8cf76",
    },
    components: [
      // Build_CentralStorage: the uploader body faces back, input on +z.
      {
        source: `${BUILD}/CentralStorage/Mesh/SM_CentralStorage_01.glb`,
        yaw: Math.PI,
      },
      {
        source:
          "FactoryGame/Content/FactoryGame/World/Benefit/AlienArtifact/Mesh/SM_Mercer_Rings.glb",
        // Under the body via the glow plane, so it turns with it; the
        // blueprint shrinks it to 0.54 to sit inside the top cap.
        yaw: Math.PI,
        offset: [0, 3.55, -1.09],
        scale: 0.54,
      },
    ],
    // Glows in the game: the windows and the encapsulated Mercer sphere
    // (component 1), which is where the depot's light comes from.
    role: (p) => {
      if (p.component === 1 && size(p)[1] < 0.05) return HIDDEN;
      if (p.component === 1) return LIT | EMITTER;
      // The windows glow with the sphere's light, not the glyphs' colour.
      if (p.emissive) return LIT | EMITTER;
      return generic(p, 0.5);
    },
  },
  {
    name: "splitter",
    // MI_Splitter_01 (MM_FactoryBaked) glows F6CB00 where its
    // reflection map's blue channel is set: the ports' stripes and brackets.
    glow: {
      mask: `${BUILD}/CA_Splitter/Texture/TX_Splitter_Refl.png`,
      channel: 2,
      colour: "#f6cb00",
    },
    components: [
      // Build_ConveyorAttachmentSplitter: SM_Splitter_01, turned half round, 55 cm down.
      {
        source: `${BUILD}/CA_Splitter/Mesh/SM_Splitter_01.glb`,
        yaw: Math.PI,
        offset: [0, -0.55, 0],
      },
    ],
    role: (p) => generic(p, -0.4),
  },
  {
    name: "merger",
    // MI_Merger_01 (MM_FactoryBaked) glows F6CB00 where its
    // reflection map's blue channel is set: the ports' stripes and brackets.
    glow: {
      mask: `${BUILD}/CA_Merger/Texture/TX_Merger_Refl.png`,
      channel: 2,
      colour: "#f6cb00",
    },
    components: [
      // Build_ConveyorAttachmentMerger: SM_Merger_01, 55 cm down.
      {
        source: `${BUILD}/CA_Merger/Mesh/SM_Merger_01.glb`,
        offset: [0, -0.55, 0],
      },
    ],
    role: (p) => generic(p, -0.4),
  },
  {
    name: "belt",
    components: [
      { source: `${BUILD}/ConveyorBeltMk1/Mesh/SM_ConveyorBelt_Mk1.glb` },
    ],
    // MI_ConveyorBelt_Mk1_01 (MM_ConveyorBelt): the lights along the rails
    // glow where the MREO texture's emissive channel is set.
    // Lamps along every belt, lit in full while the line has power, in
    // MI_ConveyorBelt's EmissiveColour.
    glow: {
      mask: `${BUILD}/ConveyorBeltMk1/Texture/TX_ConveyorBeltMk1_MREO.png`,
      channel: 2,
      power: true,
      colour: "#ffe786",
    },
    role: () => STRUCTURE,
  },
  {
    name: "belt-mk3",
    components: [
      { source: `${BUILD}/ConveyorBeltMk3/Mesh/SM_ConveyorBelt_Mk3.glb` },
    ],
    // Lamps along every belt, lit in full while the line has power, in
    // MI_ConveyorBelt's EmissiveColour.
    glow: {
      mask: `${BUILD}/ConveyorBeltMk3/Texture/TX_ConveyorBeltMk3_MREO.png`,
      channel: 2,
      power: true,
      colour: "#ffe786",
    },
    role: () => STRUCTURE,
  },
  {
    name: "foundation",
    components: [
      {
        source:
          "FactoryGame/Content/FactoryGame/Buildable/Building/Foundation/FicsitSet/SM_Foundation_FicsitSet_8x1_01.glb",
      },
    ],
    role: () => BASE,
  },
  {
    name: "power-pole",
    components: [
      // Build_PowerPoleMk1 sets SM_PowerPole_Mk1 10 cm up.
      {
        source: `${BUILD}/PowerPoleMk1/Mesh/SM_PowerPole_Mk1.glb`,
        offset: [0, 0.1, 0],
      },
    ],
    role: (p) => generic(p, 0.3),
  },
  {
    name: "node-iron",
    components: [
      { source: `${RES}/RawResources/Nodes/ResourceNode_OreIron_01.glb` },
    ],
    role: () => BASE,
  },
  {
    name: "ore",
    components: [
      { source: `${RES}/RawResources/Ores/Meshes/SM_IronOre_01.glb` },
    ],
    role: item,
    albedo: `${RES}/RawResources/Ores/Textures/TX_IronOre_BC.png`,
  },
  {
    name: "ingot",
    components: [{ source: `${RES}/Parts/IronIngot/SM_IronIngot_01.glb` }],
    role: item,
    // MI_IronIngot_01 tints the placeholder albedo #DADFEC: steel blue-grey.
    tint: "#DADFEC",
  },
  {
    name: "screw",
    components: [{ source: `${RES}/Parts/IronScrew/SM_IronScrew_01.glb` }],
    role: item,
    albedo: `${RES}/Parts/IronScrew/Textures/TX_IronScrew_BC.png`,
  },
];
