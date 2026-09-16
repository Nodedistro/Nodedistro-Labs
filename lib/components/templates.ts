import type { DesignDocument } from "@/types/project";
import { demoDocument, blankDocument } from "@/lib/editor/demo";
export const templates = [
  {
    id: "sensor",
    name: "Environmental sensor",
    description:
      "ESP32 and BME280 with USB-C power. Intentionally incomplete demonstration.",
    tags: ["Wi-Fi", "I2C", "Sensors"],
    parts: [
      "esp32",
      "bme280",
      "usb-c",
      "ldo",
      "c10u",
      "c100n",
      "r10k",
      "header",
      "led",
    ],
  },
  {
    id: "mcu",
    name: "Microcontroller starter",
    description: "MCU, regulated supply, and debug header placement starter.",
    tags: ["MCU", "UART"],
    parts: ["esp32", "ldo", "c10u", "c100n", "r10k", "header"],
  },
  {
    id: "iot",
    name: "IoT sensor",
    description: "Wireless sensing subsystem with a minimal power block.",
    tags: ["IoT", "Wi-Fi"],
    parts: ["esp32", "bme280", "ldo", "c100n"],
  },
  {
    id: "usb",
    name: "USB device",
    description:
      "USB-C power connector and controller block. Data circuitry is not included.",
    tags: ["USB-C", "Power"],
    parts: ["usb-c", "esp32", "ldo", "c10u"],
  },
  {
    id: "led",
    name: "LED controller",
    description:
      "Controller and LED placement starter; add a current-limiting circuit.",
    tags: ["Lighting", "GPIO"],
    parts: ["esp32", "led", "ldo", "r10k"],
  },
  {
    id: "robotics",
    name: "Robotics controller",
    description:
      "Controller, header, and power foundation. Add motor drivers and protection.",
    tags: ["Robotics", "Control"],
    parts: ["esp32", "header", "ldo", "c10u"],
  },
  {
    id: "logger",
    name: "Data logger",
    description:
      "Sensing and controller starter. Add verified storage and timekeeping.",
    tags: ["Sensing", "Logging"],
    parts: ["esp32", "bme280", "header", "ldo"],
  },
  {
    id: "power",
    name: "Power supply module",
    description:
      "USB-C connector, linear regulator, and filter capacitor placement.",
    tags: ["Power", "3.3 V"],
    parts: ["usb-c", "ldo", "c10u"],
  },
];
export function templateDocument(id: string): DesignDocument {
  const template = templates.find((t) => t.id === id) ?? templates[0],
    d = demoDocument();
  d.name = template.name;
  d.description = template.description;
  d.components = d.components.filter((c) => template.parts.includes(c.partId));
  const ids = new Set(d.components.map((c) => c.id));
  d.nets = d.nets
    .map((n) => ({
      ...n,
      connections: n.connections.filter((c) => ids.has(c.componentId)),
    }))
    .filter((n) => n.connections.length > 1);
  d.requirements = [
    "Review all logical pins and footprints",
    "Complete missing support circuitry",
    template.description,
  ];
  d.planApproved = false;
  return d;
}
