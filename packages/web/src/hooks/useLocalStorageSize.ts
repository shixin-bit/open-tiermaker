import { useState, useEffect } from 'react'

const WARNING_THRESHOLD = 4 * 1024 * 1024

function estimateLocalStorageSize(): number {
  try {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const value = localStorage.getItem(key)
      if (!value) continue
      total += key.length + value.length
    }
    return total * 2
  } catch {
    return 0
  }
}

export function useLocalStorageSize() {
  const [size, setSize] = useState(0)

  useEffect(() => {
    function measure() {
      setSize(estimateLocalStorageSize())
    }
    measure()
    const id = setInterval(measure, 2000)
    window.addEventListener('storage', measure)
    return () => {
      clearInterval(id)
      window.removeEventListener('storage', measure)
    }
  }, [])

  const mb = size / (1024 * 1024)
  const warning = size > WARNING_THRESHOLD
  return { size, mb, warning }
}
