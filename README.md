# THREE.FrustumFit

Fits the frustum of a three.js camera tightly around points, a box or an object: the field of view of a perspective camera, the sides of an orthographic one, and the near and far planes. The camera isn't moved or turned: aim it, and the frustum is fitted to what it's looking at.

It's useful for shadow cameras, for render targets that should be filled by an object, and for near and far planes that are as close together as they can be, for the most precision in the depth buffer.

[![npm](https://img.shields.io/npm/v/three.frustum-fit.svg)](https://www.npmjs.com/package/three.frustum-fit)

#### Demos ####
- **[THREE.FrustumFit](https://spite.github.io/THREE.FrustumFit/demo/)**: a camera goes around a moving knot, and its frustum is fitted to it on every frame. The box on the bottom right is what that camera sees. Switch between a perspective and an orthographic camera, and between fitting every vertex or the box of the geometry. Space pauses
- **[Shadows](https://spite.github.io/THREE.FrustumFit/demo/shadows.html)**: the shadow camera of the sun is fitted around shapes that wander over the ground, side by side with a fixed one that covers everywhere they go. Both shadow maps are the same size, and the fitted one has texels about five times smaller. The insets show the two shadow maps. Space pauses

#### 2026 update ####
**Disclaimer:** this is from 2021, and was never published until now. three.js still has nothing that does this: `Box3.setFromObject` gives a box in world space, and libraries like camera-controls move the camera to frame something, while this changes the frustum of a camera that stays where it is

What changed from the 2021 code:

- the field of view is worked out in the view space of the camera. It was measured with an orthographic camera, against depth in normalized device coordinates, which gave the wrong angle, and the aspect wasn't taken into account
- the orthographic functions work: they threw on every call
- an orthographic camera is fitted to where the points are, off centre if they are, and keeps its zoom
- the camera is measured with its matrix in the world, not its local one, so it can be inside a group
- points behind a camera are reported, and never give a near plane behind it
- there's a margin option, a way to keep the aspect or not, and functions for a box through a matrix and for an object and what's inside it
- an object is fitted with every instance of an `InstancedMesh`, and with `precise`, with its vertices where the morphs and bones put them
- with nothing to fit, the camera is left as it was, and something flat facing the camera still gets a near and a far apart
- there are tests, TypeScript types, and an npm package
- it's an ES module that imports `three`, and the copy of three.js r127 is gone

#### How to use ####

Install it alongside three.js:

```
npm i three three.frustum-fit
```

```js
import { fitCameraToObject, fitCameraToBox, fitCamera } from 'three.frustum-fit';
```

It's a plain ES module, so it also works without a bundler as long as an import map resolves `three` (see [demo/index.html](demo/index.html)).

Aim the camera, then fit it:

```js
camera.position.set( 5, 3, 5 );
camera.lookAt( mesh.position );

fitCameraToObject( camera, mesh );
```

`fitCameraToObject( camera, object, options )` fits around an object and everything visible inside it, with every instance of an `InstancedMesh`. By default it uses the bounding box of each geometry, turned as the object is, which is fast. With `precise: true` it uses every vertex, where the morphs and bones of a mesh put it, which is the tightest fit. A `BatchedMesh` is fitted around its bounding box.

`fitCameraToBox( camera, box, matrix, options )` fits around a `Box3`. Pass a matrix, like the `matrixWorld` of the object the box belongs to, to fit around the box as it's turned and moved.

`fitCamera( camera, points, options )` fits around a list of `Vector3` in world space. `fitPerspectiveCamera` and `fitOrthographicCamera` are the same for one kind of camera.

The options are:

- `keepAspect`: keep the shape of the frustum. For a perspective camera it's true by default: the field of view grows to fit the side that needs it most. With false, the aspect changes too, for the tightest frustum. For an orthographic camera it's false by default, and the sides go where the points are
- `margin`: a part of the size to leave around, like `0.1`. 0 by default
- `fitDepth`: change near and far, true by default

They return false when there's something they can't fit. With points behind a perspective camera, the ones in front are still fitted, and near is kept in front of the camera. With nothing to fit, like no points, an empty box, a single point or an object with no geometry in it, the camera is left as it was.

A perspective frustum is fitted around the line the camera looks along, so it's tightest when the camera looks at the middle of what it's fitting.

For the shadow camera of a `DirectionalLight`, aim it as three.js will, from the light to its target, and fit it around what casts the shadows before rendering, so the whole shadow map goes to it. three.js leaves lit whatever is past the far plane, so far then has to reach where the shadows fall. On a flat ground, that's where the edges of the frustum meet it:

```js
const shadowCamera = light.shadow.camera;
shadowCamera.position.copy( light.position );
shadowCamera.lookAt( light.target.position );

fitCameraToObject( shadowCamera, casters, { margin: 0.05 } );

// the ground, at y = 0, in the space of the camera
const { normal, constant } = new Plane( new Vector3( 0, 1, 0 ), 0 ).applyMatrix4( shadowCamera.matrixWorldInverse );
for ( const x of [ shadowCamera.left, shadowCamera.right ] ) {
	for ( const y of [ shadowCamera.bottom, shadowCamera.top ] ) {
		shadowCamera.far = Math.max( shadowCamera.far, ( normal.x * x + normal.y * y + constant ) / normal.z );
	}
}
shadowCamera.updateProjectionMatrix();
```

That's with the light and its target in the scene itself, so their positions are in the world. The margin keeps the soft edges of the shadows inside the map. The [shadows demo](demo/shadows.html) does this on every frame. When the shadows fall on something that isn't flat, fit near and far around all of it first, and then the sides around what casts the shadows with `fitDepth: false`: it reaches everything, but spreads the depth over more than it needs. For a big world seen from up close, the cascaded shadow maps in the addons (`CSM`) do better: they split what the camera sees into slices, each with a shadow camera of its own.

#### Tests ####

```
npm install
npm test
```

#### License ####

MIT licensed

Copyright (C) 2021 Jaume Sanchez Elias, https://www.clicktorelease.com
