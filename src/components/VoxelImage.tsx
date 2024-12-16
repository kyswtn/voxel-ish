import * as THREE from 'three'
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef} from 'react'
import {useGesture} from '@use-gesture/react'
import {useFrame, useThree, type GroupProps} from '@react-three/fiber'
import {type RapierRigidBody, RigidBody, type RigidBodyProps} from '@react-three/rapier'
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {processImage} from '../lib/processImage'

type VoxelImageProps = {
  imageData: ImageData
  blockSize?: number
}

type DragTriple = {
  instanceId: number
  dragHandle: THREE.Object3D
  rigidBody: RapierRigidBody
}

type RigidBodyState = ReturnType<NonNullable<RigidBodyProps['transformState']>>

const tmpObject3d = new THREE.Object3D()
const tmpObject3dPosition = new THREE.Vector3()
const yAxisNormal = new THREE.Vector3(0, 1, 0)
const dragPlane = new THREE.Plane()
const cursorPosition2d = new THREE.Vector2()
const cursorPosition3d = new THREE.Vector3()

export default function VoxelImage({imageData: _imageData, blockSize = 1}: VoxelImageProps) {
  const {size, camera, raycaster} = useThree()

  // Process image and turn them into renderable block props, shift coordinates to recenter etc.
  const imageData = useMemo(() => processImage(_imageData), [_imageData])
  const blocks = useMemo(() => {
    const shiftLeft = imageData.width / 2
    const shiftRight = imageData.height / 1.95
    return getBlocksFromImageData(imageData, blockSize, [shiftLeft, shiftRight])
  }, [imageData, blockSize])

  // RoundedBoxGeometry used by instancedMesh, with colors attribute.
  const colors = useMemo(() => new Float32Array(blocks.flatMap((b) => b.color)), [blocks])
  const instancedMeshGeometry = useMemo(() => {
    const geometry = new RoundedBoxGeometry(blockSize, blockSize, blockSize, 4, 0.015)
    geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 4))
    return geometry
  }, [blockSize, colors])

  const instancedMeshRef = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    for (let i = 0; i < blocks.length; i++) {
      const [x, y, z] = blocks[i].position
      // The blocks will be initially hidden, but they must be rendered otherwise instancedMesh
      // will render blocks on [0, 0, 0] on start.
      tmpObject3d.scale.set(0, 0, 0)
      tmpObject3d.position.set(x, y, z)
      tmpObject3d.updateMatrix()
      instancedMeshRef.current.setMatrixAt(i, tmpObject3d.matrix)
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true
  }, [blocks])

  // These geometry and materials will be used by invisible drag handles and rigid bodies.
  // biome-ignore format: Single line reads better.
  const blockSizedBoxGeometry = useMemo(() => new THREE.BoxGeometry(blockSize, blockSize, blockSize), [blockSize])
  const basicInvisibleMaterial = useMemo(() => new THREE.MeshBasicMaterial({visible: false}), [])
  const dragHandlesGroupRef = useRef<THREE.Group>(null!)
  const dragHandles = useRef<THREE.Mesh[]>([])
  const activeDragTriple = useRef<DragTriple>()
  const bindGestures = useGesture(
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

        document.body.style.cursor = 'grabbing'
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
        document.body.style.cursor = 'auto'
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

  // Animate blocks on mount.
  const animationProgress = useRef<number[]>([])
  const animationComplete = useRef(false)
  useFrame((_, delta) => {
    if (animationComplete.current) return
    if (animationProgress.current.length < 1) {
      animationProgress.current = blocks.map(() => 0)
    }

    let allBlocksFinished = true
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      const [x, y, z] = block.position
      const delayFactor = block.distanceFromCenter * 0.25

      // Increment progress after delay.
      if (animationProgress.current[i] < delayFactor) {
        animationProgress.current[i] += delta
        allBlocksFinished = false
        continue
      }

      const progress = (animationProgress.current[i] - delayFactor) / 1.0
      if (progress < 1) {
        animationProgress.current[i] += delta
        const easedProgress = 1 - (1 - progress) ** 6

        // Lerp position between start and target.
        const startY = y - 0.25
        const newY = THREE.MathUtils.lerp(startY, y, easedProgress)

        // Update block's position and scale.
        tmpObject3d.rotation.set(0, 0, 0, THREE.Euler.DEFAULT_ORDER)
        tmpObject3d.scale.set(1, 1, 1)
        tmpObject3d.position.set(x, newY, z)
        tmpObject3d.updateMatrix()
        instancedMeshRef.current.setMatrixAt(i, tmpObject3d.matrix)

        allBlocksFinished = false
      }
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true
    if (allBlocksFinished) animationComplete.current = true
  })

  const rigidBodies = useRef<RapierRigidBody[]>([])
  // This gets triggered whenever a rigid body's state change. This saves me from having to sync
  // instances to rigid bodies with hooks such as useAfterPhysicsStep.
  const transformRigidBodyState = useCallback((state: RigidBodyState, index: number) => {
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

        // Don't sync if the blocks have not finished animating.
        if (!animationComplete.current) return state

        // Sync instance.
        instancedMeshRef.current.setMatrixAt(index, matrix)
        instancedMeshRef.current.instanceMatrix.needsUpdate = true
      },
      meshType: 'instancedMesh',
    } as typeof state
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset refs on blocks update.
  useEffect(() => {
    return () => {
      dragHandles.current = []
      rigidBodies.current = []
      animationProgress.current = []
      animationComplete.current = false
      if (instancedMeshRef.current) {
        instancedMeshRef.current.clear()
        instancedMeshRef.current.instanceMatrix.needsUpdate = true
      }
    }
  }, [blocks])

  return (
    <group>
      <instancedMesh
        ref={instancedMeshRef}
        args={[instancedMeshGeometry, undefined, blocks.length]}
      >
        <meshPhysicalMaterial vertexColors />
      </instancedMesh>

      <group ref={dragHandlesGroupRef} {...(bindGestures() as GroupProps)}>
        {blocks.map((block, index) => (
          <mesh
            key={block.key}
            userData={{index}}
            position={block.position}
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
          position={block.position}
          ref={(rigidBody) => {
            if (rigidBody) rigidBodies.current[index] = rigidBody
          }}
          // This is the function internally used by @react-three/rapier's InstancedRigidBodies.
          transformState={(state) => transformRigidBodyState(state, index)}
          // Physics configurations to make blocks behave the way they do.
          angularDamping={1.5}
          linearDamping={1.5}
        >
          <mesh geometry={blockSizedBoxGeometry} material={basicInvisibleMaterial} />
        </RigidBody>
      ))}
    </group>
  )
}

type BlockProps = {
  key: string
  position: [x: number, y: number, z: number]
  color: [r: number, g: number, b: number, a: number]
  distanceFromCenter: number
}

function getBlocksFromImageData(
  imageData: ImageData,
  blockSize: number,
  shifts: readonly [number, number],
): BlockProps[] {
  const {data, width, height} = imageData
  const [shiftLeft, shiftTop] = shifts
  const [centerX, centerY] = [width / 2, height / 2]

  const keyPrefix = crypto.randomUUID()
  const blocks: BlockProps[] = []
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const index = i * width + j

      // ImageData comes with a flat Uint8 array where each 4 items represent a pixel and it's
      // RGBA values.
      const [r, g, b, a] = data.slice(index * 4, index * 4 + 4)
      if (a <= 0) continue

      blocks.push({
        key: `${keyPrefix}-${j}-${i}`,
        position: [(j - shiftLeft) * blockSize, 0, (i - shiftTop) * blockSize],
        distanceFromCenter: Math.sqrt((centerX - j) ** 2 + (centerY - i) ** 2) / centerX,
        color: [r / 255, g / 255, b / 255, a],
      })
    }
  }
  return blocks
}
