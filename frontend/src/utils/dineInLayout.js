import { v4 as uuid } from 'uuid';

const DEFAULT_FLOOR_NAME = '1F';

const normalizeTable = (table) => ({
  id: table?.id || uuid(),
  shape: table?.shape || 'rectangle',
  seats: Number.isFinite(Number(table?.seats)) ? Math.max(1, Number(table.seats)) : 4,
  label: (table?.label || '').trim(),
  x: typeof table?.x === 'number' ? table.x : 60,
  y: typeof table?.y === 'number' ? table.y : 60,
});

const normalizeFloor = (floor, index) => {
  const floorName = (floor?.name || '').trim() || `${index + 1}F`;
  const rawTables = Array.isArray(floor?.tables) ? floor.tables : [];

  return {
    id: floor?.id || `floor-${index + 1}`,
    name: floorName,
    tables: rawTables.map(normalizeTable),
  };
};

const buildDefaultLayout = () => ({
  version: 2,
  activeFloorId: 'floor-1',
  floors: [
    {
      id: 'floor-1',
      name: DEFAULT_FLOOR_NAME,
      tables: [],
    },
  ],
});

const parseLegacyTableList = (rawList) => {
  const grouped = new Map();

  rawList.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const floorName = (item.floor_name || item.floor || DEFAULT_FLOOR_NAME).trim() || DEFAULT_FLOOR_NAME;
    if (!grouped.has(floorName)) {
      grouped.set(floorName, []);
    }
    grouped.get(floorName).push(normalizeTable(item));
  });

  const floors = Array.from(grouped.entries()).map(([name, tables], index) => ({
    id: `floor-${index + 1}`,
    name,
    tables,
  }));

  if (floors.length === 0) {
    return buildDefaultLayout();
  }

  return {
    version: 2,
    activeFloorId: floors[0].id,
    floors,
  };
};

export const normalizeDineInLayout = (rawLayout) => {
  if (!rawLayout) {
    return buildDefaultLayout();
  }

  if (Array.isArray(rawLayout)) {
    const looksLikeFloorList = rawLayout.some((item) => Array.isArray(item?.tables));

    if (looksLikeFloorList) {
      const floors = rawLayout.map((floor, index) => normalizeFloor(floor, index));
      if (floors.length === 0) {
        return buildDefaultLayout();
      }
      return {
        version: 2,
        activeFloorId: floors[0].id,
        floors,
      };
    }

    return parseLegacyTableList(rawLayout);
  }

  if (typeof rawLayout === 'object' && Array.isArray(rawLayout.floors)) {
    const floors = rawLayout.floors.map((floor, index) => normalizeFloor(floor, index));
    if (floors.length === 0) {
      return buildDefaultLayout();
    }

    const activeFloorId = floors.some((floor) => floor.id === rawLayout.activeFloorId)
      ? rawLayout.activeFloorId
      : floors[0].id;

    return {
      version: 2,
      activeFloorId,
      floors,
    };
  }

  return buildDefaultLayout();
};

export const serializeDineInLayout = (floors, activeFloorId) => {
  const normalizedFloors = (floors || []).map((floor, index) => ({
    id: floor?.id || `floor-${index + 1}`,
    name: (floor?.name || '').trim() || `${index + 1}F`,
    tables: (floor?.tables || []).map((table) => ({
      id: table.id,
      shape: table.shape || 'rectangle',
      seats: Number.isFinite(Number(table.seats)) ? Math.max(1, Number(table.seats)) : 4,
      label: (table.label || '').trim(),
      x: typeof table.x === 'number' ? table.x : 60,
      y: typeof table.y === 'number' ? table.y : 60,
    })),
  }));

  const fallback = buildDefaultLayout();
  const targetFloors = normalizedFloors.length > 0 ? normalizedFloors : fallback.floors;
  const targetActiveFloorId = targetFloors.some((floor) => floor.id === activeFloorId)
    ? activeFloorId
    : targetFloors[0].id;

  return {
    version: 2,
    activeFloorId: targetActiveFloorId,
    floors: targetFloors,
  };
};

export const getAllTables = (floors) => {
  return (floors || []).flatMap((floor) => floor.tables || []);
};
