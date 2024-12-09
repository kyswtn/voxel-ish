import {a, type SpringValue} from '@react-spring/three'
import {useThree, type MeshProps, type Vector3} from '@react-three/fiber'
import {useGesture} from '@use-gesture/react'
import {useRef} from 'react'
import * as THREE from 'three'
import {type RapierRigidBody, RigidBody, useAfterPhysicsStep} from '@react-three/rapier'

type BlockProps = {
  position?: Vector3
  springPosition?: SpringValue<readonly [x: number, y: number, z: number]>
  color?: string
  visible?: boolean | SpringValue<boolean>
}

export default function Block(props: BlockProps) {
  const doneAnimating = useRef(false)
  const meshRef = useRef<THREE.Mesh>(null!)
  const dragHandleRef = useRef<THREE.Mesh>(null!)
  const rigidBodyRef = useRef<RapierRigidBody>(null!)
  const rigidBodyMeshRef = useRef<THREE.Mesh>(null!)

  const {size, camera, scene} = useThree()
  const bind = useGesture(
    {
      onDragStart: () => {
        // Set body type to `KinematicPositionBased`.
        rigidBodyRef.current.setBodyType(2, true)
      },
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
        const Y = camera.position.distanceTo(dragHandleRef.current.position)
        const scale = (2 * Math.tan(theta) * Y) / size.height

        const [x, z] = delta
        dragHandleRef.current.position.x += x * scale
        dragHandleRef.current.position.z += z * scale
        doneAnimating.current = true

        // Everytime a mesh is dragged around, move the rigid body to follow it.
        const worldPosition = new THREE.Vector3()
        dragHandleRef.current.getWorldPosition(worldPosition)

        rigidBodyRef.current.wakeUp()
        rigidBodyRef.current.setNextKinematicTranslation(worldPosition)

        meshRef.current.position.x += x * scale
        meshRef.current.position.z += z * scale
      },
      onDragEnd: () => {
        // Set body type to `Dynamic`.
        rigidBodyRef.current.setBodyType(0, true)
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

  useAfterPhysicsStep(() => {
    // We'll only sync those that the user's not controlling.
    if (rigidBodyRef.current.isKinematic()) return

    // Attach the objects to global scene temporarily, so that we can get scene-level position,
    // and set positions independently of parents.
    const handleParent = dragHandleRef.current.parent!
    const rigidBodyMeshParent = rigidBodyMeshRef.current.parent!
    const meshParent = meshRef.current.parent!
    scene.attach(dragHandleRef.current)
    scene.attach(rigidBodyMeshRef.current)
    scene.attach(meshRef.current)

    // Reposition the drag handle everytime the rigid body is kinematically moved. We take the
    // position from the mesh inside rigid body since rigid body doesn't have it.
    const {x, y, z} = rigidBodyMeshRef.current.position
    dragHandleRef.current.position.set(x, y, z)
    dragHandleRef.current.setRotationFromEuler(rigidBodyMeshRef.current.rotation)
    meshRef.current.position.set(x, y, z)
    meshRef.current.setRotationFromEuler(rigidBodyMeshRef.current.rotation)

    handleParent.attach(dragHandleRef.current)
    rigidBodyMeshParent.attach(rigidBodyMeshRef.current)
    meshParent.attach(meshRef.current)
  })

  return (
    <>
      {/* Invisible Drag Handle */}
      <mesh ref={dragHandleRef} position={props.position} {...(bind() as MeshProps)}>
        <boxGeometry />
        <meshNormalMaterial wireframe visible={false} />
      </mesh>

      {/* Invisible Rigid Body */}
      <RigidBody ref={rigidBodyRef} position={props.position}>
        <mesh ref={rigidBodyMeshRef}>
          <boxGeometry />
          <meshNormalMaterial visible={false} />
        </mesh>
      </RigidBody>

      <a.mesh ref={meshRef} position={props.springPosition ?? props.position}>
        <boxGeometry />
        <a.meshPhysicalMaterial color={props.color} visible={props.visible} />
      </a.mesh>
    </>
  )
}
