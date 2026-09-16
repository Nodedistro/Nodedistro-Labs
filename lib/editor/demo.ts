import { catalog } from "@/lib/components/catalog";
import type { DesignDocument, Project, EngineeringPlan } from "@/types/project";
export function blankDocument(name = "Untitled project"): DesignDocument {
  return {
    name,
    description: "",
    requirements: [],
    components: [],
    nets: [],
    parts: catalog,
    traces: [],
    vias: [],
    annotations: [],
    board: {
      width: 60,
      height: 45,
      layers: 2,
      thickness: 1.6,
      copperWeight: 1,
      finish: "ENIG",
      mask: "Green",
    },
    rules: {
      minWidth: 0.2,
      clearance: 0.2,
      viaDiameter: 0.6,
      viaDrill: 0.3,
      edgeClearance: 0.3,
      differentialGap: 0.2,
    },
    suppressions: [],
    planApproved: false,
  };
}
export function demoDocument(): DesignDocument {
  const doc = blankDocument("Wi-Fi Environmental Sensor");
  doc.description =
    "A compact USB-C powered sensor for temperature, humidity, and pressure. Built around the ESP32 and BME280.";
  doc.requirements = [
    "USB-C 5 V input",
    "Wi-Fi and Bluetooth connectivity",
    "Temperature, humidity, and pressure sensing",
    "60 × 45 mm, 2-layer prototype",
  ];
  const specs: [
    string,
    string,
    string,
    number,
    number,
    number,
    number,
    string,
  ][] = [
    ["j1", "usb-c", "J1", 60, 150, 4, 22, "Power input"],
    ["u2", "ldo", "U2", 380, 150, 16, 20, "Power input"],
    ["c1", "c10u", "C1", 210, 370, 10, 30, "Power input"],
    ["c2", "c10u", "C2", 470, 370, 22, 28, "Power input"],
    ["u1", "esp32", "U1", 740, 140, 33, 17, "Microcontroller"],
    ["r1", "r10k", "R1", 700, 440, 26, 34, "Microcontroller"],
    ["c3", "c100n", "C3", 930, 440, 42, 33, "Microcontroller"],
    ["u3", "bme280", "U3", 1160, 150, 50, 16, "Environmental sensing"],
    ["j2", "header", "J2", 1160, 450, 52, 34, "Debug & status"],
    ["d1", "led", "D1", 740, 690, 35, 38, "Debug & status"],
  ];
  doc.components = specs.map(
    ([id, partId, reference, x, y, pcbX, pcbY, block]) => ({
      id,
      partId,
      reference,
      value: catalog.find((p) => p.id === partId)!.name,
      x,
      y,
      pcbX,
      pcbY,
      block,
      rotation: 0,
      side: "top",
    }),
  );
  doc.nets = [
    {
      id: "5v",
      name: "+5V",
      connections: [
        { componentId: "j1", pinId: "1" },
        { componentId: "u2", pinId: "1" },
        { componentId: "c1", pinId: "1" },
      ],
    },
    {
      id: "3v3",
      name: "+3V3",
      connections: [
        { componentId: "u2", pinId: "4" },
        { componentId: "u1", pinId: "1" },
        { componentId: "u3", pinId: "1" },
        { componentId: "c2", pinId: "1" },
        { componentId: "c3", pinId: "1" },
        { componentId: "r1", pinId: "1" },
        { componentId: "j2", pinId: "1" },
      ],
    },
    {
      id: "gnd",
      name: "GND",
      connections: specs
        .filter((s) => s[0] !== "r1")
        .map((s) => ({ componentId: s[0], pinId: "2" })),
    },
    {
      id: "sda",
      name: "I2C_SDA",
      connections: [
        { componentId: "u1", pinId: "4" },
        { componentId: "u3", pinId: "3" },
      ],
    },
    {
      id: "scl",
      name: "I2C_SCL",
      connections: [
        { componentId: "u1", pinId: "5" },
        { componentId: "u3", pinId: "4" },
      ],
    },
    {
      id: "en",
      name: "MCU_EN",
      connections: [
        { componentId: "r1", pinId: "2" },
        { componentId: "u1", pinId: "3" },
      ],
    },
    {
      id: "tx",
      name: "UART_TX",
      connections: [
        { componentId: "u1", pinId: "6" },
        { componentId: "j2", pinId: "3" },
      ],
    },
    {
      id: "rx",
      name: "UART_RX",
      connections: [
        { componentId: "u1", pinId: "7" },
        { componentId: "j2", pinId: "4" },
      ],
    },
  ];
  // Intentionally unrouted, incomplete demonstration; checks surface missing connections.
  return doc;
}
export function demoProject(): Project {
  return {
    id: "demo-sensor",
    document: demoDocument(),
    revision: 0,
    updatedAt: "2026-09-14T12:00:00.000Z",
    starred: true,
    isPublic: false,
    demo: true,
    role: "owner",
  };
}
export const samplePlan: EngineeringPlan = {
  summary:
    "USB-C powered environmental sensor with Wi-Fi and Bluetooth. This is a static example plan, not an AI-generated or validated design.",
  requirements: [
    "5 V USB-C input",
    "Measure temperature, humidity, and pressure",
    "Wi-Fi + Bluetooth",
    "60 × 45 mm prototype",
  ],
  architecture: [
    "USB-C → protection → 3.3 V supply → ESP32",
    "BME280 → I2C → ESP32 → wireless network",
  ],
  blocks: [
    {
      name: "Power input",
      purpose: "Provide regulated 3.3 V from USB-C input.",
      components: [
        "USB-C receptacle",
        "AP2112K regulator",
        "Input and output capacitors",
      ],
    },
    {
      name: "Microcontroller",
      purpose: "Process sensor readings and provide connectivity.",
      components: ["ESP32 module", "Enable pull-up", "Decoupling"],
    },
    {
      name: "Environmental sensing",
      purpose: "Acquire environmental data over I2C.",
      components: ["BME280", "I2C pull-ups"],
    },
    {
      name: "Debug & status",
      purpose: "Expose programming and status signals.",
      components: ["UART header", "Status LED"],
    },
  ],
  powerTree: [
    "USB-C VBUS: nominal 5 V",
    "3.3 V LDO: size for peak radio current",
  ],
  components: [
    {
      partId: "esp32",
      reason: "Integrated wireless connectivity reduces RF design complexity.",
    },
    {
      partId: "bme280",
      reason: "Integrates three environmental measurements.",
    },
    { partId: "usb-c", reason: "Common reversible power input." },
    {
      partId: "ldo",
      reason: "Simple regulation; verify thermal and transient margins.",
    },
  ],
  interfaces: ["I2C for sensing", "UART for programming"],
  constraints: [
    "Respect module antenna keep-out",
    "Review regulator dissipation under peak load",
  ],
  risks: [
    "Demo omits USB-C CC resistors and protection",
    "I2C pull-ups and LED resistor must be added",
    "Simplified logical symbols are not verified pin-complete libraries",
  ],
  assumptions: [
    "Prototype, indoor environment",
    "No battery operation",
    "Estimated catalog prices, no live inventory",
  ],
  nextSteps: [
    "Verify every manufacturer datasheet",
    "Complete support circuitry",
    "Run electrical checks",
    "Review and route the PCB",
  ],
};
