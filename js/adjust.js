import {
  Vector3,
  OrthographicCamera,
  Matrix4,
} from "../third_party/three.module.js";

const m = new Matrix4();

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

/** Adjusts a Perspective Camera to tightly fit a Bounding Box. */
function adjustPerspectiveToVertices(camera, vertices, keepAspectRatio = true) {
  // Get a clean camera to calculate projections.
  const cam = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 2000);
  cam.position.copy(camera.position);
  cam.rotation.copy(camera.rotation);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  m.copy(cam.matrixWorld).invert();

  let maxX = Number.MIN_SAFE_INTEGER;
  let maxY = Number.MIN_SAFE_INTEGER;
  let maxZ = Number.MIN_SAFE_INTEGER;
  let minZ = Number.MAX_SAFE_INTEGER;
  let maxFov = 0;

  // Find maximum values on projected x and y, and z in view space.
  for (const vertex of vertices) {
    const projectedVertex = vertex.clone().project(cam);
    maxX = Math.max(maxX, Math.abs(projectedVertex.x));
    maxY = Math.max(maxY, Math.abs(projectedVertex.y));
    const viewSpaceVertex = vertex.clone().applyMatrix4(m);
    maxZ = Math.max(maxZ, viewSpaceVertex.z);
    minZ = Math.min(minZ, viewSpaceVertex.z);
    // Calculate FOV for the current vertex.
    const fov =
      (2 *
        Math.atan(
          Math.max(Math.abs(projectedVertex.x), Math.abs(projectedVertex.y)) /
            (2 * -projectedVertex.z)
        ) *
        180) /
      Math.PI;
    // Keep the highest FOV.
    maxFov = Math.max(fov, maxFov);
  }

  // Update camera properties with new dimensions.
  camera.fov = maxFov;
  camera.near = -maxZ;
  camera.far = -minZ;
  if (!keepAspectRatio) {
    camera.aspect = maxX / maxY;
  }
  camera.updateProjectionMatrix();
}

function adjustPerspectiveToBB(camera, bb, keepAspectRatio = true) {
  // Get coordinates of the bounding box.
  const x1 = bb.min.x;
  const x2 = bb.max.x;
  const y1 = bb.min.y;
  const y2 = bb.max.y;
  const z1 = bb.min.z;
  const z2 = bb.max.z;

  // Build all vertices of a box defined by the bounding box.
  vertices[0].set(x1, y1, z1);
  vertices[1].set(x1, y1, z2);
  vertices[2].set(x1, y2, z1);
  vertices[3].set(x1, y2, z2);
  vertices[4].set(x2, y1, z1);
  vertices[5].set(x2, y1, z2);
  vertices[6].set(x2, y2, z1);
  vertices[7].set(x2, y2, z2);

  adjustPerspectiveToVertices(camera, vertices, keepAspectRatio);
}

export { adjustPerspectiveToBB, adjustPerspectiveToVertices };
