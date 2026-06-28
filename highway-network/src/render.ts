import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Connector, GenerationResult, HighwayNetwork, LaneGraph, Point3, RoadSurface, Validation } from "./generator";

const LAYER_COLORS = [
  0x59c2a6,
  0xf0b35a,
  0x8ad8ff,
  0xdb7fb6,
  0x9cc66f,
  0xc6a6ff
];
const MAIN_ROAD_VISUAL_WIDTH = 64;
const CONNECTOR_VISUAL_WIDTH = 44;
const THROUGH_CONNECTOR_VISUAL_WIDTH = 56;
const PORTAL_VISUAL_WIDTH = 48;

export class HighwayRenderer {
  host: HTMLElement;
  callbacks: { onSelect?: (connector: Connector) => void };
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  groups: Record<"roads" | "structures" | "laneGraph" | "validation", THREE.Group>;
  pickables: THREE.Mesh[];
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  result?: GenerationResult;
  animationFrame = 0;
  handleResize = () => this.onResize();
  handlePointerDown = (event: PointerEvent) => this.onPointerDown(event);

  constructor(host: HTMLElement, callbacks: { onSelect?: (connector: Connector) => void } = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1112);
    this.camera = new THREE.PerspectiveCamera(48, 1, 1, 16000);
    this.camera.position.set(860, 680, 860);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);
    this.controls.maxPolarAngle = Math.PI * 0.48;

    this.groups = {
      roads: new THREE.Group(),
      structures: new THREE.Group(),
      laneGraph: new THREE.Group(),
      validation: new THREE.Group()
    };
    Object.values(this.groups).forEach((group) => this.scene.add(group));

    this.pickables = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.setupLighting();
    this.addGround();
    this.onResize();
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("resize", this.handleResize);
    this.animate();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.65);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(900, 1200, 780);
    sun.castShadow = true;
    sun.shadow.camera.left = -1600;
    sun.shadow.camera.right = 1600;
    sun.shadow.camera.top = 1600;
    sun.shadow.camera.bottom = -1600;
    this.scene.add(sun);
  }

  addGround() {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(8000, 8000, 40, 40),
      new THREE.MeshStandardMaterial({
        color: 0x18201d,
        roughness: 0.95,
        metalness: 0.02
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    const grid = new THREE.GridHelper(8000, 80, 0x385047, 0x25332f);
    grid.position.y = 0.04;
    this.scene.add(grid);
  }

  renderNetwork(result: GenerationResult) {
    this.result = result;
    this.pickables = [];
    for (const group of Object.values(this.groups)) {
      group.clear();
    }

    const network = result.network;
    for (const surface of network.roadSurfaces ?? []) {
      this.addRoadSurface(surface);
    }
    for (const interchange of network.interchanges) {
      this.addInterchange(interchange);
    }
    this.addValidationMarkers(network.validation);
    this.frameNetwork(network);
  }

  addInterchange(interchange) {
    const centerMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(18, 18, 4, 28),
      new THREE.MeshStandardMaterial({ color: 0xf4f0e7, roughness: 0.7 })
    );
    centerMarker.position.set(interchange.center.x, 2, interchange.center.z);
    centerMarker.userData = { kind: "interchange", id: interchange.id };
    this.groups.roads.add(centerMarker);

    for (const portal of interchange.portals) {
      this.addPortalStub(interchange.center, portal);
    }

    for (const connector of interchange.connectors) {
      this.addConnector(connector);
      if (connector.layer !== 0) {
        this.addStructure(connector);
      }
    }

    this.addLaneGraph(interchange.laneGraph);
  }

  addPortalStub(center: Point3, portal) {
    const samples = [
      center,
      { x: portal.position.x, y: portal.elevation, z: portal.position.z }
    ];
    const width = Math.max(portal.laneRange.count * 3.65 + 5, PORTAL_VISUAL_WIDTH);
    const mesh = makeRibbon(samples, width, new THREE.MeshStandardMaterial({
      color: 0x596266,
      roughness: 0.7,
      metalness: 0.05
    }), 0.42);
    mesh.position.y += 0.08;
    mesh.receiveShadow = true;
    this.groups.roads.add(mesh);
  }

  addRoadSurface(surface: RoadSurface) {
    const material = new THREE.MeshStandardMaterial({
      color: 0x6b7476,
      roughness: 0.64,
      metalness: 0.02
    });
    const width = Math.max(surface.width, surface.laneCount * 10 + 18, MAIN_ROAD_VISUAL_WIDTH);
    const mesh = makeRibbon(surface.samples, width, material, 0.5);
    mesh.position.y += 0.18;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "road-surface", surface };
    this.groups.roads.add(mesh);

    const markingMaterial = new THREE.LineBasicMaterial({
      color: 0xf7f1df,
      transparent: true,
      opacity: 0.34
    });
    const points = surface.samples.map((point) => new THREE.Vector3(point.x, point.y + 0.68, point.z));
    this.groups.roads.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), markingMaterial));
  }

  addConnector(connector: Connector) {
    const width = connector.crossSection.laneCount * connector.crossSection.laneWidth + connector.crossSection.shoulderWidth * 2;
    const visualWidth = Math.max(
      width,
      connector.turnClass === "through" ? THROUGH_CONNECTOR_VISUAL_WIDTH : CONNECTOR_VISUAL_WIDTH
    );
    const material = new THREE.MeshStandardMaterial({
      color: connector.layer === 0 ? 0x717a7d : layerColor(connector.layer),
      roughness: 0.66,
      metalness: 0.04,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const mesh = makeRibbon(connector.horizontalAlignment.samples, visualWidth, material, 0.58);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "connector", connector };
    this.pickables.push(mesh);
    this.groups.roads.add(mesh);

    this.addRoadEdges(connector.horizontalAlignment.samples, visualWidth);
  }

  addRoadEdges(samples: Point3[], width: number) {
    const material = new THREE.LineBasicMaterial({
      color: 0xe8e0ca,
      transparent: true,
      opacity: 0.2
    });
    for (const side of [-1, 1]) {
      const points = offsetPolyline(samples, (width / 2 - 3) * side, 0.96);
      this.groups.roads.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }
  }

  addStructure(connector: Connector) {
    const samples = connector.horizontalAlignment.samples;
    const material = new THREE.MeshStandardMaterial({
      color: connector.layer > 0 ? 0x7d8b91 : 0x42515a,
      roughness: 0.85,
      transparent: connector.layer < 0,
      opacity: connector.layer < 0 ? 0.42 : 1
    });

    if (connector.layer < 0) {
      const width = connector.crossSection.laneCount * connector.crossSection.laneWidth + connector.crossSection.shoulderWidth * 2 + 5;
      const tunnel = makeRibbon(samples, width, material);
      tunnel.position.y -= 0.8;
      this.groups.structures.add(tunnel);
    }
  }

  addLaneGraph(laneGraph: LaneGraph) {
    const nodeById = new Map(laneGraph.nodes.map((node) => [node.id, node]));
    const material = new THREE.LineBasicMaterial({
      color: 0x8ad8ff,
      transparent: true,
      opacity: 0.35
    });
    for (const edge of laneGraph.edges) {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) continue;
      const points = [
        new THREE.Vector3(from.position.x, from.position.y + 1.1, from.position.z),
        new THREE.Vector3(to.position.x, to.position.y + 1.1, to.position.z)
      ];
      this.groups.laneGraph.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }
  }

  addValidationMarkers(validation: Validation) {
    const issues = [
      ...validation.hardCollisions,
      ...validation.clearanceViolations,
      ...validation.designViolations,
      ...validation.operationalViolations
    ];
    for (const issue of issues) {
      const connector = this.findConnector(issue.connectorId || issue.connectorA);
      if (!connector) continue;
      const sample = connector.horizontalAlignment.samples[Math.floor(connector.horizontalAlignment.samples.length / 2)];
      const isError = issue.type === "hard-collision" || issue.type === "clearance";
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(5, 5, 2.5, 18),
        new THREE.MeshStandardMaterial({
          color: isError ? 0xef6a6a : 0xf2d075,
          roughness: 0.8,
          metalness: 0
        })
      );
      marker.position.set(sample.x, sample.y + 3.5, sample.z);
      marker.userData = { kind: "issue", issue };
      this.groups.validation.add(marker);
    }
  }

  findConnector(id?: string) {
    if (!this.result || !id) return null;
    return this.result.network.interchanges
      .flatMap((interchange) => interchange.connectors)
      .find((connector) => connector.id === id);
  }

  setVisibility(target: "roads" | "structures" | "laneGraph" | "validation", visible: boolean) {
    if (this.groups[target]) {
      this.groups[target].visible = visible;
    }
  }

  countSceneObjects() {
    let count = 0;
    this.scene.traverse(() => {
      count += 1;
    });
    return {
      total: count,
      roads: this.groups.roads.children.length,
      structures: this.groups.structures.children.length,
      laneGraph: this.groups.laneGraph.children.length,
      validation: this.groups.validation.children.length,
      pickables: this.pickables.length
    };
  }

  sampleCanvasPixels() {
    const gl = this.renderer.getContext();
    const canvas = this.renderer.domElement;
    const samples = [];
    const points = [
      [0.5, 0.5],
      [0.4, 0.45],
      [0.6, 0.55],
      [0.5, 0.35],
      [0.5, 0.65],
      [0.3, 0.5],
      [0.7, 0.5],
      [0.45, 0.6],
      [0.55, 0.4]
    ];
    this.renderer.render(this.scene, this.camera);
    for (const [xRatio, yRatio] of points) {
      const x = Math.floor(canvas.width * xRatio);
      const y = Math.floor(canvas.height * yRatio);
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      samples.push([...pixel]);
    }
    const nonBlank = samples.filter(([red, green, blue, alpha]) => alpha > 0 && red + green + blue > 24).length;
    return {
      width: canvas.width,
      height: canvas.height,
      nonBlank,
      ok: nonBlank >= 5,
      samples
    };
  }

  resetCamera() {
    this.camera.position.set(860, 680, 860);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  frameNetwork(network: HighwayNetwork) {
    const points = network.interchanges.flatMap((interchange) => [
      interchange.center,
      ...interchange.portals.map((portal) => portal.position)
    ]);
    points.push(...network.roadSurfaces.flatMap((surface) => surface.samples));
    if (!points.length) return;
    const bounds = new THREE.Box3();
    for (const point of points) {
      bounds.expandByPoint(new THREE.Vector3(point.x, point.y, point.z));
    }
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, 700);
    this.controls.target.copy(center);
    this.camera.position.set(center.x + radius * 0.78, Math.max(420, radius * 0.62), center.z + radius * 0.78);
    this.camera.near = 1;
    this.camera.far = Math.max(16000, radius * 8);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  onPointerDown(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (!hits.length) return;
    this.callbacks.onSelect?.(hits[0].object.userData.connector);
  }

  onResize() {
    const rect = this.host.getBoundingClientRect();
    this.camera.aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.handleResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.controls.dispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose?.();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function makeRibbon(samples: Point3[], width: number, material: THREE.Material, lift = 0.12) {
  const positions = [];
  const normals = [];
  const indices = [];
  const halfWidth = width / 2;

  for (let i = 0; i < samples.length; i += 1) {
    const previous = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const normal = { x: -dz / length, z: dx / length };
    const point = samples[i];
    positions.push(point.x + normal.x * halfWidth, point.y + lift, point.z + normal.z * halfWidth);
    positions.push(point.x - normal.x * halfWidth, point.y + lift, point.z - normal.z * halfWidth);
    normals.push(0, 1, 0, 0, 1, 0);
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

function offsetPolyline(samples: Point3[], offset: number, lift: number) {
  return samples.map((point, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const normal = { x: -dz / length, z: dx / length };
    return new THREE.Vector3(
      point.x + normal.x * offset,
      point.y + lift,
      point.z + normal.z * offset
    );
  });
}

function layerColor(layer: number) {
  const index = Math.abs(layer) % LAYER_COLORS.length;
  const color = new THREE.Color(LAYER_COLORS[index]);
  if (layer < 0) color.multiplyScalar(0.78);
  if (layer === 0) color.setHex(0x46515a);
  return color;
}
