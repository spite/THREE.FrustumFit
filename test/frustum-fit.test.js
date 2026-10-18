import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, OrthographicCamera, Vector3, Box3, Matrix4, Mesh, Group, TorusKnotGeometry, BoxGeometry, PlaneGeometry, InstancedMesh } from 'three';
import { fitPerspectiveCamera, fitOrthographicCamera, fitCameraToBox, fitCameraToObject, fitCamera } from '../src/frustum-fit.js';

// a seeded random, so a failure can be run again
let seed = 1;
const random = () => ( seed = ( seed * 16807 ) % 2147483647 ) / 2147483647;
const range = ( a, b ) => a + random() * ( b - a );

function cloud( n, center, size ) {

	return Array.from( { length: n }, () => new Vector3( range( - 1, 1 ), range( - 1, 1 ), range( - 1, 1 ) ).multiplyScalar( size ).add( center ) );

}

function aimed( camera ) {

	camera.position.set( range( - 20, 20 ), range( - 20, 20 ), range( - 20, 20 ) );
	camera.lookAt( range( - 2, 2 ), range( - 2, 2 ), range( - 2, 2 ) );
	camera.updateMatrixWorld();
	return camera;

}

// where the points land in normalized device coordinates
function ndc( camera, points ) {

	camera.updateMatrixWorld();
	const p = points.map( v => v.clone().project( camera ) );
	const axis = k => [ Math.min( ...p.map( v => v[ k ] ) ), Math.max( ...p.map( v => v[ k ] ) ) ];
	return { x: axis( 'x' ), y: axis( 'y' ), z: axis( 'z' ) };

}

const EPS = 1e-6;

test( 'a perspective camera keeps its aspect and fits all the points, touching the sides that limit it', () => {

	for ( let i = 0; i < 200; i ++ ) {

		const camera = aimed( new PerspectiveCamera( 50, range( .5, 2.5 ), .1, 1000 ) );
		const points = cloud( 40, new Vector3( range( - 2, 2 ), range( - 2, 2 ), range( - 2, 2 ) ), range( .5, 4 ) );
		const aspect = camera.aspect;

		assert.equal( fitPerspectiveCamera( camera, points ), true );
		const r = ndc( camera, points );

		assert.equal( camera.aspect, aspect );
		for ( const k of 'xyz' ) assert.ok( r[ k ][ 0 ] >= - 1 - EPS && r[ k ][ 1 ] <= 1 + EPS, `${ k } ${ r[ k ] }` );
		assert.ok( Math.abs( Math.max( - r.x[ 0 ], r.x[ 1 ], - r.y[ 0 ], r.y[ 1 ] ) - 1 ) < 1e-6, 'touches a side' );
		assert.ok( Math.abs( r.z[ 0 ] + 1 ) < 1e-5 && Math.abs( r.z[ 1 ] - 1 ) < 1e-5, 'touches near and far' );

	}

} );

test( 'without keeping the aspect it fits both ways', () => {

	for ( let i = 0; i < 100; i ++ ) {

		const camera = aimed( new PerspectiveCamera( 50, 1, .1, 1000 ) );
		const points = cloud( 30, new Vector3(), range( .5, 4 ) );
		fitPerspectiveCamera( camera, points, { keepAspect: false } );
		const r = ndc( camera, points );
		assert.ok( Math.abs( Math.max( - r.x[ 0 ], r.x[ 1 ] ) - 1 ) < 1e-6 && Math.abs( Math.max( - r.y[ 0 ], r.y[ 1 ] ) - 1 ) < 1e-6 );

	}

} );

test( 'a margin leaves room around', () => {

	const camera = aimed( new PerspectiveCamera( 50, 1.5, .1, 1000 ) );
	const points = cloud( 30, new Vector3(), 2 );
	fitPerspectiveCamera( camera, points, { margin: .2 } );
	const r = ndc( camera, points );
	assert.ok( Math.abs( Math.max( - r.x[ 0 ], r.x[ 1 ], - r.y[ 0 ], r.y[ 1 ] ) - 1 / 1.2 ) < 1e-6 );
	assert.ok( r.z[ 0 ] > - 1 && r.z[ 1 ] < 1 );

} );

test( 'points behind the camera are reported, and near stays in front', () => {

	const camera = new PerspectiveCamera( 50, 1, .1, 100 );
	camera.updateMatrixWorld();
	const points = [ new Vector3( 0, 0, - 5 ), new Vector3( 1, 1, - 10 ), new Vector3( 0, 0, 3 ) ];
	assert.equal( fitPerspectiveCamera( camera, points ), false );
	assert.ok( camera.near > 0 && camera.far === 10 );

} );

test( 'an orthographic camera fits the points to its sides, off centre if they are, at any zoom', () => {

	for ( let i = 0; i < 200; i ++ ) {

		const camera = aimed( new OrthographicCamera( - 1, 1, 1, - 1, .1, 1000 ) );
		camera.zoom = range( .5, 3 );
		const points = cloud( 40, new Vector3( range( - 3, 3 ), range( - 3, 3 ), range( - 3, 3 ) ), range( .5, 4 ) );

		fitOrthographicCamera( camera, points );
		const r = ndc( camera, points );
		for ( const k of 'xyz' ) assert.ok( Math.abs( r[ k ][ 0 ] + 1 ) < 1e-6 && Math.abs( r[ k ][ 1 ] - 1 ) < 1e-6, `${ k } ${ r[ k ] }` );

	}

} );

test( 'an orthographic camera can keep its aspect', () => {

	const camera = aimed( new OrthographicCamera( - 2, 2, 1, - 1, .1, 1000 ) );
	const points = cloud( 40, new Vector3(), 3 );
	fitOrthographicCamera( camera, points, { keepAspect: true } );
	const r = ndc( camera, points );
	assert.ok( Math.abs( ( camera.right - camera.left ) / ( camera.top - camera.bottom ) - 2 ) < 1e-9 );
	assert.ok( Math.abs( Math.max( r.x[ 1 ] - r.x[ 0 ], r.y[ 1 ] - r.y[ 0 ] ) - 2 ) < 1e-6 );

} );

test( 'boxes, boxes through a matrix, and objects', () => {

	const camera = aimed( new PerspectiveCamera( 50, 1.3, .1, 1000 ) );
	const box = new Box3( new Vector3( - 1, - 2, - .5 ), new Vector3( 2, 1, 1 ) );
	const matrix = new Matrix4().makeRotationY( .7 ).setPosition( 1, 0, - 1 );

	fitCameraToBox( camera, box, matrix );
	const corners = [];
	for ( let i = 0; i < 8; i ++ ) corners.push( new Vector3( i & 1 ? 2 : - 1, i & 2 ? 1 : - 2, i & 4 ? 1 : - .5 ).applyMatrix4( matrix ) );
	const r = ndc( camera, corners );
	assert.ok( Math.abs( Math.max( - r.x[ 0 ], r.x[ 1 ], - r.y[ 0 ], r.y[ 1 ] ) - 1 ) < 1e-6 );

	// an object: tighter around its vertices than around the box of its geometry
	const group = new Group();
	const knot = new Mesh( new TorusKnotGeometry( 1, .3, 64, 8 ) );
	knot.rotation.set( .4, 1.1, .2 );
	knot.position.set( .5, 0, 0 );
	group.add( knot, new Mesh( new BoxGeometry( .5, .5, .5 ) ) );
	group.position.set( 0, 1, 0 );

	const loose = aimed( new PerspectiveCamera( 50, 1, .1, 1000 ) );
	const tight = loose.clone();
	fitCameraToObject( loose, group );
	fitCameraToObject( tight, group, { precise: true } );
	assert.ok( tight.fov <= loose.fov + 1e-9 && tight.far - tight.near <= loose.far - loose.near + 1e-9 );

	const ortho = aimed( new OrthographicCamera() );
	assert.equal( fitCamera( ortho, corners ), true );
	assert.equal( fitCameraToObject( loose, new Group() ), false );

} );

test( 'the shadow camera of a directional light, as the README shows it', async () => {

	const { DirectionalLight, Scene, Plane } = await import( 'three' );
	const scene = new Scene();
	const knot = new Mesh( new TorusKnotGeometry( 1, .3, 64, 8 ) );
	knot.position.set( 1, 2.5, - 2 );
	const casters = new Group().add( knot );

	const light = new DirectionalLight();
	light.position.set( 4, 8, 3 );
	light.target.position.set( 0, 0, - 1 );
	scene.add( casters, light, light.target );
	scene.updateMatrixWorld();

	const shadowCamera = light.shadow.camera;
	shadowCamera.position.copy( light.position );
	shadowCamera.lookAt( light.target.position );

	fitCameraToObject( shadowCamera, casters, { margin: 0.05 } );

	const { normal, constant } = new Plane( new Vector3( 0, 1, 0 ), 0 ).applyMatrix4( shadowCamera.matrixWorldInverse );
	for ( const x of [ shadowCamera.left, shadowCamera.right ] ) {
		for ( const y of [ shadowCamera.bottom, shadowCamera.top ] ) {
			shadowCamera.far = Math.max( shadowCamera.far, ( normal.x * x + normal.y * y + constant ) / normal.z );
		}
	}
	shadowCamera.updateProjectionMatrix();

	// what the renderer does before drawing the shadow map
	light.shadow.updateMatrices( light );

	// every vertex is in the map, and the box of the geometry touches it, with the margin around
	const position = knot.geometry.attributes.position;
	const points = Array.from( { length: position.count }, ( _, i ) => new Vector3().fromBufferAttribute( position, i ).applyMatrix4( knot.matrixWorld ) );
	const r = ndc( shadowCamera, points );
	for ( const k of 'xyz' ) assert.ok( r[ k ][ 0 ] >= - 1 && r[ k ][ 1 ] <= 1, `${ k } ${ r[ k ] }` );

	const { min, max } = knot.geometry.boundingBox;
	const box = ndc( shadowCamera, Array.from( { length: 8 }, ( _, i ) => new Vector3( i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z ).applyMatrix4( knot.matrixWorld ) ) );
	for ( const k of 'xy' ) assert.ok( Math.abs( - box[ k ][ 0 ] - 1 / 1.05 ) < 1e-6 && Math.abs( box[ k ][ 1 ] - 1 / 1.05 ) < 1e-6, `${ k } ${ box[ k ] }` );

	// where its shadow falls on the ground is in front of far, or three.js would leave it lit, and far goes no further than the ground
	const direction = new Vector3().subVectors( light.target.position, light.position ).normalize();
	const shadow = ndc( shadowCamera, points.map( p => p.clone().addScaledVector( direction, - p.y / direction.y ) ) );
	assert.ok( shadow.z[ 1 ] <= 1, `${ shadow.z }` );

	const corners = [ - 1, 1 ].flatMap( x => [ - 1, 1 ].map( y => new Vector3( x, y, 1 ).unproject( shadowCamera ) ) );
	assert.ok( Math.min( ...corners.map( c => Math.abs( c.y ) ) ) < 1e-6, 'far touches the ground at the deepest corner' );

} );

test( 'with a ground that is not flat, near and far around it and the sides around what casts the shadows', async () => {

	const { DirectionalLight } = await import( 'three' );
	const hills = new Mesh( new BoxGeometry( 20, 2, 20 ) );
	const knot = new Mesh( new TorusKnotGeometry( 1, .3, 64, 8 ) );
	knot.position.set( 0, 4, 0 );
	const receivers = new Group().add( hills, knot );

	const light = new DirectionalLight();
	light.position.set( 4, 8, 3 );
	const shadowCamera = light.shadow.camera;
	shadowCamera.position.copy( light.position );
	shadowCamera.lookAt( light.target.position );

	fitCameraToObject( shadowCamera, receivers );
	const { near, far } = shadowCamera;
	fitCameraToObject( shadowCamera, knot, { fitDepth: false, precise: true } );

	assert.equal( shadowCamera.near, near );
	assert.equal( shadowCamera.far, far );
	const position = knot.geometry.attributes.position;
	const r = ndc( shadowCamera, Array.from( { length: position.count }, ( _, i ) => new Vector3().fromBufferAttribute( position, i ).applyMatrix4( knot.matrixWorld ) ) );
	assert.ok( Math.abs( Math.max( - r.x[ 0 ], r.x[ 1 ] ) - 1 ) < 1e-6 && Math.abs( Math.max( - r.y[ 0 ], r.y[ 1 ] ) - 1 ) < 1e-6 );

} );

test( 'with nothing to fit, the camera is left as it was', () => {

	const state = c => JSON.stringify( [ c.fov, c.aspect, c.left, c.right, c.top, c.bottom, c.near, c.far, c.projectionMatrix.elements ] );

	const cases = {
		'no points': c => fitCamera( c, [] ),
		'an empty box': c => fitCameraToBox( c, new Box3() ),
		'a single point': c => fitCamera( c, [ new Vector3( 0, 0, - 5 ) ] ),
		'an object with no geometry': c => fitCameraToObject( c, new Group() )
	};

	for ( const camera of [ new PerspectiveCamera( 50, 1.5, .1, 100 ), new OrthographicCamera( - 2, 2, 1, - 1, .1, 100 ) ] ) {

		for ( const [ name, fit ] of Object.entries( cases ) ) {

			const before = state( camera );
			assert.equal( fit( camera ), false, `${ camera.type }, ${ name }` );
			assert.equal( state( camera ), before, `${ camera.type }, ${ name }` );

		}

	}

	const camera = new PerspectiveCamera( 50, 1, .1, 100 );
	const before = state( camera );
	assert.equal( fitPerspectiveCamera( camera, [ new Vector3( 0, 0, 5 ), new Vector3( 1, 1, 9 ) ] ), false );
	assert.equal( state( camera ), before, 'every point behind' );

} );

test( 'something flat facing the camera still gets some depth', () => {

	const quad = new Mesh( new PlaneGeometry( 2, 1 ) );
	const position = quad.geometry.attributes.position;
	const points = Array.from( { length: position.count }, ( _, i ) => new Vector3().fromBufferAttribute( position, i ) );

	for ( const camera of [ new PerspectiveCamera( 50, 2, .1, 100 ), new OrthographicCamera( - 1, 1, 1, - 1, .1, 100 ) ] ) {

		camera.position.set( 0, 0, 5 );
		camera.lookAt( 0, 0, 0 );

		assert.equal( fitCameraToObject( camera, quad ), true );
		assert.ok( camera.near < 5 && camera.far > 5 && camera.projectionMatrix.elements.every( Number.isFinite ), `${ camera.type } ${ camera.near } ${ camera.far }` );

		const r = ndc( camera, points );
		assert.ok( Math.abs( Math.max( - r.x[ 0 ], r.x[ 1 ], - r.y[ 0 ], r.y[ 1 ] ) - 1 ) < 1e-6 && r.z[ 0 ] > - 1 && r.z[ 1 ] < 1, camera.type );

	}

} );

test( 'the instances of an InstancedMesh, and the morphs of a mesh as it is', () => {

	const instanced = new InstancedMesh( new BoxGeometry( 1, 1, 1 ), undefined, 3 );
	instanced.setMatrixAt( 0, new Matrix4().makeTranslation( - 4, 0, 0 ) );
	instanced.setMatrixAt( 1, new Matrix4().makeTranslation( 4, 1, 0 ) );
	instanced.setMatrixAt( 2, new Matrix4().makeRotationZ( .5 ).setPosition( 0, - 3, 1 ) );
	instanced.position.set( 1, 0, 0 );
	instanced.updateMatrixWorld();

	const corners = [];
	const matrix = new Matrix4();
	for ( let j = 0; j < 3; j ++ ) {

		instanced.getMatrixAt( j, matrix ).premultiply( instanced.matrixWorld );
		for ( let i = 0; i < 8; i ++ ) corners.push( new Vector3( i & 1 ? .5 : - .5, i & 2 ? .5 : - .5, i & 4 ? .5 : - .5 ).applyMatrix4( matrix ) );

	}

	for ( const precise of [ false, true ] ) {

		const camera = new PerspectiveCamera( 50, 1.5, .1, 1000 );
		camera.position.set( 12, 8, 15 );
		camera.lookAt( 0, 0, 0 );
		fitCameraToObject( camera, instanced, { precise } );
		const r = ndc( camera, corners );
		assert.ok( Math.abs( Math.max( - r.x[ 0 ], r.x[ 1 ], - r.y[ 0 ], r.y[ 1 ] ) - 1 ) < 1e-6, `precise: ${ precise }` );

	}

	// a morph that lifts the top of a box to 3
	const geometry = new BoxGeometry( 1, 1, 1 );
	const lifted = geometry.attributes.position.clone();
	for ( let i = 0; i < lifted.count; i ++ ) if ( lifted.getY( i ) > 0 ) lifted.setY( i, 3 );
	geometry.morphAttributes.position = [ lifted ];
	const morphed = new Mesh( geometry );
	morphed.morphTargetInfluences = [ 1 ];

	const camera = new OrthographicCamera( - 1, 1, 1, - 1, .1, 100 );
	camera.position.set( 0, 0, 10 );
	camera.lookAt( 0, 0, 0 );
	fitCameraToObject( camera, morphed, { precise: true } );
	assert.ok( Math.abs( camera.top - 3 ) < 1e-9 && Math.abs( camera.bottom + .5 ) < 1e-9, `${ camera.top } ${ camera.bottom }` );

} );
