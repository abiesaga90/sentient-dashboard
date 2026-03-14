export interface Engine {
  id: string;
  label: string;
  url: string;
}

export const ENGINES: Engine[] = [
  {
    id: "nickel",
    label: "Nickel Digital",
    url: "https://ls-rv-engine-nickel.onrender.com",
  },
  {
    id: "teroxx",
    label: "Teroxx",
    url: "https://ls-rv-engine-xizl.onrender.com",
  },
];
