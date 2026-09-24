import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { MAX_STL_BYTES } from "./policy.ts";
import { formatLength, gridSpacing } from "./measurements.ts";
import type { DisplayUnit } from "./measurements.ts";

export type ViewName =
  "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";
const directions: Record<ViewName, [number, number, number]> = {
  iso: [1, -1.4, 1],
  front: [0, -1, 0],
  back: [0, 1, 0],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 0, 1],
  bottom: [0, 0, -1],
};

export class Viewer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10000);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private mesh?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private grid?: THREE.GridHelper;
  private axes?: THREE.AxesHelper;
  private center = new THREE.Vector3();
  private radius = 40;
  private view: ViewName = "iso";
  private observer: ResizeObserver;
  private ruler?: THREE.LineSegments;
  private rulerLabels: { sprite: THREE.Sprite; millimeters: number }[] = [];
  private unit: DisplayUnit = "cm";
  private contextLost: (event: Event) => void;

  constructor(
    private container: HTMLElement,
    onContextLost: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf1f3ef, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3Dモデル。ドラッグで回転、ホイールでズーム、右ドラッグで移動。タッチでは1本指で回転、2本指でズームと移動。",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.contextLost = (event) => {
      event.preventDefault();
      onContextLost();
    };
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    container.prepend(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.controls = this.createControls();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x66757a, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-40, -60, 120);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd6ede6, 1.4);
    fill.position.set(80, 30, 50);
    this.scene.add(fill);
    this.observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.fit(this.view);
    });
    this.observer.observe(container);
    this.fit("iso");
  }

  setModel(bytes: ArrayBuffer): {
    triangles: number;
    dimensions: THREE.Vector3;
    gridStep: number;
  } {
    if (bytes.byteLength < 84 || bytes.byteLength > MAX_STL_BYTES)
      throw new Error("STLデータのサイズが不正です。");
    const triangles = new DataView(bytes).getUint32(80, true);
    if (triangles === 0 || 84 + triangles * 50 !== bytes.byteLength)
      throw new Error("STLデータの形式が不正、またはモデルが空です。");
    const geometry = new STLLoader().parse(bytes);
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.array.length; i++) {
      if (
        !Number.isFinite(positions.array[i]) ||
        Math.abs(positions.array[i]) > 1e7
      ) {
        geometry.dispose();
        throw new Error(
          "モデルの座標が大きすぎるか、不正な値です。数式と寸法を確認してください。",
        );
      }
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere!.radius;
    if (!Number.isFinite(radius) || radius <= 0) {
      geometry.dispose();
      throw new Error("表示できる大きさの立体がありません。");
    }
    this.disposeModel();
    this.radius = radius;
    this.center.copy(geometry.boundingSphere!.center);
    const material = new THREE.MeshStandardMaterial({
      color: 0x39988a,
      roughness: 0.62,
      metalness: 0.07,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
    const gridStep = gridSpacing(radius);
    const size = gridStep * 20;
    this.grid = new THREE.GridHelper(size, 20, 0xb5c5bc, 0xd9e1d9);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.set(
      this.center.x,
      this.center.y,
      geometry.boundingBox!.min.z - radius * 0.005,
    );
    this.scene.add(this.grid);
    this.axes = new THREE.AxesHelper(Math.max(radius * 0.65, 5));
    this.scene.add(this.axes);
    this.addRuler(geometry.boundingBox!, gridStep);
    this.fit("iso");
    return {
      triangles,
      dimensions: geometry.boundingBox!.getSize(new THREE.Vector3()),
      gridStep,
    };
  }

  setDisplayUnit(unit: DisplayUnit) {
    this.unit = unit;
    for (const label of this.rulerLabels) {
      label.sprite.material.map?.dispose();
      label.sprite.material.map = this.labelTexture(
        formatLength(label.millimeters, unit),
      );
      label.sprite.material.needsUpdate = true;
    }
    this.draw();
  }

  private labelTexture(text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 96;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "rgba(245, 248, 243, 0.93)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#466455";
    context.font = "50px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private addRuler(bounds: THREE.Box3, step: number) {
    const width = bounds.max.x - bounds.min.x;
    const cells = Math.max(1, Math.ceil(width / step));
    const start = new THREE.Vector3(
      bounds.min.x,
      bounds.min.y - this.radius * 0.13,
      bounds.min.z,
    );
    const tick = this.radius * 0.018;
    const points = [
      start.clone(),
      start.clone().add(new THREE.Vector3(cells * step, 0, 0)),
    ];
    const labelEvery = Math.max(1, Math.ceil(cells / 5));
    for (let i = 0; i <= cells; i++) {
      const point = start.clone().add(new THREE.Vector3(i * step, 0, 0));
      points.push(
        point.clone().add(new THREE.Vector3(0, -tick, 0)),
        point.clone().add(new THREE.Vector3(0, tick, 0)),
      );
      if (i % labelEvery !== 0) continue;
      const material = new THREE.SpriteMaterial({
        map: this.labelTexture(formatLength(i * step, this.unit)),
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position
        .copy(point)
        .add(new THREE.Vector3(0, -this.radius * 0.085, 0));
      sprite.scale.set(this.radius * 0.36, this.radius * 0.108, 1);
      this.rulerLabels.push({ sprite, millimeters: i * step });
      this.scene.add(sprite);
    }
    this.ruler = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x719081 }),
    );
    this.scene.add(this.ruler);
  }

  fit(view: ViewName = "iso") {
    this.view = view;
    const vertical = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance =
      (this.radius / Math.sin(Math.min(vertical, horizontal))) * 1.2;
    const up = new THREE.Vector3(
      0,
      view === "top" ? 1 : view === "bottom" ? -1 : 0,
      view === "top" || view === "bottom" ? 0 : 1,
    );
    if (!this.camera.up.equals(up)) {
      // OrbitControls caches the up-axis transform in its constructor.
      this.controls.dispose();
      this.camera.up.copy(up);
      this.controls = this.createControls();
    }
    this.camera.position
      .copy(this.center)
      .add(
        new THREE.Vector3(...directions[view])
          .normalize()
          .multiplyScalar(distance),
      );
    this.camera.near = Math.max(this.radius / 1000, 0.00001);
    this.camera.far = Math.max(distance * 100, this.radius * 200);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.radius * 0.1;
    this.controls.maxDistance = distance * 20;
    this.controls.target.copy(this.center);
    this.controls.update();
    this.camera.lookAt(this.center);
    this.draw();
  }

  private draw() {
    this.renderer.render(this.scene, this.camera);
  }

  private createControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.addEventListener("change", () => this.draw());
    return controls;
  }

  private disposeModel() {
    if (this.ruler) {
      this.scene.remove(this.ruler);
      this.ruler.geometry.dispose();
      (this.ruler.material as THREE.Material).dispose();
      this.ruler = undefined;
    }
    for (const { sprite } of this.rulerLabels) {
      this.scene.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.rulerLabels = [];
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    for (const helper of [this.grid, this.axes]) {
      if (helper) {
        this.scene.remove(helper);
        helper.dispose();
      }
    }
  }

  dispose() {
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.observer.disconnect();
    this.controls.dispose();
    this.disposeModel();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
