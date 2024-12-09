import {useSprings, config, a} from '@react-spring/three'
import Block from './Block'

type VoxelImageProps = {
  imageData: ImageData
}

type BlockProps = {
  key: string
  position: [x: number, y: number, z: number]
  color: string
  distanceFromCenter: number
}

export default function VoxelImage(props: VoxelImageProps) {
  const {data, width, height} = props.imageData
  const centerX = width / 2
  const centerY = height / 2

  const blocks: BlockProps[] = []
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const index = i * width + j
      const [r, g, b, a] = data.slice(index * 4, index * 4 + 4)
      if (r + g + b <= 0 || a <= 0) continue

      const distanceFromCenter = Math.sqrt((j - centerX) ** 2 + (i - centerY) ** 2)
      blocks.push({
        key: `${j}-${i}`,
        position: [j, 0, i],
        color: `rgba(${r}, ${g}, ${b}, ${a})`,
        distanceFromCenter,
      })
    }
  }

  const springs = useSprings(
    blocks.length,
    blocks.map((block) => ({
      from: {
        visible: false,
        position: [block.position[0], block.position[1] - 1, block.position[2]] as const,
      },
      to: {
        visible: true,
        position: block.position,
      },
      delay: block.distanceFromCenter * 20,
      config: config.stiff,
    })),
  )

  if (width > 32 || height > 32) return null
  return (
    <group position={[-centerX, 0, -centerY]}>
      {springs.map((spring, index) => (
        <Block
          key={blocks[index].key}
          position={blocks[index].position}
          springPosition={spring.position}
          color={blocks[index].color}
          visible={spring.visible}
        />
      ))}
    </group>
  )
}
