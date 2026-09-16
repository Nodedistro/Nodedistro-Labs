import {
  documentSchema,
  type DesignDocument,
  type DesignAction,
} from "@/types/project";
export function applyActions(
  source: DesignDocument,
  actions: DesignAction[],
): DesignDocument {
  const d = structuredClone(source);
  for (const a of actions) {
    const find = (id: string) => {
      const c = d.components.find((c) => c.id === id);
      if (!c) throw Error("Component no longer exists.");
      return c;
    };
    switch (a.type) {
      case "ADD_COMPONENT":
        if (
          d.components.some(
            (c) =>
              c.id === a.component.id || c.reference === a.component.reference,
          )
        )
          throw Error("Duplicate component or reference.");
        if (!d.parts.some((p) => p.id === a.component.partId))
          throw Error("Part is not in the project library.");
        d.components.push(a.component);
        break;
      case "REMOVE_COMPONENT":
        find(a.id);
        d.components = d.components.filter((c) => c.id !== a.id);
        d.nets = d.nets.map((n) => ({
          ...n,
          connections: n.connections.filter((c) => c.componentId !== a.id),
        }));
        break;
      case "CHANGE_VALUE":
        find(a.id).value = a.value;
        break;
      case "MOVE_COMPONENT":
        Object.assign(find(a.id), { x: a.x, y: a.y });
        break;
      case "REPLACE_COMPONENT": {
        const c = find(a.id);
        const part = d.parts.find((p) => p.id === a.partId);
        if (!part) throw Error("Unknown replacement part.");
        c.partId = part.id;
        c.value = part.name;
        d.nets = d.nets.map((n) => ({
          ...n,
          connections: n.connections.filter((x) => x.componentId !== c.id),
        }));
        break;
      }
      case "CREATE_NET":
        if (d.nets.some((n) => n.id === a.net.id || n.name === a.net.name))
          throw Error("Duplicate net.");
        d.nets.push(a.net);
        break;
      case "CONNECT_NET": {
        const n = d.nets.find((n) => n.id === a.netId);
        if (!n) throw Error("Net not found.");
        if (
          d.nets.some((n) =>
            n.connections.some(
              (c) => c.componentId === a.componentId && c.pinId === a.pinId,
            ),
          )
        )
          throw Error("Pin is already assigned to a net.");
        n.connections.push({ componentId: a.componentId, pinId: a.pinId });
        break;
      }
      case "DISCONNECT_NET": {
        const n = d.nets.find((n) => n.id === a.netId);
        if (!n) throw Error("Net not found.");
        n.connections = n.connections.filter(
          (c) => !(c.componentId === a.componentId && c.pinId === a.pinId),
        );
        break;
      }
      case "ADD_LABEL":
        d.annotations.push({ id: a.id, text: a.text, x: a.x, y: a.y });
        break;
      case "UPDATE_REQUIREMENT":
        if (a.index > d.requirements.length)
          throw Error("Requirement index is out of range.");
        d.requirements[a.index] = a.value;
        break;
    }
  }
  validateTopology(d);
  return documentSchema.parse(d);
}
export function validateTopology(d: DesignDocument) {
  const assigned = new Set<string>();
  for (const n of d.nets)
    for (const conn of n.connections) {
      const c = d.components.find((c) => c.id === conn.componentId);
      const part = d.parts.find((p) => p.id === c?.partId);
      if (!part?.pins.some((p) => p.id === conn.pinId))
        throw Error("Connection references a missing pin.");
      const key = conn.componentId + ":" + conn.pinId;
      if (assigned.has(key))
        throw Error("A pin cannot belong to multiple nets.");
      assigned.add(key);
    }
  if (new Set(d.components.map((c) => c.id)).size !== d.components.length)
    throw Error("Component IDs must be unique.");
  if (new Set(d.nets.map((n) => n.id)).size !== d.nets.length)
    throw Error("Net IDs must be unique.");
}
