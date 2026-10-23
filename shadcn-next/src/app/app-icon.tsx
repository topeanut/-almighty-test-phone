// icon.tsx와 apple-icon.tsx가 함께 쓰는 아이콘 그림. 폰 모양 위에 "TP"를 적는다.
export function AppIconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
      }}
    >
      <div
        style={{
          width: size * 0.46,
          height: size * 0.72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size * 0.08,
          border: `${size * 0.035}px solid #34d399`,
          color: "#34d399",
          fontSize: size * 0.2,
          fontWeight: 700,
        }}
      >
        TP
      </div>
    </div>
  );
}
