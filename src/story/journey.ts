/** Prerequisites survive a missed day; a chapter never depends on a forced night detour. */
export type JourneyState = {
  day: number;
  kite: string;
  sushi: boolean;
  order: boolean;
  project: string;
  chime: boolean;
  festivalArt: boolean;
  gathering: boolean;
};
export type Chapter =
  | "kite"
  | "supper"
  | "sign"
  | "shelter"
  | "chime"
  | "invitation"
  | "gather"
  | "rest";
export const DAYS = [
  {
    title: "Bir uçurtma, bir sofra",
    morning: "Bir çizginin nereye varacağını henüz bilmiyorsun.",
  },
  {
    title: "Çay evinde bir iz",
    morning: "Dünkü uçurtmayı bugün bütün sokak konuşuyor.",
  },
  {
    title: "Yağmurda bir yer",
    morning: "Islak taşlar. Birlikte kurulacak kuru bir köşe.",
  },
  {
    title: "Rüzgârın sesi",
    morning: "Yağmur dindi; şimdi örtünün ucunda rüzgâr var.",
  },
  {
    title: "Birlikte kalan çizgiler",
    morning: "Bir zamanlar boş olan köşede bugün buluşma var.",
  },
] as const;
export function nextChapter(q: JourneyState): Chapter {
  if (q.kite !== "done") return "kite";
  if (q.day === 1 && !q.sushi) return "supper";
  if (q.day >= 2 && !q.order) return "sign";
  if (q.day >= 3 && !q.project) return "shelter";
  if (q.day >= 4 && !q.chime) return "chime";
  if (q.day >= 5 && !q.festivalArt) return "invitation";
  if (q.day >= 5 && !q.gathering) return "gather";
  return "rest";
}
export function dayComplete(q: JourneyState) {
  return q.day === 1
    ? q.sushi
    : q.day === 2
      ? q.order
      : q.day === 3
        ? !!q.project
        : q.day === 4
          ? q.chime
          : q.gathering;
}
export function eveningTarget(
  q: JourneyState,
  tableReady: boolean,
  _waitingForDinner: boolean,
) {
  if (q.day > 5) return 0;
  if (q.day === 1 && tableReady && !q.sushi) return 0.705;
  return dayComplete(q) ? 0.795 : 0;
}
