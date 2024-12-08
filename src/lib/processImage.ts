async function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.addEventListener('load', (e) => resolve(e.target?.result as string))
    reader.readAsDataURL(file)
  })
}

async function loadImageFromFile(file: File) {
  const img = new Image()
  img.src = await readFileAsDataURL(file)

  return new Promise<typeof img>((resolve) => {
    img.addEventListener('load', () => resolve(img))
  })
}

export async function getImageDataFromFile(file: File) {
  const img = await loadImageFromFile(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, img.width, img.height)

  const imageData = ctx.getImageData(0, 0, img.width, img.height)
  return imageData
}

type ProcessImageOptions = {
  size?: number
  colors?: number
}

export async function processImage(_imageData: ImageData, _options: ProcessImageOptions = {}) {
  let imageData = _imageData
  const options = {
    ..._options,
    size: 16,
    colors: 16,
  }

  // Quantize, reduce the number of colors used.
  const factor = Math.floor(256 / Math.sqrt(options.colors))
  for (let i = 0; i < imageData.data.length; i += 4) {
    const [r, g, b] = imageData.data.slice(i, i + 3)
    imageData.data[i] = Math.floor(r / factor) * factor
    imageData.data[i + 1] = Math.floor(g / factor) * factor
    imageData.data[i + 2] = Math.floor(b / factor) * factor
  }

  // Pixelate.
  const imageCanvas = document.createElement('canvas')
  imageCanvas.width = imageData.width
  imageCanvas.height = imageData.height
  const imageCanvasCtx = imageCanvas.getContext('2d')!
  imageCanvasCtx.putImageData(imageData, 0, 0)
  const scaledCanvas = document.createElement('canvas')
  scaledCanvas.width = options.size
  scaledCanvas.height = options.size
  const scaledCtx = scaledCanvas.getContext('2d')!
  scaledCtx.drawImage(imageCanvas, 0, 0, options.size, options.size)
  imageData = scaledCtx.getImageData(0, 0, options.size, options.size)

  // Remove white-ish pixels.
  for (let i = 0; i < imageData.data.length; i += 4) {
    const a = imageData.data[i + 3]
    imageData.data[i + 3] = a > 254 ? a : 0
  }

  return imageData
}
