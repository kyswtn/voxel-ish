import {Html} from '@react-three/drei'
import {useEffect, useRef, type SVGProps} from 'react'
import {useStore} from '../lib/useStore'

type HtmlPageContentProps = {
  onFileUpload: (file: File) => void
}

export default function HtmlPageContent({onFileUpload}: HtmlPageContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null!)
  const {state, loadFromNextExample} = useStore((store) => store)

  useEffect(() => {
    loadFromNextExample()
  }, [loadFromNextExample])

  return (
    <Html fullscreen>
      <input
        ref={fileInputRef}
        type="file"
        id="file"
        name="file"
        accept="image/*"
        className="hidden"
        onInput={() => {
          const file = fileInputRef.current.files?.[0]
          if (file) onFileUpload(file)
        }}
      />

      <div className="p-5 sm:p-10 w-full h-full text-xl text-gray-700 font-bold flex flex-col items-start justify-between select-none">
        <div className="w-full">
          <h1 className="text-4xl text-black">VOXEL-ISH</h1>
          <p className="mt-2">
            Drag and drop images anywhere or <label htmlFor="file">upload</label>.
          </p>
        </div>

        <div className="w-full flex flex-col lg:flex-row-reverse justify-between">
          <div className="flex flex-row items-center justify-end">
            <div className="flex flex-col items-end">
              <div className="flex flex-row items-center gap-2">
                <div>{!state ? null : truncateString(state.file.name, 33)}</div>
                <div className="hidden sm:block">
                  {state?.example === undefined ? null : (
                    <button type="button" className="border" onClick={() => loadFromNextExample()}>
                      <ChevronRightIcon />
                    </button>
                  )}
                </div>
              </div>
              {!state ? null : (
                <div className="text-gray-500">
                  {state.file.type} {Math.round(state.file.size / 1000)}kb
                </div>
              )}
            </div>
            <div className="sm:hidden block">
              {state && state.example !== undefined ? (
                <button type="button" className="border p-3 ml-5 outline-none" onClick={() => loadFromNextExample()}>
                  <ChevronRightIcon />
                </button>
              ) : null}
            </div>
          </div>

          <div className="hidden lg:block max-w-prose">
            View source code <a href="https://github.com/kyswtn/voxel-ish">here</a>.{' '}
            <span className="text-gray-500">
              Made with <a href="https://github.com/pmndrs/react-three-fiber">react-three-fiber</a>,{' '}
              <a href="https://github.com/pmndrs/react-three-rapier">react-three-rapier</a>, and{' '}
              <a href="https://github.com/pmndrs/use-gesture">use-gesture</a>.
            </span>
          </div>
        </div>
      </div>
    </Html>
  )
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M8 5v2h2V5zm4 4V7h-2v2zm2 2V9h-2v2zm0 2h2v-2h-2zm-2 2v-2h2v2zm0 0h-2v2h2zm-4 4v-2h2v2z"
      />
    </svg>
  )
}

function truncateString(str: string, length: number) {
  return (str.length > length - 3 ? '...' : '') + str.slice(0, length - 3)
}
