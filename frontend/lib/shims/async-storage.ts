type KeyValuePair = [string, string | null]

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null
  }
  return window.localStorage
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    const storage = getStorage()
    if (!storage) return null
    return storage.getItem(key)
  },

  async setItem(key: string, value: string): Promise<void> {
    const storage = getStorage()
    if (!storage) return
    storage.setItem(key, value)
  },

  async removeItem(key: string): Promise<void> {
    const storage = getStorage()
    if (!storage) return
    storage.removeItem(key)
  },

  async clear(): Promise<void> {
    const storage = getStorage()
    if (!storage) return
    storage.clear()
  },

  async getAllKeys(): Promise<string[]> {
    const storage = getStorage()
    if (!storage) return []
    return Object.keys(storage)
  },

  async multiGet(keys: string[]): Promise<KeyValuePair[]> {
    const storage = getStorage()
    if (!storage) return keys.map((key) => [key, null])
    return keys.map((key) => [key, storage.getItem(key)])
  },

  async multiSet(keyValuePairs: Array<[string, string]>): Promise<void> {
    const storage = getStorage()
    if (!storage) return

    for (const [key, value] of keyValuePairs) {
      storage.setItem(key, value)
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    const storage = getStorage()
    if (!storage) return

    for (const key of keys) {
      storage.removeItem(key)
    }
  },
}

export default AsyncStorage
