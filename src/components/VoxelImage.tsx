import Block from './Block'

type VoxelImageProps = {
  imageData: ImageData
}

export default function VoxelImage(props: VoxelImageProps) {
  const {data, width, height} = props.imageData

  const blocks: React.ReactElement[] = []
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const index = i * width + j
      const [r, g, b, a] = data.slice(index * 4, index * 4 + 4)
      if (r + g + b > 0 && a > 0) {
        blocks.push(
          <Block key={`${j}-${i}`} position={[j, 0, i]} color={`rgba(${r}, ${g}, ${b}, ${a})`} />,
        )
      }
    }
  }

  if (props.imageData.width > 32 || props.imageData.height > 32) return null
  return <group position={[-width / 2, 0, -height / 2]}>{blocks.map((block) => block)}</group>
}
