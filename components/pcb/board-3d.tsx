"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DesignDocument } from "@/types/project";
export default function Board3D({ document: d }: { document: DesignDocument }) {
  const [view, setView] = useState("Perspective");
  return (
    <div className="canvas">
      <div className="canvas-toolbar">
        {["Perspective", "Top", "Bottom"].map((v) => (
          <Button
            key={v}
            variant="ghost"
            size="sm"
            className={view === v ? "active" : ""}
            onClick={() => setView(v)}
          >
            {v}
          </Button>
        ))}
      </div>
      <Canvas
        key={view}
        camera={{
          position:
            view === "Top"
              ? [0, 90, 0.01]
              : view === "Bottom"
                ? [0, -90, 0.01]
                : [65, 75, 65],
          fov: 45,
        }}
      >
        <color attach="background" args={["#171b1e"]} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[30, 60, 10]} intensity={3} />
        <Suspense fallback={null}>
          <group>
            <mesh>
              <boxGeometry
                args={[d.board.width, d.board.thickness, d.board.height]}
              />
              <meshStandardMaterial color="#285b49" roughness={0.65} />
            </mesh>
            {d.components.map((c) => {
              const big = c.partId === "esp32",
                connector = c.partId === "usb-c" || c.partId === "header",
                w = big ? 12 : connector ? 7 : 3,
                h = big ? 3 : connector ? 4 : 1,
                l = big ? 14 : connector ? 6 : 3;
              return (
                <group
                  key={c.id}
                  position={[
                    c.pcbX - d.board.width / 2,
                    (c.side === "top" ? 1 : -1) *
                      (d.board.thickness / 2 + h / 2),
                    c.pcbY - d.board.height / 2,
                  ]}
                  rotation={[0, (c.rotation * Math.PI) / 180, 0]}
                >
                  <mesh>
                    <boxGeometry args={[w, h, l]} />
                    <meshStandardMaterial
                      color={big || connector ? "#9ca8a2" : "#282e2e"}
                      metalness={big || connector ? 0.7 : 0.1}
                      roughness={0.4}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
          <Grid
            position={[0, -5, 0]}
            args={[180, 180]}
            cellSize={5}
            sectionSize={25}
            cellColor="#293139"
            sectionColor="#343f48"
            fadeDistance={200}
          />
          <OrbitControls
            makeDefault
            enablePan
            minDistance={20}
            maxDistance={250}
          />
        </Suspense>
      </Canvas>
      <div className="canvas-label">
        SIMPLIFIED GEOMETRY · NOT STEP MODELS · DRAG TO ORBIT · SCROLL TO ZOOM
      </div>
    </div>
  );
}
