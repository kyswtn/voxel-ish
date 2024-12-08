import {Canvas} from '@react-three/fiber'
import {Physics} from '@react-three/rapier'
import {Perf} from 'r3f-perf'
import {Suspense, useEffect, useState, type RefObject} from 'react'
import {useFileDragAndDrop} from '../lib/hooks'
import {getImageDataFromFile, processImage} from '../lib/processImage'
import VoxelImage from './VoxelImage'

const DEV = import.meta.env.DEV
function DebugHelpers() {
  return (
    <>
      <gridHelper />
      <Perf position="bottom-left" />
    </>
  )
}

export default function App() {
  const [imageData, setImageData] = useState<ImageData>()
  const {indicatorRef, eventHandlers: fileDragAndDropEventHandlers} = useFileDragAndDrop({
    onFileDrop: (file) => {
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
      <Canvas camera={{position: [0, 25, 10]}} {...fileDragAndDropEventHandlers}>
        {DEV && <DebugHelpers />}

        <directionalLight />
        <ambientLight />

        <Suspense fallback={null}>
          <Physics gravity={[0, 0, 0]}>{imageData && <VoxelImage imageData={imageData} />}</Physics>
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
