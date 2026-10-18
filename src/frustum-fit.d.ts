import { Box3, Matrix4, Object3D, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';

export interface FitOptions {
	/** Keep the shape of the frustum. true by default for a perspective camera, false for an orthographic one. */
	keepAspect?: boolean;
	/** A part of the size to leave around, 0 by default. */
	margin?: number;
	/** Change near and far too, true by default. */
	fitDepth?: boolean;
}

export interface ObjectFitOptions extends FitOptions {
	/** Around every vertex, where morphs and bones put it, instead of around the boxes of the geometries. */
	precise?: boolean;
}

/** Returns false if some of the points are behind the camera, or, leaving the camera as it was, if there's nothing to fit. */
export function fitPerspectiveCamera( camera: PerspectiveCamera, points: Iterable<Vector3>, options?: FitOptions ): boolean;
/** Returns false, leaving the camera as it was, if there's nothing to fit. */
export function fitOrthographicCamera( camera: OrthographicCamera, points: Iterable<Vector3>, options?: FitOptions ): boolean;
export function fitCamera( camera: PerspectiveCamera | OrthographicCamera, points: Iterable<Vector3>, options?: FitOptions ): boolean;
/** Returns false, leaving the camera as it was, for an empty box. */
export function fitCameraToBox( camera: PerspectiveCamera | OrthographicCamera, box: Box3, matrix?: Matrix4 | null, options?: FitOptions ): boolean;
/** Returns false, leaving the camera as it was, if there's nothing with a geometry inside. */
export function fitCameraToObject( camera: PerspectiveCamera | OrthographicCamera, object: Object3D, options?: ObjectFitOptions ): boolean;
