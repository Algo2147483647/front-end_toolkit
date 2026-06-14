const EARTH_RADIUS_METERS = 6378137;

export const DEFAULT_OPTIONS = {
  portalDistance: 320,
  layerHeight: 7,
  runout: 180,
  minRadius: 140,
  laneWidth: 3.65,
  maxGrade: 0.065,
  minimumMergeSpacing: 160,
  clearance: 5.4,
  deckDepth: 1.1,
  sampleCount: 80
};

export const SAMPLE_GRAPHS = {
  stack4: {
    nodes: [
      { id: "N", lat: 40.0000, lon: -74.0000, elevation: 0 },
      { id: "A", lat: 40.0180, lon: -74.0000, elevation: 0 },
      { id: "B", lat: 40.0000, lon: -73.9765, elevation: 0 },
      { id: "C", lat: 39.9820, lon: -74.0000, elevation: 0 },
      { id: "D", lat: 40.0000, lon: -74.0235, elevation: 0 }
    ],
    edges: [
      { id: "A_N", from: "A", to: "N", designSpeed: 100, lanesForward: 3, lanesBackward: 3, roadClass: "motorway" },
      { id: "B_N", from: "B", to: "N", designSpeed: 100, lanesForward: 3, lanesBackward: 3, roadClass: "motorway" },
      { id: "C_N", from: "C", to: "N", designSpeed: 100, lanesForward: 3, lanesBackward: 3, roadClass: "motorway" },
      { id: "D_N", from: "D", to: "N", designSpeed: 100, lanesForward: 3, lanesBackward: 3, roadClass: "motorway" }
    ]
  },
  turbine5: {
    nodes: [
      { id: "HUB", lat: 40.0000, lon: -74.0000, elevation: 1 },
      { id: "NORTH", lat: 40.0200, lon: -74.0020, elevation: 0 },
      { id: "EAST", lat: 40.0040, lon: -73.9740, elevation: 0 },
      { id: "SE", lat: 39.9840, lon: -73.9820, elevation: 0 },
      { id: "SW", lat: 39.9840, lon: -74.0200, elevation: 0 },
      { id: "WEST", lat: 40.0040, lon: -74.0270, elevation: 0 }
    ],
    edges: [
      { id: "north_spur", from: "NORTH", to: "HUB", designSpeed: 95, lanesForward: 2, lanesBackward: 2, roadClass: "motorway" },
      { id: "east_spur", from: "EAST", to: "HUB", designSpeed: 90, lanesForward: 2, lanesBackward: 2, roadClass: "motorway" },
      { id: "se_spur", from: "SE", to: "HUB", designSpeed: 80, lanesForward: 2, lanesBackward: 2, roadClass: "arterial" },
      { id: "sw_spur", from: "SW", to: "HUB", designSpeed: 80, lanesForward: 2, lanesBackward: 2, roadClass: "arterial" },
      { id: "west_spur", from: "WEST", to: "HUB", designSpeed: 90, lanesForward: 2, lanesBackward: 2, roadClass: "motorway" }
    ]
  },
  directional3: {
    nodes: [
      { id: "T", lat: 40.0000, lon: -74.0000, elevation: 0 },
      { id: "NORTH", lat: 40.0210, lon: -74.0000, elevation: 0 },
      { id: "EAST", lat: 40.0000, lon: -73.9730, elevation: 0 },
      { id: "WEST", lat: 40.0000, lon: -74.0270, elevation: 0 }
    ],
    edges: [
      { id: "north_leg", from: "NORTH", to: "T", designSpeed: 90, lanesForward: 2, lanesBackward: 2, roadClass: "motorway" },
      { id: "east_leg", from: "EAST", to: "T", designSpeed: 90, lanesForward: 2, lanesBackward: 2, roadClass: "motorway" },
      { id: "west_leg", from: "WEST", to: "T", designSpeed: 90, lanesForward: 2, lanesBackward: 2, roadClass: "motorway" }
    ]
  }
};

export function generateHighwayNetwork(inputGraph, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const geoGraph = normalizeInputGraph(inputGraph);
  const halfEdges = buildHalfEdges(geoGraph);
  const interchanges = [];
  const laneGraph = { nodes: [], edges: [] };
  const alignments = [];
  const structures = [];
  const validation = emptyValidation();

  for (const node of geoGraph.nodes) {
    const incident = halfEdges.filter((halfEdge) => halfEdge.nodeId === node.id);
    const neighborCount = new Set(incident.map((halfEdge) => halfEdge.neighborNodeId)).size;
    if (neighborCount < 2) continue;

    const interchange = generateInterchange(node, incident, settings);
    interchanges.push(interchange);
    laneGraph.nodes.push(...interchange.laneGraph.nodes);
    laneGraph.edges.push(...interchange.laneGraph.edges);
    alignments.push(...interchange.connectors.map((connector) => ({
      id: `alignment:${connector.id}:H`,
      connectorId: connector.id,
      horizontalAlignment: connector.horizontalAlignment,
      verticalProfile: connector.verticalProfile
    })));
    structures.push(...interchange.structures);
    mergeValidation(validation, interchange.validation);
  }

  validation.operationalViolations.push(...resolveGlobalOverlaps(geoGraph, interchanges, settings));

  const hardCount = validation.hardCollisions.length + validation.clearanceViolations.length;
  const designCount = validation.designViolations.length + validation.operationalViolations.length;
  const status = hardCount > 0 ? "infeasible" : designCount > 0 ? "valid-with-warnings" : "valid";
  const network = {
    geoGraph,
    halfEdges,
    interchanges,
    laneGraph,
    alignments,
    structures,
    meshes: { generatedByRenderer: true },
    validation
  };

  return {
    status,
    network,
    warnings: flattenValidation(validation),
    cost: estimateCost(network, settings)
  };
}

function normalizeInputGraph(inputGraph) {
  if (!inputGraph || !Array.isArray(inputGraph.nodes) || !Array.isArray(inputGraph.edges)) {
    throw new Error("Input graph must include nodes[] and edges[].");
  }

  const origin = inputGraph.nodes[0];
  const nodes = inputGraph.nodes.map((node) => ({
    ...node,
    elevation: Number(node.elevation ?? 0),
    local: toENU(origin, node)
  }));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = inputGraph.edges.map((edge) => {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      throw new Error(`Edge ${edge.id} references a missing node.`);
    }
    return {
      roadClass: "motorway",
      lanesForward: 2,
      lanesBackward: 2,
      designSpeed: 90,
      ...edge
    };
  });

  return {
    nodes,
    edges,
    origin: {
      lat: origin.lat,
      lon: origin.lon,
      elevation: Number(origin.elevation ?? 0)
    }
  };
}

function toENU(origin, point) {
  const lat0 = degToRad(origin.lat);
  const dLat = degToRad(point.lat - origin.lat);
  const dLon = degToRad(point.lon - origin.lon);
  return {
    x: dLon * Math.cos(lat0) * EARTH_RADIUS_METERS,
    y: Number(point.elevation ?? 0) - Number(origin.elevation ?? 0),
    z: dLat * EARTH_RADIUS_METERS
  };
}

function buildHalfEdges(geoGraph) {
  const nodeMap = new Map(geoGraph.nodes.map((node) => [node.id, node]));
  const halfEdges = [];

  for (const edge of geoGraph.edges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (edge.lanesForward > 0) {
      halfEdges.push(createHalfEdge(edge, from, to, "outgoing", edge.lanesForward));
      halfEdges.push(createHalfEdge(edge, to, from, "incoming", edge.lanesForward));
    }
    if (edge.lanesBackward > 0) {
      halfEdges.push(createHalfEdge(edge, to, from, "outgoing", edge.lanesBackward));
      halfEdges.push(createHalfEdge(edge, from, to, "incoming", edge.lanesBackward));
    }
  }

  return halfEdges;
}

function createHalfEdge(edge, node, neighbor, direction, laneCount) {
  const outward = normalize2(sub2(neighbor.local, node.local));
  return {
    id: `half:${edge.id}:${node.id}:${direction}:${neighbor.id}`,
    edgeId: edge.id,
    nodeId: node.id,
    neighborNodeId: neighbor.id,
    direction,
    bearing: bearingFromVector(outward),
    tangent: outward,
    laneCount,
    designSpeed: edge.designSpeed,
    roadClass: edge.roadClass
  };
}

function generateInterchange(node, incidentHalfEdges, settings) {
  const legs = collectAndSortIncidentLegs(node, incidentHalfEdges);
  const portals = placePortals(node, legs, settings);
  const movements = enumerateMovements(portals);
  const connectors = synthesizeConnectorRamps(movements, portals, settings);
  const conflictGraph = detectPlanViewConflicts(connectors, settings);
  const layers = colorConflictGraph(conflictGraph, connectors);
  applyLayers(connectors, layers, settings);
  solveVerticalProfiles(connectors, settings);
  const structures = generateStructures(connectors, settings);
  const validation = validateInterchange(connectors, conflictGraph, settings);
  const laneGraph = buildLaneGraph(node, portals, movements, connectors);
  const status = validation.hardCollisions.length || validation.clearanceViolations.length
    ? "infeasible"
    : validation.designViolations.length || validation.operationalViolations.length
      ? "valid-with-warnings"
      : "valid";

  return {
    id: `interchange:${node.id}`,
    anchorNodeId: node.id,
    center: node.local,
    legs,
    portals,
    movements,
    connectors,
    structures,
    conflicts: conflictGraph.conflicts,
    validation,
    laneGraph,
    status,
    radius: settings.portalDistance + settings.runout
  };
}

function collectAndSortIncidentLegs(node, incidentHalfEdges) {
  const legMap = new Map();
  for (const halfEdge of incidentHalfEdges) {
    const key = halfEdge.neighborNodeId;
    const existing = legMap.get(key) ?? {
      id: `leg:${node.id}:${key}`,
      nodeId: node.id,
      neighborNodeId: key,
      bearing: halfEdge.bearing,
      tangent: halfEdge.tangent,
      incoming: [],
      outgoing: []
    };
    existing[halfEdge.direction].push(halfEdge);
    existing.laneCount = Math.max(existing.laneCount ?? 0, halfEdge.laneCount);
    existing.designSpeed = Math.max(existing.designSpeed ?? 0, halfEdge.designSpeed);
    legMap.set(key, existing);
  }
  return [...legMap.values()].sort((a, b) => a.bearing - b.bearing);
}

function placePortals(node, legs, settings) {
  const portals = [];
  for (const leg of legs) {
    const normal = { x: -leg.tangent.z, z: leg.tangent.x };
    const sideOffset = Math.max(8, leg.laneCount * settings.laneWidth * 0.75);
    const base = add2(node.local, scale2(leg.tangent, settings.portalDistance));
    const elevation = node.local.y;

    portals.push({
      id: `portal:${node.id}:${leg.neighborNodeId}:in`,
      legId: leg.id,
      halfEdgeId: leg.incoming[0]?.id,
      role: "incoming",
      position: { x: base.x + normal.x * sideOffset, y: elevation, z: base.z + normal.z * sideOffset },
      tangent: scale2(leg.tangent, -1),
      elevation,
      laneRange: { start: 1, count: Math.max(1, leg.incoming[0]?.laneCount ?? leg.laneCount ?? 1) },
      designSpeed: leg.designSpeed
    });

    portals.push({
      id: `portal:${node.id}:${leg.neighborNodeId}:out`,
      legId: leg.id,
      halfEdgeId: leg.outgoing[0]?.id,
      role: "outgoing",
      position: { x: base.x - normal.x * sideOffset, y: elevation, z: base.z - normal.z * sideOffset },
      tangent: leg.tangent,
      elevation,
      laneRange: { start: 1, count: Math.max(1, leg.outgoing[0]?.laneCount ?? leg.laneCount ?? 1) },
      designSpeed: leg.designSpeed
    });
  }
  return portals;
}

function enumerateMovements(portals) {
  const incoming = portals.filter((portal) => portal.role === "incoming");
  const outgoing = portals.filter((portal) => portal.role === "outgoing");
  const movements = [];

  for (const from of incoming) {
    for (const to of outgoing) {
      if (from.legId === to.legId) continue;
      const turnClass = classifyTurn(from.tangent, to.tangent);
      movements.push({
        id: `movement:${from.id.split(":")[1]}:${shortPortal(from)}_to_${shortPortal(to)}`,
        fromPortalId: from.id,
        toPortalId: to.id,
        turnClass,
        priority: turnClass === "through" ? 1 : turnClass === "right" ? 2 : 3,
        allowed: true
      });
    }
  }

  return movements;
}

function synthesizeConnectorRamps(movements, portals, settings) {
  const portalMap = new Map(portals.map((portal) => [portal.id, portal]));
  return movements.map((movement) => {
    const from = portalMap.get(movement.fromPortalId);
    const to = portalMap.get(movement.toPortalId);
    const laneCount = movement.turnClass === "through"
      ? Math.min(from.laneRange.count, to.laneRange.count)
      : 1;
    const runout = movement.turnClass === "through" ? settings.runout * 1.25 : settings.runout;
    const start = from.position;
    const end = to.position;
    const c1 = add2(start, scale2(from.tangent, runout));
    const c2 = sub2(end, scale2(to.tangent, runout));
    const samples = sampleCubic(start, c1, c2, end, settings.sampleCount);
    const length = polylineLength(samples);
    const minRadius = estimateMinimumRadius(samples);

    return {
      id: `connector:${movement.id}`,
      movementId: movement.id,
      fromPortalId: from.id,
      toPortalId: to.id,
      turnClass: movement.turnClass,
      horizontalAlignment: {
        id: `alignment:${movement.id}:H`,
        segments: [
          { kind: "line", length: runout * 0.35 },
          { kind: "clothoid", length: runout * 0.3, startCurvature: 0, endCurvature: 1 / Math.max(minRadius, settings.minRadius) },
          { kind: "arc", radius: Math.max(minRadius, settings.minRadius), angle: estimateTurnAngle(from.tangent, to.tangent) },
          { kind: "clothoid", length: runout * 0.3, startCurvature: 1 / Math.max(minRadius, settings.minRadius), endCurvature: 0 },
          { kind: "line", length: runout * 0.35 }
        ],
        samples
      },
      verticalProfile: null,
      crossSection: {
        laneCount,
        laneWidth: settings.laneWidth,
        shoulderWidth: movement.turnClass === "through" ? 2.5 : 1.5
      },
      layer: 0,
      designSpeed: movement.turnClass === "through" ? Math.min(from.designSpeed, to.designSpeed) : 55,
      minRadius,
      maxGrade: settings.maxGrade,
      length
    };
  });
}

function detectPlanViewConflicts(connectors, settings) {
  const conflicts = [];
  const adjacency = new Map(connectors.map((connector) => [connector.id, new Set()]));

  for (let i = 0; i < connectors.length; i += 1) {
    for (let j = i + 1; j < connectors.length; j += 1) {
      const a = connectors[i];
      const b = connectors[j];
      if (sharePortal(a, b)) continue;
      const crossing = firstPolylineConflict(a, b, settings);
      if (!crossing) continue;
      adjacency.get(a.id).add(b.id);
      adjacency.get(b.id).add(a.id);
      conflicts.push({
        connectorA: a.id,
        connectorB: b.id,
        type: crossing.type,
        location: { x: crossing.x, y: 0, z: crossing.z },
        requiredVerticalClearance: settings.clearance + settings.deckDepth
      });
    }
  }

  return { conflicts, adjacency };
}

function colorConflictGraph(conflictGraph, connectors) {
  const colors = new Map();
  const connectorIds = connectors.map((connector) => connector.id);

  while (colors.size < connectorIds.length) {
    const uncolored = connectorIds.filter((id) => !colors.has(id));
    uncolored.sort((a, b) => {
      const saturationA = saturation(a, colors, conflictGraph.adjacency);
      const saturationB = saturation(b, colors, conflictGraph.adjacency);
      if (saturationB !== saturationA) return saturationB - saturationA;
      return (conflictGraph.adjacency.get(b)?.size ?? 0) - (conflictGraph.adjacency.get(a)?.size ?? 0);
    });

    const id = uncolored[0];
    const used = new Set(
      [...(conflictGraph.adjacency.get(id) ?? [])]
        .map((neighbor) => colors.get(neighbor))
        .filter((color) => color !== undefined)
    );
    let color = 0;
    while (used.has(color)) color += 1;
    colors.set(id, color);
  }

  const maxColor = Math.max(0, ...colors.values());
  const center = Math.floor(maxColor / 2);
  return new Map([...colors].map(([id, color]) => [id, color - center]));
}

function applyLayers(connectors, layers, settings) {
  for (const connector of connectors) {
    connector.layer = layers.get(connector.id) ?? 0;
    connector.targetElevation = connector.layer * settings.layerHeight;
  }
}

function solveVerticalProfiles(connectors, settings) {
  for (const connector of connectors) {
    const samples = connector.horizontalAlignment.samples;
    const length = Math.max(connector.length, 1);
    const stations = samples.map((sample, index) => {
      const t = index / (samples.length - 1);
      const profileLift = connector.targetElevation * Math.sin(Math.PI * t);
      const z = lerp(samples[0].y, samples[samples.length - 1].y, t) + profileLift;
      sample.y = z;
      return {
        s: t * length,
        z,
        constraint: index === 0 || index === samples.length - 1 ? "portal" : Math.abs(profileLift) > 0.1 ? "clearance" : "free"
      };
    });

    connector.verticalProfile = {
      stations,
      maxGrade: settings.maxGrade,
      verticalCurves: [
        { startS: length * 0.15, endS: length * 0.5, kind: connector.layer >= 0 ? "crest" : "sag" },
        { startS: length * 0.5, endS: length * 0.85, kind: connector.layer >= 0 ? "sag" : "crest" }
      ]
    };
    connector.maxObservedGrade = estimateMaxGrade(samples);
  }
}

function generateStructures(connectors, settings) {
  const structures = [];
  for (const connector of connectors) {
    if (connector.layer === 0) continue;
    structures.push({
      id: `structure:${connector.id}:${connector.layer > 0 ? "bridge" : "tunnel"}`,
      kind: connector.layer > 0 ? "bridge" : "tunnel",
      ownerConnectorId: connector.id,
      geometry: {
        alignmentId: connector.horizontalAlignment.id,
        width: connector.crossSection.laneCount * settings.laneWidth + connector.crossSection.shoulderWidth * 2,
        length: connector.length
      },
      clearanceEnvelope: {
        verticalClearance: settings.clearance,
        deckDepth: settings.deckDepth
      }
    });
  }
  return structures;
}

function validateInterchange(connectors, conflictGraph, settings) {
  const validation = emptyValidation();

  for (const connector of connectors) {
    if (connector.minRadius < settings.minRadius * 0.88) {
      validation.designViolations.push({
        connectorId: connector.id,
        type: "radius",
        message: `${connector.id} estimated radius ${connector.minRadius.toFixed(0)} m is below target ${settings.minRadius} m.`
      });
    }
    if (connector.maxObservedGrade > settings.maxGrade) {
      validation.designViolations.push({
        connectorId: connector.id,
        type: "grade",
        message: `${connector.id} grade ${(connector.maxObservedGrade * 100).toFixed(1)}% exceeds ${(settings.maxGrade * 100).toFixed(1)}%.`
      });
    }
    if (connector.length < settings.minimumMergeSpacing) {
      validation.operationalViolations.push({
        connectorId: connector.id,
        type: "merge-spacing",
        message: `${connector.id} is shorter than the minimum merge spacing.`
      });
    }
  }

  for (const conflict of conflictGraph.conflicts) {
    const a = connectors.find((connector) => connector.id === conflict.connectorA);
    const b = connectors.find((connector) => connector.id === conflict.connectorB);
    const verticalGap = Math.abs(a.layer - b.layer) * settings.layerHeight;
    if (verticalGap < conflict.requiredVerticalClearance) {
      validation.clearanceViolations.push({
        connectorA: a.id,
        connectorB: b.id,
        type: "clearance",
        message: `${a.id} and ${b.id} need ${conflict.requiredVerticalClearance.toFixed(1)} m clearance.`
      });
    }
    if (a.layer === b.layer) {
      validation.hardCollisions.push({
        connectorA: a.id,
        connectorB: b.id,
        type: "hard-collision",
        message: `${a.id} crosses ${b.id} on the same vertical layer.`
      });
    }
  }

  return validation;
}

function buildLaneGraph(node, portals, movements, connectors) {
  const laneNodes = portals.map((portal) => ({
    id: `lane-node:${portal.id}`,
    position: portal.position,
    kind: "portal"
  }));
  const laneEdges = [];

  for (const connector of connectors) {
    const movement = movements.find((item) => item.id === connector.movementId);
    const divergeNode = {
      id: `lane-node:${connector.id}:diverge`,
      position: connector.horizontalAlignment.samples[8],
      kind: "diverge"
    };
    const mergeNode = {
      id: `lane-node:${connector.id}:merge`,
      position: connector.horizontalAlignment.samples[connector.horizontalAlignment.samples.length - 9],
      kind: "merge"
    };
    laneNodes.push(divergeNode, mergeNode);
    laneEdges.push(
      {
        id: `lane-edge:${connector.id}:start`,
        from: `lane-node:${movement.fromPortalId}`,
        to: divergeNode.id,
        movementId: movement.id,
        laneCount: connector.crossSection.laneCount,
        speedLimit: connector.designSpeed,
        alignmentId: connector.horizontalAlignment.id
      },
      {
        id: `lane-edge:${connector.id}:body`,
        from: divergeNode.id,
        to: mergeNode.id,
        movementId: movement.id,
        laneCount: connector.crossSection.laneCount,
        speedLimit: connector.designSpeed,
        alignmentId: connector.horizontalAlignment.id
      },
      {
        id: `lane-edge:${connector.id}:end`,
        from: mergeNode.id,
        to: `lane-node:${movement.toPortalId}`,
        movementId: movement.id,
        laneCount: connector.crossSection.laneCount,
        speedLimit: connector.designSpeed,
        alignmentId: connector.horizontalAlignment.id
      }
    );
  }

  return {
    id: `lane-graph:${node.id}`,
    nodes: laneNodes,
    edges: laneEdges
  };
}

function resolveGlobalOverlaps(geoGraph, interchanges, settings) {
  const warnings = [];
  const interchangeByNode = new Map(interchanges.map((interchange) => [interchange.anchorNodeId, interchange]));
  const nodeMap = new Map(geoGraph.nodes.map((node) => [node.id, node]));
  for (const edge of geoGraph.edges) {
    const a = interchangeByNode.get(edge.from);
    const b = interchangeByNode.get(edge.to);
    if (!a || !b) continue;
    const availableLength = distance2(nodeMap.get(edge.from).local, nodeMap.get(edge.to).local);
    const requiredLength = a.radius + b.radius + settings.minimumMergeSpacing;
    if (availableLength < requiredLength) {
      warnings.push({
        edgeId: edge.id,
        type: "global-overlap",
        message: `${edge.id} has ${availableLength.toFixed(0)} m available but needs ${requiredLength.toFixed(0)} m between interchange footprints.`
      });
    }
  }
  return warnings;
}

function estimateCost(network, settings) {
  const connectors = network.interchanges.flatMap((interchange) => interchange.connectors);
  const totalRampLength = connectors.reduce((sum, connector) => sum + connector.length, 0);
  const bridgeArea = network.structures
    .filter((structure) => structure.kind === "bridge")
    .reduce((sum, structure) => sum + structure.geometry.length * structure.geometry.width, 0);
  const tunnelLength = network.structures
    .filter((structure) => structure.kind === "tunnel")
    .reduce((sum, structure) => sum + structure.geometry.length, 0);
  const layers = new Set(connectors.map((connector) => connector.layer)).size;
  const violations = flattenValidation(network.validation).length;
  return Math.round(
    totalRampLength +
    bridgeArea * 8 +
    tunnelLength * 12 +
    layers * 20 +
    violations * 1000 +
    settings.portalDistance * network.interchanges.length
  );
}

function flattenValidation(validation) {
  return [
    ...validation.hardCollisions.map((item) => ({ ...item, severity: "error" })),
    ...validation.clearanceViolations.map((item) => ({ ...item, severity: "error" })),
    ...validation.designViolations.map((item) => ({ ...item, severity: "warning" })),
    ...validation.operationalViolations.map((item) => ({ ...item, severity: "warning" }))
  ];
}

function emptyValidation() {
  return {
    hardCollisions: [],
    clearanceViolations: [],
    designViolations: [],
    operationalViolations: []
  };
}

function mergeValidation(target, source) {
  target.hardCollisions.push(...source.hardCollisions);
  target.clearanceViolations.push(...source.clearanceViolations);
  target.designViolations.push(...source.designViolations);
  target.operationalViolations.push(...source.operationalViolations);
}

function sampleCubic(start, c1, c2, end, count) {
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const inv = 1 - t;
    samples.push({
      x: inv ** 3 * start.x + 3 * inv ** 2 * t * c1.x + 3 * inv * t ** 2 * c2.x + t ** 3 * end.x,
      y: inv ** 3 * start.y + 3 * inv ** 2 * t * (c1.y ?? start.y) + 3 * inv * t ** 2 * (c2.y ?? end.y) + t ** 3 * end.y,
      z: inv ** 3 * start.z + 3 * inv ** 2 * t * c1.z + 3 * inv * t ** 2 * c2.z + t ** 3 * end.z
    });
  }
  return samples;
}

function firstPolylineConflict(a, b, settings) {
  const aSamples = a.horizontalAlignment.samples;
  const bSamples = b.horizontalAlignment.samples;
  const crossing = firstPolylineIntersection(aSamples, bSamples);
  if (crossing) return { ...crossing, type: "crossing" };

  const aWidth = a.crossSection.laneCount * settings.laneWidth + a.crossSection.shoulderWidth * 2;
  const bWidth = b.crossSection.laneCount * settings.laneWidth + b.crossSection.shoulderWidth * 2;
  const threshold = Math.max(14, (aWidth + bWidth) * 0.55);
  const near = firstPolylineProximity(aSamples, bSamples, threshold);
  if (near) return { ...near, type: "clearance" };
  return null;
}

function firstPolylineIntersection(aSamples, bSamples) {
  for (let i = 2; i < aSamples.length - 3; i += 3) {
    const a1 = aSamples[i];
    const a2 = aSamples[i + 1];
    for (let j = 2; j < bSamples.length - 3; j += 3) {
      const b1 = bSamples[j];
      const b2 = bSamples[j + 1];
      const hit = segmentIntersection(a1, a2, b1, b2);
      if (hit) return hit;
    }
  }
  return null;
}

function firstPolylineProximity(aSamples, bSamples, threshold) {
  let best = null;
  for (let i = 2; i < aSamples.length - 3; i += 3) {
    const a1 = aSamples[i];
    const a2 = aSamples[i + 1];
    for (let j = 2; j < bSamples.length - 3; j += 3) {
      const b1 = bSamples[j];
      const b2 = bSamples[j + 1];
      const candidate = segmentProximity(a1, a2, b1, b2);
      if (candidate.distance < threshold && (!best || candidate.distance < best.distance)) {
        best = candidate;
      }
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

function segmentProximity(a, b, c, d) {
  const candidates = [
    pointToSegment(a, c, d),
    pointToSegment(b, c, d),
    pointToSegment(c, a, b),
    pointToSegment(d, a, b)
  ];
  candidates.sort((left, right) => left.distance - right.distance);
  const best = candidates[0];
  return {
    distance: best.distance,
    x: (best.point.x + best.closest.x) / 2,
    z: (best.point.z + best.closest.z) / 2
  };
}

function pointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz || 1;
  const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1);
  const closest = { x: start.x + dx * t, z: start.z + dz * t };
  return {
    point,
    closest,
    distance: Math.hypot(point.x - closest.x, point.z - closest.z)
  };
}

function segmentIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.z - d.z) - (a.z - b.z) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-6) return null;
  const t = ((a.x - c.x) * (c.z - d.z) - (a.z - c.z) * (c.x - d.x)) / denominator;
  const u = -((a.x - b.x) * (a.z - c.z) - (a.z - b.z) * (a.x - c.x)) / denominator;
  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return { x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) };
  }
  return null;
}

function saturation(id, colors, adjacency) {
  return new Set(
    [...(adjacency.get(id) ?? [])]
      .map((neighbor) => colors.get(neighbor))
      .filter((color) => color !== undefined)
  ).size;
}

function estimateMinimumRadius(samples) {
  let minRadius = Number.POSITIVE_INFINITY;
  for (let i = 1; i < samples.length - 1; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const c = samples[i + 1];
    const ab = distance2(a, b);
    const bc = distance2(b, c);
    const ac = distance2(a, c);
    const area = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
    if (area < 0.001) continue;
    const radius = (ab * bc * ac) / (4 * area);
    minRadius = Math.min(minRadius, radius);
  }
  return Number.isFinite(minRadius) ? minRadius : 100000;
}

function estimateMaxGrade(samples) {
  let maxGrade = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const run = Math.max(distance2(samples[i - 1], samples[i]), 1);
    const rise = Math.abs(samples[i].y - samples[i - 1].y);
    maxGrade = Math.max(maxGrade, rise / run);
  }
  return maxGrade;
}

function estimateTurnAngle(fromTangent, toTangent) {
  const dot = clamp(fromTangent.x * toTangent.x + fromTangent.z * toTangent.z, -1, 1);
  return Math.acos(dot);
}

function classifyTurn(fromTangent, toTangent) {
  const angle = signedAngle(fromTangent, toTangent);
  const abs = Math.abs(angle);
  if (abs < Math.PI / 5) return "through";
  if (abs > Math.PI * 0.82) return "diagonal";
  return angle < 0 ? "right" : "left";
}

function sharePortal(a, b) {
  return a.fromPortalId === b.fromPortalId ||
    a.toPortalId === b.toPortalId ||
    a.fromPortalId === b.toPortalId ||
    a.toPortalId === b.fromPortalId;
}

function shortPortal(portal) {
  return portal.id.split(":").slice(2, 4).join("_");
}

function polylineLength(samples) {
  let length = 0;
  for (let i = 1; i < samples.length; i += 1) {
    length += distance3(samples[i - 1], samples[i]);
  }
  return length;
}

function signedAngle(a, b) {
  return Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);
}

function bearingFromVector(vector) {
  return (Math.atan2(vector.x, vector.z) + Math.PI * 2) % (Math.PI * 2);
}

function degToRad(value) {
  return value * Math.PI / 180;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function add2(a, b) {
  return { x: a.x + b.x, y: (a.y ?? 0) + (b.y ?? 0), z: a.z + b.z };
}

function sub2(a, b) {
  return { x: a.x - b.x, y: (a.y ?? 0) - (b.y ?? 0), z: a.z - b.z };
}

function scale2(a, scalar) {
  return { x: a.x * scalar, y: (a.y ?? 0) * scalar, z: a.z * scalar };
}

function normalize2(vector) {
  const length = Math.hypot(vector.x, vector.z) || 1;
  return { x: vector.x / length, y: 0, z: vector.z / length };
}

function distance2(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distance3(a, b) {
  return Math.hypot(a.x - b.x, (a.y ?? 0) - (b.y ?? 0), a.z - b.z);
}
