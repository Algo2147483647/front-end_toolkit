import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const LAYER_COLORS = [
  0x59c2a6,
  0xf0b35a,
  0x8ad8ff,
  0xdb7fb6,
  0x9cc66f,
  0xc6a6ff
];

export class HighwayRenderer {
  constructor(host, callbacks = {}) {
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
    this.renderer.domElement.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    window.addEventListener("resize", () => this.onResize());
    this.animate();
  }

  setupLighting() {
    const ambient = new THREE.HemisphereLight(0xdcefff, 0x1b2224, 2.2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 3.4);
    sun.position.set(800, 1200, 640);
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

  renderNetwork(result) {
    this.result = result;
    this.pickables = [];
    for (const group of Object.values(this.groups)) {
      group.clear();
    }

    const network = result.network;
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

  addPortalStub(center, portal) {
    const samples = [
      center,
      { x: portal.position.x, y: portal.elevation, z: portal.position.z }
    ];
    const width = portal.laneRange.count * 3.65 + 5;
    const mesh = makeRibbon(samples, width, new THREE.MeshStandardMaterial({
      color: 0x30363a,
      roughness: 0.8,
      metalness: 0.05
    }));
    mesh.position.y += 0.08;
    mesh.receiveShadow = true;
    this.groups.roads.add(mesh);
  }

  addConnector(connector) {
    const color = layerColor(connector.layer);
    const width = connector.crossSection.laneCount * connector.crossSection.laneWidth + connector.crossSection.shoulderWidth * 2;
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.04,
      emissive: connector.turnClass === "through" ? 0x08231d : 0x1a1205,
      emissiveIntensity: 0.25
    });
    const mesh = makeRibbon(connector.horizontalAlignment.samples, width, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "connector", connector };
    this.pickables.push(mesh);
    this.groups.roads.add(mesh);

    this.addLaneMarkings(connector.horizontalAlignment.samples);
  }

  addLaneMarkings(samples) {
    const material = new THREE.LineBasicMaterial({
      color: 0xf4f0e7,
      transparent: true,
      opacity: 0.48
    });
    const points = samples.map((point) => new THREE.Vector3(point.x, point.y + 0.18, point.z));
    this.groups.roads.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  addStructure(connector) {
    const samples = connector.horizontalAlignment.samples;
    const material = new THREE.MeshStandardMaterial({
      color: connector.layer > 0 ? 0x7d8b91 : 0x42515a,
      roughness: 0.85,
      transparent: connector.layer < 0,
      opacity: connector.layer < 0 ? 0.42 : 1
    });

    if (connector.layer > 0) {
      for (let i = 8; i < samples.length - 8; i += 14) {
        const point = samples[i];
        if (point.y < 2.5) continue;
        const pier = new THREE.Mesh(
          new THREE.CylinderGeometry(2.5, 3.4, Math.max(point.y, 2), 12),
          material
        );
        pier.position.set(point.x, point.y / 2, point.z);
        pier.castShadow = true;
        this.groups.structures.add(pier);
      }
    } else {
      const width = connector.crossSection.laneCount * connector.crossSection.laneWidth + connector.crossSection.shoulderWidth * 2 + 5;
      const tunnel = makeRibbon(samples, width, material);
      tunnel.position.y -= 0.8;
      this.groups.structures.add(tunnel);
    }
  }

  addLaneGraph(laneGraph) {
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

  addValidationMarkers(validation) {
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
        new THREE.SphereGeometry(8, 20, 20),
        new THREE.MeshBasicMaterial({ color: isError ? 0xef6a6a : 0xf2d075 })
      );
      marker.position.set(sample.x, sample.y + 12, sample.z);
      marker.userData = { kind: "issue", issue };
      this.groups.validation.add(marker);
    }
  }

  findConnector(id) {
    if (!this.result || !id) return null;
    return this.result.network.interchanges
      .flatMap((interchange) => interchange.connectors)
      .find((connector) => connector.id === id);
  }

  setVisibility(target, visible) {
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

  frameNetwork(network) {
    const points = network.interchanges.flatMap((interchange) => [
      interchange.center,
      ...interchange.portals.map((portal) => portal.position)
    ]);
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

  onPointerDown(event) {
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
    requestAnimationFrame(() => this.animate());
  }
}

function makeRibbon(samples, width, material) {
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
    positions.push(point.x + normal.x * halfWidth, point.y + 0.12, point.z + normal.z * halfWidth);
    positions.push(point.x - normal.x * halfWidth, point.y + 0.12, point.z - normal.z * halfWidth);
    normals.push(0, 1, 0, 0, 1, 0);
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

function layerColor(layer) {
  const index = Math.abs(layer) % LAYER_COLORS.length;
  const color = new THREE.Color(LAYER_COLORS[index]);
  if (layer < 0) color.multiplyScalar(0.78);
  if (layer === 0) color.setHex(0x46515a);
  return color;
}
