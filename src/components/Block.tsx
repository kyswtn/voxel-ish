import {useThree, type MeshProps} from '@react-three/fiber'
import {useGesture} from '@use-gesture/react'
import {useRef} from 'react'
import * as THREE from 'three'

export default function Block() {
  // biome-ignore lint/style/noNonNullAssertion: Ref always exists.
  const ref = useRef<THREE.Mesh>(null!)
  const {size, camera} = useThree()

  const bind = useGesture(
    {
      onDrag: ({delta, intentional}) => {
        // If displacement < threshold, return early.
        if (!intentional) return

        // If camera's not perspective, screen to world coordinates mapping can't be done.
        if (!(camera instanceof THREE.PerspectiveCamera)) return

        // Delta value comes in screen coordinate pixels. Map those to (game) world coordinates.
        // The opposite side of FOV perpendicular to mesh can be found as tan(θ/2)*Y. Where θ is FOV
        // in radians and Y is distance between camera and mesh. Do that twice to get both frustum
        // top to mesh length as well as mesh to frustum bottom and add up. Divide by canvas size to
        // get the scale multiplier.
        const theta = (camera.fov * Math.PI) / 360
        const Y = camera.position.distanceTo(ref.current.position)
        const scale = (2 * Math.tan(theta) * Y) / size.height

        const [x, z] = delta
        ref.current.position.x += x * scale
        ref.current.position.z += z * scale
      },
    },
    {
      drag: {
        // Only trigger onDrag when the user drags.
        filterTaps: true,
        // Only trigger onDrag when the user drag the mesh enough to shift a pixel.
        threshold: 1,
      },
    },
  )

  return (
    <mesh ref={ref} {...(bind() as MeshProps)}>
      <boxGeometry />
      <meshNormalMaterial />
    </mesh>
  )
}
