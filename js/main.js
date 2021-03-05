import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Mesh,
  MeshNormalMaterial,
  TorusKnotBufferGeometry,
  BoxHelper,
  CameraHelper,
  IcosahedronBufferGeometry,
} from "../third_party/three.module.js";
import { OrbitControls } from "../third_party/OrbitControls.js";
import { adjustPerspectiveToBB } from "./adjust.js";

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
const box = new BoxHelper(mesh, 0xffff00);
scene.add(box);

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(3, 3, 3);
camera.lookAt(scene.position);
const controls = new OrbitControls(camera, renderer.domElement);

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

function render() {
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.015;
  box.update();

  adjustPerspectiveToBB(cam, mesh.geometry.boundingBox);
  cam.lookAt(scene.position);
  helper.update();

  renderer.render(scene, camera);
  renderer.setAnimationLoop(render);
}

render();
