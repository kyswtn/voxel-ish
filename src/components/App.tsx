import {Canvas} from '@react-three/fiber'
import {Perf} from 'r3f-perf'

const DEV = import.meta.env.DEV
export default function App() {
  return (
    <Canvas camera={{position: [0, 15, 5]}}>
      {DEV && (
        <>
          <gridHelper />
          <Perf position="bottom-left" />
        </>
      )}

      <mesh>
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>
    </Canvas>
  )
}
