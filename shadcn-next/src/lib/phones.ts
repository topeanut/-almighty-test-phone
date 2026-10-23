export const PHONES = [
  {
    id: "a01",
    label: "A01",
    platform: "android",
    model: "갤럭시 S8",
    color: "미드나이트 블랙",
    image: "/devices/cutout/a01-s8.png",
    imageSize: { width: 360, height: 360, displayHeight: 176 },
  },
  {
    id: "a02",
    label: "A02",
    platform: "android",
    model: "갤럭시 S9",
    color: "선라이즈 골드",
    image: "/devices/cutout/a02-s9.png",
    imageSize: { width: 849, height: 560, displayHeight: 150 },
  },
  {
    id: "a03",
    label: "A03",
    platform: "android",
    model: "갤럭시 S10 5G",
    color: "크라운 골드",
    image: "/devices/cutout/a3-s10.png",
    imageSize: { width: 275, height: 183, displayHeight: 140 },
  },
  {
    id: "a04",
    label: "A04",
    platform: "android",
    model: "LG V50 ThinQ",
    color: "아스트로 블랙",
    image: "/devices/cutout/a04-v50.png",
    imageSize: { width: 593, height: 589, displayHeight: 176 },
  },
  {
    id: "a05",
    label: "A05",
    platform: "android",
    model: "갤럭시 S23",
    color: "크림",
    image: "/devices/cutout/a05-s23.png",
    imageSize: { width: 360, height: 360, displayHeight: 176 },
  },
  {
    id: "i01",
    label: "I01",
    platform: "ios",
    model: "아이폰 SE",
    color: "PRODUCT(RED)",
    image: "/devices/cutout/i01_se1.png",
    imageSize: { width: 400, height: 400, displayHeight: 176 },
  },
  {
    id: "i02",
    label: "I02",
    platform: "ios",
    model: "아이폰 X",
    color: "스페이스 그레이",
    image: "/devices/cutout/i02-X.png",
    imageSize: { width: 360, height: 360, displayHeight: 176 },
  },
  {
    id: "i03",
    label: "I03",
    platform: "ios",
    model: "아이폰 12 mini",
    color: "블랙",
    image: "/devices/cutout/i03-12mini.png",
    imageSize: { width: 600, height: 600, displayHeight: 176 },
  },
] as const;

export type PhoneDefinition = (typeof PHONES)[number];
export type PhoneId = PhoneDefinition["id"];
export type Platform = PhoneDefinition["platform"];

export const PHONE_BY_ID: Record<PhoneId, PhoneDefinition> = PHONES.reduce(
  (acc, phone) => {
    acc[phone.id] = phone;
    return acc;
  },
  {} as Record<PhoneId, PhoneDefinition>
);

export const PHONE_IDS: PhoneId[] = PHONES.map((p) => p.id);

export const isPhoneId = (value: string): value is PhoneId =>
  (PHONE_IDS as string[]).includes(value);
