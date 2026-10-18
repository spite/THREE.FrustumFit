import { Vector3, Matrix4 } from 'three';

// Fits the frustum of a camera around points, a box or an object, without moving or turning it: aim the camera first.

const _view = new Vector3();
const _point = new Vector3();
const _inverse = new Matrix4();
const _matrix = new Matrix4();
const _corners = Array.from( { length: 8 }, () => new Vector3() );

// the corners of a box, through a matrix if there is one
function corners( box, matrix ) {

	const { min, max } = box;

	for ( let i = 0; i < 8; i ++ ) {

		_corners[ i ].set( i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z );
		if ( matrix ) _corners[ i ].applyMatrix4( matrix );

	}

	return _corners;

}

// what the points cover in the view space of the camera
function measure( camera, points ) {

	camera.updateMatrixWorld();
	_inverse.copy( camera.matrixWorld ).invert();

	const range = {
		minX: Infinity, maxX: - Infinity, minY: Infinity, maxY: - Infinity,
		tanX: 0, tanY: 0, near: Infinity, far: - Infinity, count: 0, behind: false
	};

	for ( const point of points ) {

		_view.copy( point ).applyMatrix4( _inverse );

		// the camera looks down its -z
		const depth = - _view.z;

		range.count ++;
		range.minX = Math.min( range.minX, _view.x );
		range.maxX = Math.max( range.maxX, _view.x );
		range.minY = Math.min( range.minY, _view.y );
		range.maxY = Math.max( range.maxY, _view.y );
		range.near = Math.min( range.near, depth );
		range.far = Math.max( range.far, depth );

		if ( depth <= 0 ) {

			range.behind = true;
			continue;

		}

		range.tanX = Math.max( range.tanX, Math.abs( _view.x ) / depth );
		range.tanY = Math.max( range.tanY, Math.abs( _view.y ) / depth );

	}

	return range;

}

// near and far around the depths, with some room when they're all the same, as for something flat facing the camera
function depths( range, margin, scale ) {

	const depth = range.far - range.near;
	const room = depth > scale * 1e-6 ? depth * margin * .5 : scale * 1e-3;
	return [ range.near - room, range.far + room ];

}

// around points in world space; false if some are behind the camera, and then near is kept just in front of it
function fitPerspectiveCamera( camera, points, { keepAspect = true, margin = 0, fitDepth = true } = {} ) {

	const range = measure( camera, points );

	// nothing in front of the camera, or only right ahead of it, has no angle to fit
	if ( range.tanX === 0 && range.tanY === 0 ) return false;

	const grow = 1 + margin;
	const tanX = range.tanX * grow, tanY = range.tanY * grow;
	const free = ! keepAspect && tanX > 0 && tanY > 0;
	const tan = free ? tanY : Math.max( tanY, tanX / camera.aspect );

	camera.fov = 2 * Math.atan( tan ) * 180 / Math.PI;
	if ( free ) camera.aspect = tanX / tanY;

	if ( fitDepth ) {

		const [ near, far ] = depths( range, margin, range.far );
		camera.near = Math.max( near, range.far * 1e-4, 1e-6 );
		camera.far = far;

	}

	camera.updateProjectionMatrix();

	return ! range.behind;

}

// around points in world space, with the sides where they are, so the view can be off centre; the zoom is kept
function fitOrthographicCamera( camera, points, { keepAspect = false, margin = 0, fitDepth = true } = {} ) {

	const range = measure( camera, points );
	if ( range.count === 0 ) return false;

	const cx = ( range.minX + range.maxX ) / 2, cy = ( range.minY + range.maxY ) / 2;
	let hw = ( range.maxX - range.minX ) / 2 * ( 1 + margin );
	let hh = ( range.maxY - range.minY ) / 2 * ( 1 + margin );

	// a single point has no size to fit
	if ( hw === 0 && hh === 0 ) return false;

	// a line seen from its side has no width or no height: the aspect of the camera gives it one
	if ( keepAspect || hw === 0 || hh === 0 ) {

		const aspect = ( camera.right - camera.left ) / ( camera.top - camera.bottom );
		if ( hw / hh < aspect ) hw = hh * aspect; else hh = hw / aspect;

	}

	// three.js divides the half size by the zoom, and keeps the centre
	const zoom = camera.zoom;
	camera.left = cx - hw * zoom;
	camera.right = cx + hw * zoom;
	camera.top = cy + hh * zoom;
	camera.bottom = cy - hh * zoom;

	if ( fitDepth ) [ camera.near, camera.far ] = depths( range, margin, Math.max( hw, hh ) );

	camera.updateProjectionMatrix();

	return true;

}

// fits a camera of either kind
function fitCamera( camera, points, options ) {

	return camera.isOrthographicCamera ? fitOrthographicCamera( camera, points, options ) : fitPerspectiveCamera( camera, points, options );

}

// around a Box3, through a matrix if it's given, like the matrixWorld of what the box is of
function fitCameraToBox( camera, box, matrix, options ) {

	if ( box.isEmpty() ) return false;
	return fitCamera( camera, corners( box, matrix ), options );

}

// the points of an object and what's inside it, in world space, one at a time
function* pointsOf( object, precise ) {

	const objects = [];
	object.traverseVisible( child => objects.push( child ) );

	for ( const child of objects ) {

		const geometry = child.geometry;
		if ( geometry === undefined || geometry.attributes.position === undefined ) continue;

		// a box around all its geometries and instances
		if ( child.isBatchedMesh ) {

			child.computeBoundingBox();
			if ( ! child.boundingBox.isEmpty() ) yield* corners( child.boundingBox, child.matrixWorld );
			continue;

		}

		const instances = child.isInstancedMesh ? child.count : 1;

		if ( ! precise && geometry.boundingBox === null ) geometry.computeBoundingBox();
		if ( ! precise && geometry.boundingBox.isEmpty() ) continue;

		for ( let j = 0; j < instances; j ++ ) {

			if ( child.isInstancedMesh ) child.getMatrixAt( j, _matrix ).premultiply( child.matrixWorld );
			else _matrix.copy( child.matrixWorld );

			if ( ! precise ) {

				yield* corners( geometry.boundingBox, _matrix );
				continue;

			}

			// where the morphs and the bones put each vertex, when it's a mesh
			const position = geometry.attributes.position;
			for ( let i = 0; i < position.count; i ++ ) {

				if ( child.getVertexPosition ) child.getVertexPosition( i, _point );
				else _point.fromBufferAttribute( position, i );
				yield _point.applyMatrix4( _matrix );

			}

		}

	}

}

// around an object and its children: their vertices with precise, which is tighter and slower, or their geometries' boxes
function fitCameraToObject( camera, object, { precise = false, ...options } = {} ) {

	object.updateWorldMatrix( true, true );
	return fitCamera( camera, pointsOf( object, precise ), options );

}

export { fitCamera, fitPerspectiveCamera, fitOrthographicCamera, fitCameraToBox, fitCameraToObject };
