export interface LodgingSection {
  key: string;
  title: string;
  subtitle: string;
  roomType: string;
  coupleRoomName?: string; // The couple's reserved room in this section
}

export const LODGING_SECTIONS: LodgingSection[] = [
  {
    key: "hearth_village",
    title: "The Hearth Village",
    subtitle: "King bed private suite with private bathroom",
    roomType: "hearth_village",
    coupleRoomName: "The Fenimore",
  },
  {
    key: "farmhouse",
    title: "Farmhouse Residence",
    subtitle: "King room ensuite",
    roomType: "farmhouse",
  },
  {
    key: "grove",
    title: "The Grove Guesthouses",
    subtitle: "King room, private suite with private bathroom",
    roomType: "grove",
  },
  {
    key: "victoria",
    title: "The Victoria Cabins",
    subtitle: "King bed private with private bathroom",
    roomType: "victoria",
  },
];

export type SectionPaymentMode = "host" | "guest" | "mixed";
