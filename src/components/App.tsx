import {Canvas} from '@react-three/fiber'
import {Physics} from '@react-three/rapier'
import {Perf} from 'r3f-perf'
import {Suspense, useEffect, useState, type RefObject} from 'react'
import {useFileDragAndDrop} from '../lib/hooks'
import {getImageDataFromFile, processImage} from '../lib/image'
import VoxelImage from './VoxelImage'
import {OrbitControls} from '@react-three/drei'

const DEV = import.meta.env.DEV
function DebugHelpers() {
  return (
    <>
      <Perf position="bottom-left" />
    </>
  )
}

export default function App() {
  const [imageData, setImageData] = useState<ImageData>()
  const {indicatorRef, eventHandlers: fileDragAndDropEventHandlers} = useFileDragAndDrop({
    onFileDrop: (file) => {
      setImageData(undefined)

      getImageDataFromFile(file)
        .then((imageData) => processImage(imageData))
        .then((imageData) => setImageData(imageData))
    },
  })

  useEffect(() => {
    ;(async () => {
      const demoImageUrl = '/bsky.png'
      const response = await fetch(demoImageUrl)
      const blob = await response.blob()
      const file = new File([blob], demoImageUrl, {type: blob.type})
      let imageData = await getImageDataFromFile(file)
      imageData = await processImage(imageData)

      setImageData(imageData)
    })()
  }, [])

  return (
    <>
      <Canvas camera={{position: [0, 5, 2]}} {...fileDragAndDropEventHandlers}>
        {DEV && <DebugHelpers />}

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.05}
          enableRotate={false}
          enableZoom={false}
          enablePan={false}
        />

        <directionalLight color="white" position={[-36, 1, -72]} intensity={25} />
        <directionalLight intensity={0.25} />

        <Suspense fallback={null}>
          <Physics gravity={[0, 0, 0]}>
            {imageData && <VoxelImage imageData={imageData} blockSize={0.25} />}
          </Physics>
        </Suspense>
      </Canvas>
      {/* File Drag and Drop Indicator behind Canvas */}
      <div
        ref={indicatorRef as RefObject<HTMLDivElement>}
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: -9999,
          inset: 25,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            border: '2px dashed #e2e2e2',
            borderRadius: '10px',
          }}
        />
      </div>
    </>
  )
}
