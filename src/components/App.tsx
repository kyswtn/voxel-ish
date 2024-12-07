import {Canvas} from '@react-three/fiber'
import {Physics} from '@react-three/rapier'
import {Perf} from 'r3f-perf'
import {Suspense} from 'react'
import Block from './Block'

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
  return (
    <Canvas camera={{position: [0, 15, 5]}}>
      {DEV && <DebugHelpers />}

      <Suspense fallback={null}>
        <Physics gravity={[0, 0, 0]}>
          <Block />
        </Physics>
      </Suspense>
    </Canvas>
  )
}
