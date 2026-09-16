import type { DesignDocument } from "@/types/project";
export function BoardPreview({
  document: d,
  tint = "#295549",
}: {
  document: DesignDocument;
  tint?: string;
}) {
  return (
    <svg
      className="board-preview-svg"
      viewBox="0 0 400 230"
      role="img"
      aria-label="Simplified board placement preview"
    >
      <g transform="translate(75 25) rotate(-9 130 90)">
        <rect
          x="0"
          y="0"
          width="250"
          height="180"
          rx="8"
          fill={tint}
          stroke="#7caa8c"
          strokeWidth="1"
        />
        <rect
          x="6"
          y="6"
          width="238"
          height="168"
          rx="5"
          fill="none"
          stroke="#9abc7733"
        />
        {[
          [10, 10],
          [240, 10],
          [10, 170],
          [240, 170],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill="#191f23"
            stroke="#b9b387"
            strokeWidth="2"
          />
        ))}
        {d.nets.flatMap((n) =>
          n.connections.slice(1).map((c, i) => {
            const a = d.components.find(
                (x) => x.id === n.connections[0]?.componentId,
              ),
              b = d.components.find((x) => x.id === c.componentId);
            if (!a || !b) return null;
            return (
              <line
                key={n.id + i}
                x1={(a.pcbX / d.board.width) * 250}
                y1={(a.pcbY / d.board.height) * 180}
                x2={(b.pcbX / d.board.width) * 250}
                y2={(b.pcbY / d.board.height) * 180}
                stroke="#c6ba7044"
                strokeWidth=".7"
                strokeDasharray="2 3"
              />
            );
          }),
        )}
        {d.components.map((c) => {
          const big = c.partId === "esp32",
            connector = c.partId.includes("usb") || c.partId === "header",
            w = big ? 55 : connector ? 26 : 15,
            h = big ? 55 : connector ? 23 : 12;
          return (
            <g
              key={c.id}
              transform={`translate(${(c.pcbX / d.board.width) * 250} ${(c.pcbY / d.board.height) * 180})`}
            >
              <rect
                x={-w / 2 - 3}
                y={-h / 2 - 3}
                width={w + 6}
                height={h + 6}
                fill="none"
                stroke="#c4d5ba"
                strokeWidth=".6"
              />
              <rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                rx="1"
                fill={big ? "#8c9390" : connector ? "#93968c" : "#252b2b"}
                stroke="#424943"
              />
              {Array.from({ length: big ? 7 : 2 }, (_, i) => (
                <g key={i}>
                  <rect
                    x={-w / 2 - 3}
                    y={-h / 2 + 3 + i * (big ? 7 : 5)}
                    width="4"
                    height="3"
                    fill="#c9b886"
                  />
                  <rect
                    x={w / 2 - 1}
                    y={-h / 2 + 3 + i * (big ? 7 : 5)}
                    width="4"
                    height="3"
                    fill="#c9b886"
                  />
                </g>
              ))}
              <text
                x={0}
                y={-h / 2 - 6}
                textAnchor="middle"
                fill="#d4d8bc"
                fontSize="5"
                fontFamily="monospace"
              >
                {c.reference}
              </text>
              {big && (
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  fill="#252d29"
                  fontSize="6"
                  fontFamily="monospace"
                >
                  ESP32
                </text>
              )}
            </g>
          );
        })}
        <text x="18" y="159" fill="#c5d8bb" fontSize="8" fontFamily="monospace">
          NODEDISTRO LABS / REV A
        </text>
        <text x="18" y="169" fill="#9bb398" fontSize="5" fontFamily="monospace">
          PLACEMENT STUDY · NOT FABRICATION DATA
        </text>
      </g>
    </svg>
  );
}
