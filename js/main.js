import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Mesh,
  MeshNormalMaterial,
  TorusKnotBufferGeometry,
  BoxHelper,
  Vector3,
  CameraHelper,
  IcosahedronBufferGeometry,
  BoxBufferGeometry,
  MeshBasicMaterial,
} from "../third_party/three.module.js";
import { OrbitControls } from "../third_party/OrbitControls.js";
import {
  adjustPerspectiveToBB,
  adjustPerspectiveToVertices,
} from "./adjust.js";

const renderer = new WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});

document.body.append(renderer.domElement);

renderer.setPixelRatio(window.devicePixelRatio);
const gl = renderer.getContext();
gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);

const scene = new Scene();
const mesh = new Mesh(
  // new IcosahedronBufferGeometry(1, 5),
  new TorusKnotBufferGeometry(1, 0.3, 100, 18),
  new MeshNormalMaterial({ wireframe: true })
);
scene.add(mesh);
// const box = new BoxHelper(mesh, 0xffff00);
// scene.add(box);

mesh.geometry.computeBoundingBox();

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(3, 3, 3);
camera.lookAt(scene.position);
const controls = new OrbitControls(camera, renderer.domElement);

const bb = mesh.geometry.boundingBox;
const box2 = new Mesh(
  new BoxBufferGeometry(
    bb.max.x - bb.min.x,
    bb.max.y - bb.min.y,
    bb.max.z - bb.min.z
  ),
  new MeshBasicMaterial({ wireframe: true })
);
scene.add(box2);

const cam = new PerspectiveCamera(75, 1, 0.1, 10);
cam.position.set(5, 5, 5);
const helper = new CameraHelper(cam);
scene.add(helper);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", () => resize());

resize();

const vertices = [
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 0),
  new Vector3(0, 0, 0),
];

function render() {
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.015;
  //box.update();

  const b = mesh.geometry.boundingBox.clone();
  b.applyMatrix4(mesh.matrix);
  box2.matrix.copy(mesh.matrix);
  box2.matrixAutoUpdate = false;

  const vertices = [];
  const t = box2.geometry.clone();
  t.applyMatrix4(mesh.matrix);
  const p = t.attributes.position.array;
  for (let j = 0; j < p.length; j += 3) {
    vertices.push(new Vector3(p[j], p[j + 1], p[j + 2]));
  }

  // adjustPerspectiveToBB(cam, b);
  adjustPerspectiveToVertices(cam, vertices);

  cam.lookAt(scene.position);
  helper.update();

  renderer.render(scene, camera);
  renderer.setAnimationLoop(render);
}

render();
