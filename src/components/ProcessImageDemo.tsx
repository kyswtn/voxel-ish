import {useEffect, useRef, useState} from 'react'
import {processImage} from '../lib/processImage'
import {getImageDataFromFile} from '../lib/getImageDataFromFile'

const demoImageUrl = '/nix.png'
export default function ProcessImageDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null!)
  const [imageData, setImageData] = useState<ImageData>()

  useEffect(() => {
    ;(async () => {
      const response = await fetch(demoImageUrl)
      const blob = await response.blob()
      const file = new File([blob], demoImageUrl, {type: blob.type})
      const imageData = await getImageDataFromFile(file)

      setImageData(imageData)
    })()
  }, [])

  useEffect(() => {
    if (!imageData) return

    canvasRef.current.width = imageData.width
    canvasRef.current.height = imageData.height

    const processedImageData = processImage(imageData)
    const tinyCanvas = document.createElement('canvas')
    tinyCanvas.width = processedImageData.width
    tinyCanvas.height = processedImageData.height
    const tinyCanvasCtx = tinyCanvas.getContext('2d')!
    tinyCanvasCtx.putImageData(processedImageData, 0, 0)

    const ctx = canvasRef.current.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tinyCanvas, 0, 0, imageData.width, imageData.height)
  }, [imageData])

  return (
    <section style={{display: 'grid', placeItems: 'center', height: '100%'}}>
      <canvas ref={canvasRef} />
    </section>
  )
}
