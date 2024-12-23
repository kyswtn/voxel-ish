import {create} from 'zustand'
import {getImageDataFromFile} from './getImageDataFromFile'

type State = {
  file: File
  imageData: ImageData
  example?: number
}

type Store = {
  state: State | null
  loadFromFile: (file: File | null) => Promise<void>
  loadFromNextExample: () => Promise<void>
}

const examples = [
  'chrome.png',
  'bluesky.png',
  'nextjs.png',
  'nix.png',
  'svelte.png',
  // Add more examples here.
].map((name) => `/examples/${name}`)

const cache = new Map<string, Blob>()
const fetchBlobAndCache = async (filePath: string) => {
  if (cache.has(filePath)) return cache.get(filePath) as Blob
  const response = await fetch(filePath)
  const blob = await response.blob()
  cache.set(filePath, blob)
  return blob
}

const loadFromExample = async (_index = 0) => {
  const index = _index % examples.length
  const fileName = examples[index]
  const blob = await fetchBlobAndCache(fileName)
  const file = new File([blob], fileName, {type: blob.type})
  const imageData = await getImageDataFromFile(file)
  return {file, imageData, example: index}
}

export const useStore = create<Store>()((set, get) => ({
  state: null,
  loadFromFile: async (file) => {
    if (!file) {
      set({state: null})
    } else {
      const imageData = await getImageDataFromFile(file)
      set({state: {file, imageData}})
    }
  },
  loadFromNextExample: async () => {
    const current = get().state?.example ?? -1
    const state = await loadFromExample(current + 1)
    set({state})
  },
}))
