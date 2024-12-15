import {useRef} from 'react'

type UseFileDragAndDropOptions = {
  onFileDrop?: (file: File) => void | Promise<void>
}

export function useFileDragAndDrop(options: UseFileDragAndDropOptions) {
  // Use a ref here to prevent rerenders just to animate drag and drop indicator.
  // A rerender should ideally be triggered ONLY on file drop.
  const indicatorRef = useRef<HTMLElement>(null!)

  const eventHandlers = {
    onDragOver: (e: React.DragEvent) => {
      // Prevent browser's default behavior to open the file in a new tab.
      e.preventDefault()
    },
    onDragEnter: () => {
      indicatorRef.current.style.display = 'block'
    },
    onDragLeave: () => {
      indicatorRef.current.style.display = 'none'
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      indicatorRef.current.style.display = 'none'

      const file = [...e.dataTransfer.items].find((item) => item.kind === 'file')?.getAsFile()
      if (!file) return

      options.onFileDrop?.(file)
    },
  }

  return {
    indicatorRef,
    eventHandlers,
  }
}
