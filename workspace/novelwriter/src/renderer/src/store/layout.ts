import { create } from 'zustand'

export type SidebarView = 'project' | 'characters' | 'outline' | 'world' | 'timeline' | 'locations' | 'relations' | 'inspirations' | 'logs' | 'references'

export type DocType = 'project' | 'chapter' | 'character' | 'characters' | 'worldSetting' | 'worldSettings' | 'timeline' | 'location' | 'locations' | 'characterRelations' | 'inspirations' | 'references' | 'writingLogs'

export interface OpenDoc {
  id: string
  type: DocType
  title: string
  entityId: string
  content: string
  dirty: boolean
}

interface LayoutState {
  sidebarView: SidebarView
  setSidebarView: (view: SidebarView) => void

  openDocs: OpenDoc[]
  activeDocId: string | null
  openDoc: (doc: OpenDoc) => void
  closeDoc: (id: string) => void
  setActiveDoc: (id: string) => void
  setDocContent: (id: string, content: string) => void
  setDocDirty: (id: string, dirty: boolean) => void
  setDocTitle: (id: string, title: string) => void
  closeAllDocs: () => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarView: 'project',
  setSidebarView: (view) => set({ sidebarView: view }),

  openDocs: [],
  activeDocId: null,

  openDoc: (doc) => {
    const { openDocs, activeDocId } = get()
    const existing = openDocs.find((d) => d.id === doc.id)
    if (existing) {
      if (activeDocId !== doc.id) {
        set({ activeDocId: doc.id })
      }
      return
    }
    set({
      openDocs: [...openDocs, doc],
      activeDocId: doc.id
    })
  },

  closeDoc: (id) => {
    const { openDocs, activeDocId } = get()
    const idx = openDocs.findIndex((d) => d.id === id)
    if (idx === -1) return
    const nextDocs = openDocs.filter((d) => d.id !== id)
    let nextActive = activeDocId
    if (activeDocId === id) {
      nextActive = nextDocs.length > 0
        ? nextDocs[Math.min(idx, nextDocs.length - 1)].id
        : null
    }
    set({
      openDocs: nextDocs,
      activeDocId: nextActive
    })
  },

  setActiveDoc: (id) => set({ activeDocId: id }),

  setDocContent: (id, content) => {
    set((state) => ({
      openDocs: state.openDocs.map((d) =>
        d.id === id ? { ...d, content, dirty: true } : d
      )
    }))
  },

  setDocDirty: (id, dirty) => {
    set((state) => ({
      openDocs: state.openDocs.map((d) =>
        d.id === id ? { ...d, dirty } : d
      )
    }))
  },

  setDocTitle: (id, title) => {
    set((state) => ({
      openDocs: state.openDocs.map((d) =>
        d.id === id ? { ...d, title } : d
      )
    }))
  },

  closeAllDocs: () => set({ openDocs: [], activeDocId: null })
}))
