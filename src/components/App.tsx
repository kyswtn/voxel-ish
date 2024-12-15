import {Canvas} from '@react-three/fiber'
import {Physics} from '@react-three/rapier'
import {Suspense, useCallback, useRef, type RefObject} from 'react'
import {useFileDragAndDrop} from '../lib/useFileDragAndDrop'
import VoxelImage from './VoxelImage'
import {OrbitControls} from '@react-three/drei'
import HtmlPageContent from './HtmlPageContent'
import type {OrbitControls as THREEOrbitControls} from 'three-stdlib'
import {useStore} from '../lib/useStore'

export default function App() {
  const orbitControlsRef = useRef<THREEOrbitControls>(null!)
  const loadImageFile = useStore((store) => store.loadFromFile)
  const onFileUpload = useCallback(
    (file: File) => {
      // loadImageFile(null)
      orbitControlsRef.current.reset()
      loadImageFile(file)
    },
    [loadImageFile],
  )
  const {indicatorRef, eventHandlers: fileDragAndDropEventHandlers} = useFileDragAndDrop({onFileDrop: onFileUpload})

  return (
    <>
      <Canvas camera={{position: [0, 5, 2]}} {...fileDragAndDropEventHandlers}>
        <OrbitControls
          ref={orbitControlsRef}
          autoRotate
          autoRotateSpeed={0.005}
          enableRotate={false}
          enablePan={false}
          enableZoom={false}
        />
        <directionalLight color="white" position={[-36, 2, -82]} intensity={15} />
        <directionalLight intensity={0.25} />
        <ambientLight intensity={0.25} />

        <Suspense fallback={null}>
          <Physics gravity={[0, 0, 0]}>
            <VoxelImageFromState />
          </Physics>
          <HtmlPageContent onFileUpload={onFileUpload} />
        </Suspense>
      </Canvas>
      {/* File Drag and Drop Indicator behind Canvas */}
      <div ref={indicatorRef as RefObject<HTMLDivElement>} className="hidden absolute -z-50 inset-5">
        <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-lg" />
      </div>
    </>
  )
}

// Separated to prevent rerender of canvas on state change.
function VoxelImageFromState() {
  const imageData = useStore((store) => store.state?.imageData)
  return imageData && <VoxelImage imageData={imageData} blockSize={0.25} />
}
