export interface Engine {
  id: string;
  label: string;
  url: string;
  adminSecret: string;
}

export const ENGINES: Engine[] = [
  {
    id: "nickel",
    label: "Nickel Digital",
    url: "https://ls-rv-engine-nickel.onrender.com",
    adminSecret: "sentient2026",
  },
];
