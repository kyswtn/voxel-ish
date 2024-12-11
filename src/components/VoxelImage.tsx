import * as THREE from 'three'
import {useLayoutEffect, useMemo, useRef} from 'react'
import {useGesture} from '@use-gesture/react'
import {useThree, type GroupProps} from '@react-three/fiber'
import {type RapierRigidBody, RigidBody} from '@react-three/rapier'
import type {RigidBodyState} from '@react-three/rapier/dist/declarations/src/components/Physics'
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

type VoxelImageProps = {
  imageData: ImageData
  blockSize?: number
}

type DragTriple = {
  instanceId: number
  dragHandle: THREE.Object3D
  rigidBody: RapierRigidBody
}

const tmpObject3d = new THREE.Object3D()
const tmpObject3dPosition = new THREE.Vector3()
const yAxisNormal = new THREE.Vector3(0, 1, 0)
const dragPlane = new THREE.Plane()
const cursorPosition2d = new THREE.Vector2()
const cursorPosition3d = new THREE.Vector3()

export default function VoxelImage({imageData, blockSize = 1}: VoxelImageProps) {
  const {size, camera, raycaster} = useThree()
  const blocks = useMemo(() => getBlocksFromImageData(imageData, blockSize), [imageData, blockSize])

  // RoundedBoxGeometry used by instancedMesh, with colors attribute.
  const colors = useMemo(() => new Float32Array(blocks.flatMap((b) => b.color)), [blocks])
  const instancedMeshGeometry = useMemo(() => {
    const geometry = new RoundedBoxGeometry(blockSize, blockSize, blockSize, 4, 0.0125)
    geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 4))
    return geometry
  }, [blockSize, colors])

  // These geometry and materials will be used by invisible drag handles and rigid bodies.
  // biome-ignore format: Single line reads better.
  const blockSizedBoxGeometry = useMemo(() => new THREE.BoxGeometry(blockSize, blockSize, blockSize), [blockSize])
  const basicInvisibleMaterial = useMemo(() => new THREE.MeshBasicMaterial({visible: false}), [])

  // Active drag will be called a triple as it holds three things, i.e. instanceId or instance index,
  // active dragHandle and rigidBody.
  const dragHandlesGroupRef = useRef<THREE.Group>(null!)
  const dragHandles = useRef<THREE.Mesh[]>([])
  const rigidBodies = useRef<RapierRigidBody[]>([])
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null!)
  const activeDragTriple = useRef<DragTriple>()

  // Run this before first paint. Place and position blocks for instancedMesh.
  useLayoutEffect(() => {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!

      tmpObject3d.position.set(...block.initialPosition)
      tmpObject3d.updateMatrix()
      instancedMeshRef.current.setMatrixAt(i, tmpObject3d.matrix)
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true
  }, [blocks])

  const bind = useGesture(
    {
      onDragStart: ({xy: [x, y], intentional}) => {
        // If displacement < threshold, don't move.
        if (!intentional) return

        // Raycast and find intersected object.
        cursorPosition2d.set(x, y)
        raycaster.setFromCamera(cursorPosition2d, camera)
        const intersection = raycaster.intersectObjects(dragHandlesGroupRef.current.children)[0]
        if (!intersection) return

        // Set dragPlane in the position of dragged object.
        const dragHandle = intersection.object
        dragPlane.setFromNormalAndCoplanarPoint(yAxisNormal, dragHandle.position)

        // Set active drag triple.
        const instanceId = dragHandle.userData.index as number
        const rigidBody = rigidBodies.current[instanceId]
        activeDragTriple.current = {instanceId, dragHandle, rigidBody}

        // Wake rigidBody up to prepare for kinematic translation.
        rigidBody.setBodyType(2, true)
      },
      onDrag: ({xy: [x, y]}) => {
        if (activeDragTriple.current === undefined) return
        const {instanceId, dragHandle, rigidBody} = activeDragTriple.current

        // Get cursor position on drag plane.
        cursorPosition2d.set(x, y)
        raycaster.setFromCamera(cursorPosition2d, camera)
        raycaster.ray.intersectPlane(dragPlane, cursorPosition3d)

        // Update dragHandle's position.
        dragHandle.position.set(cursorPosition3d.x, cursorPosition3d.y, cursorPosition3d.z)

        // Update instance's position.
        tmpObject3d.position.set(cursorPosition3d.x, cursorPosition3d.y, cursorPosition3d.z)
        // Since the instance will be moved to new position, there's no need to care about previous
        // position of temporary object, but previous rotation (and scale) must be taken into account.
        tmpObject3d.setRotationFromEuler(dragHandle.rotation)
        tmpObject3d.updateMatrix()
        instancedMeshRef.current.setMatrixAt(instanceId, tmpObject3d.matrix)
        instancedMeshRef.current.instanceMatrix.needsUpdate = true

        // Move linked rigidbody kinematically.
        tmpObject3d.getWorldPosition(tmpObject3dPosition)
        rigidBody.setNextKinematicTranslation(tmpObject3dPosition)
      },
      onDragEnd: () => {
        if (!activeDragTriple.current) return

        activeDragTriple.current.rigidBody.setBodyType(0, true)
        activeDragTriple.current = undefined
      },
    },
    {
      drag: {
        // Only trigger onDrag when the user drags.
        filterTaps: true,
        // Only trigger onDrag when the user drag the mesh enough to shift a pixel.
        threshold: 1,
      },
      transform: (vec2) => {
        // Turn cursor position to Normalized Device Coordinates so that raycaster can use.
        // Basically given [0, screenWidth] range, turn it into [-1, 1] range.
        const [x, y] = vec2
        const normalX = ((x - size.left) / size.width) * 2 - 1
        const normalY = -((y - size.top) / size.height) * 2 + 1
        return [normalX, normalY]
      },
    },
  )

  // This gets triggered whenever a rigid body's state change. This saves me from having to sync
  // instances to rigid bodies with hooks such as useAfterPhysicsStep.
  const transformRigidBodyState = (state: RigidBodyState, index: number) => {
    if (instancedMeshRef.current) {
      return {
        ...state,
        getMatrix: (matrix) => {
          instancedMeshRef.current.getMatrixAt(index, matrix)
          return matrix
        },
        setMatrix: (matrix) => {
          // Don't sync if the instance is the one being dragged.
          if (activeDragTriple.current?.instanceId === index) return

          // Sync drag handle.
          const dragHandle = dragHandles.current[index]
          if (dragHandle) {
            dragHandle.position.setFromMatrixPosition(matrix)
            dragHandle.setRotationFromMatrix(matrix)
          }

          // Sync instance.
          instancedMeshRef.current.setMatrixAt(index, matrix)
          instancedMeshRef.current.instanceMatrix.needsUpdate = true
        },
        meshType: 'instancedMesh',
      } as RigidBodyState
    }

    return state
  }

  return (
    <>
      <group ref={dragHandlesGroupRef} {...(bind() as GroupProps)}>
        {blocks.map((block, index) => (
          <mesh
            key={block.key}
            userData={{index}}
            position={block.initialPosition}
            ref={(dragHandle) => {
              if (dragHandle) dragHandles.current[index] = dragHandle
            }}
            geometry={blockSizedBoxGeometry}
            material={basicInvisibleMaterial}
          />
        ))}
      </group>

      {blocks.map((block, index) => (
        <RigidBody
          key={block.key}
          position={block.initialPosition}
          ref={(rigidBody) => {
            if (rigidBody) rigidBodies.current[index] = rigidBody
          }}
          // This is the function internally used by @react-three/rapier's InstancedRigidBodies.
          transformState={(state) => transformRigidBodyState(state, index)}
          // Physics configurations to make blocks behave the way they do.
          angularDamping={1}
          linearDamping={1.5}
        >
          <mesh geometry={blockSizedBoxGeometry} material={basicInvisibleMaterial} />
        </RigidBody>
      ))}

      <instancedMesh
        ref={instancedMeshRef}
        args={[instancedMeshGeometry, undefined, blocks.length]}
      >
        <meshPhysicalMaterial vertexColors />
      </instancedMesh>
    </>
  )
}

type BlockProps = {
  key: string
  initialPosition: [x: number, y: number, z: number]
  color: [r: number, g: number, b: number, a: number]
}

function getBlocksFromImageData(imageData: ImageData, blockSize: number): BlockProps[] {
  const {data, width, height} = imageData
  const [centerX, centerY] = [width / 2, height / 2]

  const blocks: BlockProps[] = []
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const index = i * width + j

      // ImageData comes with a flat Uint8 array where each 4 items represent a pixel and it's
      // RGBA values.
      const [r, g, b, a] = data.slice(index * 4, index * 4 + 4)
      if (a <= 0) continue

      blocks.push({
        key: `${j}-${i}`,
        initialPosition: [(j - centerX) * blockSize, 0, (i - centerY) * blockSize],
        color: [r / 255, g / 255, b / 255, a],
      })
    }
  }
  return blocks
}
