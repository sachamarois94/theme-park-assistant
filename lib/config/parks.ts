import { ParkDefinition, ParkId } from "@/lib/types/park";

export const PARKS: ParkDefinition[] = [
  {
    id: "disney-magic-kingdom",
    name: "Magic Kingdom",
    resort: "Walt Disney World",
    aliases: [
      "magic kingdom",
      "magic kingdom park",
      "mk",
      "disney magic kingdom",
      "walt disney world magic kingdom"
    ],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_MAGIC_KINGDOM_ID,
      queueTimesParkId: process.env.QUEUETIMES_MAGIC_KINGDOM_ID
    },
    headlineAttractions: [
      "TRON Lightcycle / Run",
      "Seven Dwarfs Mine Train",
      "Space Mountain",
      "Big Thunder Mountain Railroad",
      "Pirates of the Caribbean"
    ]
  },
  {
    id: "disney-epcot",
    name: "EPCOT",
    resort: "Walt Disney World",
    aliases: ["epcot", "epcot park", "disney epcot", "walt disney world epcot"],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_EPCOT_ID,
      queueTimesParkId: process.env.QUEUETIMES_EPCOT_ID
    },
    headlineAttractions: [
      "Guardians of the Galaxy: Cosmic Rewind",
      "Remy's Ratatouille Adventure",
      "Frozen Ever After",
      "Soarin' Around the World",
      "Test Track"
    ]
  },
  {
    id: "disney-hollywood-studios",
    name: "Disney's Hollywood Studios",
    resort: "Walt Disney World",
    aliases: [
      "hollywood studios",
      "disneys hollywood studios",
      "disney's hollywood studios",
      "dhs",
      "studios"
    ],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_HOLLYWOOD_STUDIOS_ID,
      queueTimesParkId: process.env.QUEUETIMES_HOLLYWOOD_STUDIOS_ID
    },
    headlineAttractions: [
      "Star Wars: Rise of the Resistance",
      "Slinky Dog Dash",
      "Mickey & Minnie's Runaway Railway",
      "The Twilight Zone Tower of Terror",
      "Rock 'n' Roller Coaster"
    ]
  },
  {
    id: "disney-animal-kingdom",
    name: "Disney's Animal Kingdom",
    resort: "Walt Disney World",
    aliases: [
      "animal kingdom",
      "animal kingdom park",
      "disney's animal kingdom",
      "disneys animal kingdom",
      "dak",
      "ak"
    ],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_ANIMAL_KINGDOM_ID,
      queueTimesParkId: process.env.QUEUETIMES_ANIMAL_KINGDOM_ID
    },
    headlineAttractions: [
      "Avatar Flight of Passage",
      "Na'vi River Journey",
      "Expedition Everest",
      "Kilimanjaro Safaris",
      "DINOSAUR"
    ]
  },
  {
    id: "universal-studios-florida",
    name: "Universal Studios Florida",
    resort: "Universal Orlando",
    aliases: [
      "universal studios florida",
      "universal studios",
      "usf",
      "universal orlando studios"
    ],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_UNIVERSAL_STUDIOS_FLORIDA_ID,
      queueTimesParkId: process.env.QUEUETIMES_UNIVERSAL_STUDIOS_FLORIDA_ID
    },
    headlineAttractions: [
      "Harry Potter and the Escape from Gringotts",
      "Hollywood Rip Ride Rockit",
      "Transformers: The Ride-3D",
      "Revenge of the Mummy",
      "Despicable Me Minion Mayhem"
    ]
  },
  {
    id: "universal-islands-of-adventure",
    name: "Universal Islands of Adventure",
    resort: "Universal Orlando",
    aliases: [
      "islands of adventure",
      "universal islands of adventure",
      "ioa",
      "universal ioa"
    ],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_ISLANDS_OF_ADVENTURE_ID,
      queueTimesParkId: process.env.QUEUETIMES_ISLANDS_OF_ADVENTURE_ID
    },
    headlineAttractions: [
      "Hagrid's Magical Creatures Motorbike Adventure",
      "Jurassic World VelociCoaster",
      "The Incredible Hulk Coaster",
      "Harry Potter and the Forbidden Journey",
      "The Amazing Adventures of Spider-Man"
    ]
  },
  {
    id: "universal-epic-universe",
    name: "Universal Epic Universe",
    resort: "Universal Orlando",
    aliases: [
      "epic universe",
      "universal epic universe",
      "universal's epic universe",
      "eu"
    ],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_EPIC_UNIVERSE_ID,
      queueTimesParkId: process.env.QUEUETIMES_EPIC_UNIVERSE_ID
    },
    headlineAttractions: [
      "Super Nintendo World Attraction",
      "How to Train Your Dragon Attraction",
      "Dark Universe Attraction",
      "Celestial Park Signature Ride",
      "Wizarding World Expansion Attraction"
    ]
  },
  {
    id: "universal-volcano-bay",
    name: "Universal Volcano Bay",
    resort: "Universal Orlando",
    aliases: [
      "volcano bay",
      "universal volcano bay",
      "vb",
      "universal water park"
    ],
    providerHints: {
      themeparksEntityId: process.env.THEMEPARKS_VOLCANO_BAY_ID,
      queueTimesParkId: process.env.QUEUETIMES_VOLCANO_BAY_ID
    },
    headlineAttractions: [
      "Krakatau Aqua Coaster",
      "Ko'okiri Body Plunge",
      "Kala and Tai Nui Serpentine Body Slides",
      "Punga Racers",
      "TeAwa The Fearless River"
    ]
  }
];

export function getParkById(parkId: string): ParkDefinition | undefined {
  return PARKS.find((park) => park.id === parkId);
}

export function isParkId(value: string): value is ParkId {
  return PARKS.some((park) => park.id === value);
}
