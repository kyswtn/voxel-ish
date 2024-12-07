import {Canvas} from '@react-three/fiber'

const DEV = import.meta.env.DEV
export default function App() {
  return (
    <Canvas camera={{position: [0, 15, 5]}}>
      {DEV && <gridHelper />}

      <mesh>
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>
    </Canvas>
  )
}
