export const PHONES = [
  {
    id: "a01",
    label: "A01",
    platform: "android",
    model: "갤럭시 S8",
    color: "미드나이트 블랙",
    image: "/devices/trimmed/a01-s8.png",
    // 기기 설정 > 휴대전화 정보에서 확인한 버전으로 채운다 (예: "Android 12", "iOS 16.7")
    osVersion: null as string | null,
    imageSize: { width: 300, height: 360 },
  },
  {
    id: "a02",
    label: "A02",
    platform: "android",
    model: "갤럭시 S9",
    color: "선라이즈 골드",
    image: "/devices/trimmed/a02-s9.png",
    osVersion: null as string | null,
    imageSize: { width: 253, height: 508 },
  },
  {
    id: "a03",
    label: "A03",
    platform: "android",
    model: "갤럭시 S10 5G",
    color: "크라운 골드",
    image: "/devices/trimmed/a3-s10.png",
    osVersion: null as string | null,
    imageSize: { width: 94, height: 183 },
  },
  {
    id: "a04",
    label: "A04",
    platform: "android",
    model: "LG V50 ThinQ",
    color: "아스트로 블랙",
    image: "/devices/trimmed/a04-v50.png",
    osVersion: null as string | null,
    imageSize: { width: 560, height: 556 },
  },
  {
    id: "a05",
    label: "A05",
    platform: "android",
    model: "갤럭시 S23",
    color: "크림",
    image: "/devices/trimmed/a05-s23.png",
    osVersion: null as string | null,
    imageSize: { width: 300, height: 358 },
  },
  {
    id: "i01",
    label: "I01",
    platform: "ios",
    model: "아이폰 SE",
    color: "PRODUCT(RED)",
    image: "/devices/trimmed/i01_se1.png",
    osVersion: null as string | null,
    imageSize: { width: 179, height: 341 },
  },
  {
    id: "i02",
    label: "I02",
    platform: "ios",
    model: "아이폰 X",
    color: "스페이스 그레이",
    image: "/devices/trimmed/i02-X.png",
    osVersion: null as string | null,
    imageSize: { width: 206, height: 360 },
  },
  {
    id: "i03",
    label: "I03",
    platform: "ios",
    model: "아이폰 12 mini",
    color: "블랙",
    image: "/devices/trimmed/i03-12mini.png",
    osVersion: null as string | null,
    imageSize: { width: 278, height: 520 },
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
