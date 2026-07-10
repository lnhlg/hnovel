import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { MapPin, Clock, Share2, MessageSquare, Link2, Check, X, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/app'
import { useLayoutStore } from '../store/layout'

interface MemoryNode {
  id: string
  name: string
  type: 'character' | 'item' | 'organization' | 'location' | 'event'
  subtitle?: string
  status?: string
  color: string
  chOrder: number
}

type EdgeCategory = '人物关系' | '人物-物品' | '人物-组织'

interface MemoryEdge {
  id: string
  sourceId: string
  targetId: string
  label: string
  category: EdgeCategory
  chOrder: number
}

  const isExtracted = (s: string | undefined | null) => s?.includes('[ch:') || s?.includes('[manual]')

const chIdSort = (chapters: { id: string; sortOrder: number }[]) => {
  const orderMap = new Map(chapters.map(c => [c.id, c.sortOrder]))
  return (a: { description?: string | null }, b: { description?: string | null }) => {
    const getCh = (s?: string | null) => {
      if (!s) return 999
      const m = s.match(/\[ch:([^\]]+)\]/)
      return m ? (orderMap.get(m[1]) ?? 999) : 999
    }
    return getCh(a.description) - getCh(b.description)
  }
}

interface MemoryGraphProps {
  characters: { id: string; name: string; role?: string; description?: string; importantEvents?: string }[]
  items?: { id: string; name: string; description: string; status: string; owner: string; chapterId: string; appearance: string; size: string; pattern: string }[]
  worldSettings: { id: string; key: string; category: string; value: string; description?: string }[]
  characterRelations?: { id: string; characterId1: string; characterId2: string; relation: string; description?: string }[]
  locations?: { id: string; name: string; type?: string; description?: string }[]
  timelines?: { id: string; title: string; description?: string }[]
  chapters?: { id: string; sortOrder: number }[]
  width?: number
  height?: number
  onNodeClick?: (type: string, id: string) => void
}

interface NodePos {
  x: number
  y: number
}

const TYPE_COLORS: Record<string, string> = {
  character: '#4f8cff',
  item: '#f59e0b',
  organization: '#8b5cf6'
}

const EDGE_STYLES: Record<EdgeCategory, { strokeDasharray: string; opacity: number }> = {
  '人物关系': { strokeDasharray: '', opacity: 0.7 },
  '人物-物品': { strokeDasharray: '6,3', opacity: 0.6 },
  '人物-组织': { strokeDasharray: '3,3', opacity: 0.6 }
}

const EDGE_COLORS: Record<EdgeCategory, string> = {
  '人物关系': '#ec4899',
  '人物-物品': '#f59e0b',
  '人物-组织': '#a855f7'
}

const EDGE_LABELS: Record<EdgeCategory, string> = {
  '人物关系': '人物关系',
  '人物-物品': '人物→物品',
  '人物-组织': '人物∈组织'
}

function buildGraph(
  characters: MemoryGraphProps['characters'],
  items: MemoryGraphProps['items'],
  worldSettings: MemoryGraphProps['worldSettings'],
  characterRelations: MemoryGraphProps['characterRelations'],
  chOrderMap: Map<string, number>,
): { nodes: MemoryNode[]; edges: MemoryEdge[] } {
  const nodes: MemoryNode[] = []
  const edges: MemoryEdge[] = []
  const charNameMap = new Map(characters.map(c => [c.name.trim(), c.id]))
  const chOf = (s?: string | null) => { const m = s?.match(/\[ch:([^\]]+)\]/); return m ? (chOrderMap.get(m[1]) ?? 999) : 999 }; const chOfSafe = (s?: string | null) => { const v = chOf(s); return v >= 999 ? 99999 : v }

  for (const c of characters) {
    const status = c.importantEvents ? c.importantEvents.split('\n').pop() || '' : ''
    nodes.push({
      id: `char:${c.id}`, name: c.name, type: 'character',
      subtitle: c.role, status: status.replace(/^[^]*?状态:\s*/, ''),
      color: TYPE_COLORS.character, chOrder: 0
    })
  }

  const extractStatus = (desc: string) => {
    const m = desc.match(/状态:\s*([^\s|]+)/)
    return m ? m[1] : ''
  }

  // 从 items.json 读取物品
  if (items) {
    for (const it of items) {
      nodes.push({ id: `itm:${it.id}`, name: it.name, type: 'item', subtitle: '物品', status: it.status || extractStatus(it.description || ''), color: TYPE_COLORS.item, chOrder: chOfSafe(`[ch:${it.chapterId}]`) })
    }
  }
  for (const ws of worldSettings) {
    if (ws.category === '组织') {
      nodes.push({ id: `ws:${ws.id}`, name: ws.key, type: 'organization', subtitle: ws.category, status: extractStatus(ws.description || ''), color: TYPE_COLORS.organization, chOrder: chOfSafe(ws.description) })
    }
  }

  for (const ws of worldSettings) {
    if (ws.category === '人物-物品关系') {
      const [charName, itemRaw] = ws.key.split('→').map(s => s.trim())
      const itemName = (itemRaw || '').replace(/@.*$/, '')
      const charId = charNameMap.get(charName)
      const itemNode = nodes.find(n => n.type === 'item' && n.name === itemName)
      if (charId && itemNode) {
        edges.push({ id: `ci:${ws.id}`, sourceId: `char:${charId}`, targetId: itemNode.id, label: ws.value || '关联', category: '人物-物品', chOrder: chOfSafe(ws.description) })
      }
    } else if (ws.category === '人物-组织关系') {
      const [charName, orgRaw] = ws.key.split('→').map(s => s.trim())
      const orgName = (orgRaw || '').replace(/@.*$/, '')
      const charId = charNameMap.get(charName)
      const orgNode = nodes.find(n => n.type === 'organization' && n.name === orgName)
      if (charId && orgNode) {
        edges.push({ id: `co:${ws.id}`, sourceId: `char:${charId}`, targetId: orgNode.id, label: ws.value || '成员', category: '人物-组织', chOrder: chOfSafe(ws.description) })
      }
    }
  }

  if (characterRelations) {
    for (const r of characterRelations) {
      if (isExtracted(r.description)) {
        const sid = `char:${r.characterId1}`
        const tid = `char:${r.characterId2}`
        if (nodes.some(n => n.id === sid) && nodes.some(n => n.id === tid)) {
          edges.push({ id: `rel:${r.id}`, sourceId: sid, targetId: tid, label: r.relation, category: '人物关系', chOrder: chOfSafe(r.description) })
        }
      }
    }
  }

  return { nodes, edges }
}

type TabId = 'graph' | 'dialogues' | 'locations' | 'events'

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'graph', label: '图谱', icon: <Share2 size={13} /> },
  { id: 'dialogues', label: '对话', icon: <MessageSquare size={13} /> },
  { id: 'locations', label: '地点', icon: <MapPin size={13} /> },
  { id: 'events', label: '事件', icon: <Clock size={13} /> },
]

export default function MemoryGraph({
  characters, items, worldSettings, characterRelations, locations, timelines, chapters,
  width = 900, height = 600,
  onNodeClick
}: MemoryGraphProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('graph')

  const svgRef = useRef<SVGSVGElement>(null)
  const graphRef = useRef<SVGGElement>(null)

  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const panningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })
  const draggingRef = useRef<string | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const [nodePosMap, setNodePosMap] = useState<Map<string, NodePos>>(new Map())
  const savedPosRef = useRef<Record<string, NodePos>>({})
  const [posLoaded, setPosLoaded] = useState(false)
  const currentProject = useAppStore((s) => s.currentProject)
  const [scale, setScale] = useState(1)
  const [showEdges, setShowEdges] = useState<Record<EdgeCategory, boolean>>({
    '人物关系': true,
    '人物-物品': true,
    '人物-组织': true
  })
  const [selectedChOrder, setSelectedChOrder] = useState(0)
  const initChRef = useRef(false)
  const chOrderMap = useMemo(() => new Map((chapters || []).map(c => [c.id, c.sortOrder])), [chapters])
  const chList = useMemo(() => (chapters || []).sort((a, b) => a.sortOrder - b.sortOrder), [chapters])

  const [popupNode, setPopupNode] = useState<{ node: MemoryNode; x: number; y: number } | null>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectSource, setConnectSource] = useState<string | null>(null)
  const [createRel, setCreateRel] = useState<{ source: MemoryNode; target: MemoryNode; x: number; y: number } | null>(null)
  const [relInput, setRelInput] = useState('')
  const [relDesc, setRelDesc] = useState('')
  const [editEdge, setEditEdge] = useState<{ id: string; label: string; category: EdgeCategory; x: number; y: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const ctxMenuRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [nodeCtxMenu, setNodeCtxMenu] = useState<{ node: MemoryNode; x: number; y: number } | null>(null)
  const saveCharacter = useAppStore((s) => s.saveCharacter)
  const deleteWorldSetting = useAppStore((s) => s.deleteWorldSetting)
  const deleteTimeline = useAppStore((s) => s.deleteTimeline)
  const deleteLocation = useAppStore((s) => s.deleteLocation)
  const deleteCharacterRelation = useAppStore((s) => s.deleteCharacterRelation)
  const saveCharacterRelation = useAppStore((s) => s.saveCharacterRelation)
  const loadCharacters = useAppStore((s) => s.loadCharacters)
  const loadCharacterRelations = useAppStore((s) => s.loadCharacterRelations)

  const centerX = width / 2
  const centerY = height / 2

  const { nodes: rawNodes, allEdges } = useMemo(() => {
    const result = buildGraph(characters, items, worldSettings, characterRelations, chOrderMap)
    return { nodes: result.nodes, allEdges: result.edges }
  }, [characters, items, worldSettings, characterRelations, chOrderMap])

  // 按章节过滤
  const nodes = useMemo(() => {
    return rawNodes
      .filter(n => n.type === 'character' || n.chOrder === selectedChOrder)
      .map(n => {
        if (n.type !== 'character') return n
        const c = characters.find(ch => `char:${ch.id}` === n.id)
        if (!c?.importantEvents) return n
        const lines = c.importantEvents.split('\n').filter(Boolean)
        let latestStatus = ''
        for (const line of lines) {
          const m = line.match(/\[ch:([^\]]+)\]/)
          if (!m) continue
          const order = chOrderMap.get(m[1]) ?? 999
          if (order <= selectedChOrder) {
            latestStatus = line.replace(/\[ch:.*?\]|（[^）]*）/g, '').replace(/状态:\s*/, '').trim()
          }
        }
        return { ...n, status: latestStatus || n.status }
      })
  }, [rawNodes, selectedChOrder, characters, chOrderMap])

  const visibleEdges = useMemo(() => {
    let edges = allEdges.filter(e => showEdges[e.category])
    // 只保留 <= 选中章的边，人物关系按角色对去重取最新
    const filtered = edges.filter(e => e.chOrder <= selectedChOrder || e.chOrder >= 99999)
    const seen = new Set<string>()
    const deduped: MemoryEdge[] = []
    // 先按 chOrder 降序（最新的在前），遍历时对人物关系去重
    const sorted = [...filtered].sort((a, b) => b.chOrder - a.chOrder)
    for (const e of sorted) {
      if (e.category === '人物关系') {
        const key = [e.sourceId, e.targetId].sort().join(':')
        if (seen.has(key)) continue
        seen.add(key)
      }
      deduped.push(e)
    }
    edges = deduped
    return edges
  }, [allEdges, showEdges, selectedChOrder])

  const getRadius = (type: string): number => {
    switch (type) {
      case 'character': return 30
      case 'item': return 24
      case 'organization': return 28
      default: return 24
    }
  }

  useEffect(() => {
    if (!currentProject?.id) return
    let cancelled = false
    savedPosRef.current = {}
    setPosLoaded(false)
    window.api.getCharacterPositions(currentProject.id).then((saved: Record<string, NodePos> | undefined) => {
      if (cancelled) return
      if (saved && typeof saved === 'object') {
        savedPosRef.current = saved
      }
      setPosLoaded(true)
    })
    return () => { cancelled = true }
  }, [currentProject?.id])

  // 初始定位到有记忆的最后一章
  useEffect(() => {
    if (initChRef.current || !chOrderMap.size) return
    initChRef.current = true
    let max = 0
    const check = (id?: string) => { if (id) { const o = chOrderMap.get(id); if (o !== undefined && o > max) max = o } }
    worldSettings.forEach(ws => { const m = ws.description?.match(/\[ch:([^\]]+)\]/); if (m) check(m[1]) })
    characterRelations?.forEach(cr => { const m = cr.description?.match(/\[ch:([^\]]+)\]/); if (m) check(m[1]) })
    items?.forEach(it => check(it.chapterId))
    timelines?.forEach(tl => { const m = tl.description?.match(/\[ch:([^\]]+)\]/); if (m) check(m[1]) })
    if (max > 0) setSelectedChOrder(max)
  }, [chOrderMap])

  useEffect(() => {
    const innerR = Math.min(width, height) * 0.2
    const outerR = Math.min(width, height) * 0.38
    const newMap = new Map<string, NodePos>()
    const saved = savedPosRef.current

    const innerNodes = nodes.filter(n => n.type === 'character')
    const outerNodes = nodes.filter(n => n.type !== 'character')

    const getPos = (id: string) => saved[id] || nodePosMap.get(id) || null

    innerNodes.forEach((node, i) => {
      const p = getPos(node.id)
      if (p) {
        newMap.set(node.id, { x: p.x, y: p.y })
      } else {
        const angle = (i / Math.max(innerNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
        newMap.set(node.id, { x: centerX + Math.cos(angle) * innerR, y: centerY + Math.sin(angle) * innerR })
      }
    })

    outerNodes.forEach((node, i) => {
      const p = getPos(node.id)
      if (p) {
        newMap.set(node.id, { x: p.x, y: p.y })
      } else {
        const angle = (i / Math.max(outerNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
        newMap.set(node.id, { x: centerX + Math.cos(angle) * outerR, y: centerY + Math.sin(angle) * outerR })
      }
    })

    setNodePosMap(newMap)
  }, [nodes, width, height, centerX, centerY, posLoaded])

  const updateNodePos = (id: string, x: number, y: number) => {
    savedPosRef.current[id] = { x, y }
    setNodePosMap(prev => {
      const next = new Map(prev)
      next.set(id, { x, y })
      return next
    })
  }

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - offsetRef.current.x) / scaleRef.current,
    y: (sy - offsetRef.current.y) / scaleRef.current
  })

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.3, Math.min(3, scaleRef.current * delta))
    const wp = screenToWorld(mx, my)
    offsetRef.current.x = mx - wp.x * newScale
    offsetRef.current.y = my - wp.y * newScale
    scaleRef.current = newScale
    setScale(newScale)
    if (graphRef.current) {
      graphRef.current.setAttribute('transform', `translate(${offsetRef.current.x}, ${offsetRef.current.y}) scale(${newScale})`)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height
    if (e.button === 1 || e.shiftKey) {
      panningRef.current = true
      panStartRef.current = { x: mx, y: my, offsetX: offsetRef.current.x, offsetY: offsetRef.current.y }
      e.preventDefault()
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (!svgRef.current) return
    const node = nodePosMap.get(nodeId)
    if (!node) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height
    const wp = screenToWorld(mx, my)
    dragOffsetRef.current = { x: wp.x - node.x, y: wp.y - node.y }
    draggingRef.current = nodeId
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * width
    const my = ((e.clientY - rect.top) / rect.height) * height
    if (panningRef.current) {
      offsetRef.current.x = panStartRef.current.offsetX + (mx - panStartRef.current.x)
      offsetRef.current.y = panStartRef.current.offsetY + (my - panStartRef.current.y)
      if (graphRef.current) {
        graphRef.current.setAttribute('transform', `translate(${offsetRef.current.x}, ${offsetRef.current.y}) scale(${scaleRef.current})`)
      }
      return
    }
    if (draggingRef.current) {
      const wp = screenToWorld(mx, my)
      const nx = wp.x - dragOffsetRef.current.x
      const ny = wp.y - dragOffsetRef.current.y
      updateNodePos(draggingRef.current, nx, ny)
    }
  }

  const handleMouseUp = () => {
    panningRef.current = false
    if (draggingRef.current) {
      const positions: Record<string, NodePos> = {}
      nodePosMap.forEach((pos, id) => { positions[id] = pos })
      if (currentProject?.id && Object.keys(positions).length > 0) {
        window.api.saveCharacterPositions({ projectId: currentProject.id, positions }).catch(console.error)
      }
    }
    draggingRef.current = null
  }

  const handleNodeClick = (e: React.MouseEvent, node: MemoryNode) => {
    e.stopPropagation()
    if (node.type === 'character') {
      const rect = svgRef.current?.getBoundingClientRect()
      const pos = nodePosMap.get(node.id)
      if (rect && pos) {
        const sx = (pos.x * scaleRef.current + offsetRef.current.x) / width * rect.width + rect.left
        const sy = (pos.y * scaleRef.current + offsetRef.current.y) / height * rect.height + rect.top
        setPopupNode({ node, x: sx, y: sy })
      }
    } else {
      onNodeClick?.(node.type, node.id)
    }
  }

  const handleClosePopup = () => setPopupNode(null)

  const handleCtxMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const handleStartConnect = () => {
    setCtxMenu(null)
    setConnectMode(true)
    setConnectSource(null)
  }

  const handleNodeCtxMenu = (e: React.MouseEvent, node: MemoryNode) => {
    e.preventDefault()
    e.stopPropagation()
    setNodeCtxMenu({ node, x: e.clientX, y: e.clientY })
  }

  const handleDeleteNodeChapter = async () => {
    if (!nodeCtxMenu || selectedChOrder < 0) return
    const node = nodeCtxMenu.node
    setNodeCtxMenu(null)
    if (!confirm(`确定要删除「${node.name}」在第${selectedChOrder + 1}章的记忆数据吗？\n其他章节不受影响。`)) return
    const pid = useAppStore.getState().currentProject?.id
    if (!pid) return

    const chEntry = (chapters || []).find(c => c.sortOrder === selectedChOrder)
    const chId = chEntry?.id
    if (!chId) return

    const marker = `[ch:${chId}]`

    if (node.type === 'character') {
      const charId = node.id.replace('char:', '')
      for (const r of (characterRelations || [])) {
        if (r.description?.includes(marker) && (r.characterId1 === charId || r.characterId2 === charId)) {
          await deleteCharacterRelation(r.id)
        }
      }
      // 移除角色该章的状态记录
      const char = useAppStore.getState().characters.find(c => c.id === charId)
      if (char?.importantEvents?.includes(marker)) {
        const remaining = char.importantEvents.split('\n').filter(l => !l.includes(marker)).join('\n')
        await saveCharacter({ id: charId, projectId: pid, importantEvents: remaining })
      }
    }

    // 删除该章关联的人物-物品/组织关系
    for (const ws of useAppStore.getState().worldSettings) {
      if ((ws.category === '人物-物品关系' || ws.category === '人物-组织关系') && ws.description?.includes(marker)) {
        const relatedName = ws.key.split('→').map(s => s.trim())[1]?.replace(/@.*$/, '')
        if (relatedName === node.name) await deleteWorldSetting(ws.id)
      }
    }

    // 物品/组织：只删除带 @chapterId 后缀的该章条目
    if (node.type === 'item' || node.type === 'organization') {
      const cat = node.type === 'item' ? '物品' : '组织'
      for (const ws of useAppStore.getState().worldSettings) {
        if (ws.category === cat && ws.key === `${node.name}@${chId}`) {
          await deleteWorldSetting(ws.id)
        }
      }
      // 新 items.json 中的条目
      if (node.type === 'item') {
        const itemEntry = useAppStore.getState().items.find(i => i.name === node.name && i.chapterId === chId)
        if (itemEntry) await useAppStore.getState().deleteItem(itemEntry.id)
      }
    }

    if (node.type === 'location') {
      const loc = useAppStore.getState().locations.find(l => l.name === node.name && l.description?.includes(marker))
      if (loc) await deleteLocation(loc.id)
    }

    if (node.type === 'event') {
      const ev = useAppStore.getState().timelines.find(t => t.title === node.name && t.description?.includes(marker))
      if (ev) await deleteTimeline(ev.id)
    }

    await loadCharacters(pid)
    await loadCharacterRelations(pid)
    await useAppStore.getState().loadWorldSettings(pid)
    await useAppStore.getState().loadTimelines(pid)
    await useAppStore.getState().loadLocations(pid)
  }

  const handleGraphClick = useCallback((e: React.MouseEvent) => {
    // If in connect mode and clicked on background, cancel
    if (connectMode && (e.target as HTMLElement).tagName === 'svg') {
      setConnectMode(false)
      setConnectSource(null)
    }
  }, [connectMode])

  const handleNodeClickConnect = (node: MemoryNode, clientX: number, clientY: number) => {
    if (!connectMode) {
      handleNodeClick({ stopPropagation: () => {} } as React.MouseEvent, node)
      return
    }
    if (!connectSource) {
      setConnectSource(node.id)
    } else if (connectSource !== node.id) {
      const src = nodes.find(n => n.id === connectSource)
      if (src) {
        setCreateRel({ source: src, target: node, x: clientX, y: clientY })
        setRelInput('关联')
        setRelDesc('')
      }
      setConnectMode(false)
      setConnectSource(null)
    }
  }

  const handleSaveRelation = async () => {
    if (!createRel || !relInput.trim()) return
    const src = createRel.source
    const tgt = createRel.target
    const isChar = (s: string) => s.startsWith('char:')
    const strip = (s: string) => s.replace(/^(char:|ws:|loc:|tl:)/, '')
    const pid = useAppStore.getState().currentProject?.id
    if (!pid) return

    const manualDesc = (relDesc.trim() || '') + ' [manual]'
    if (isChar(src.id) && isChar(tgt.id)) {
      await saveCharacterRelation({
        projectId: pid, characterId1: strip(src.id), characterId2: strip(tgt.id),
        relation: relInput.trim(), description: manualDesc
      })
    } else if (isChar(src.id)) {
      const cat = tgt.type === 'item' ? '人物-物品关系' : '人物-组织关系'
      const key = `${src.name}→${tgt.name}@manual`
      await useAppStore.getState().saveWorldSetting({
        projectId: pid, category: cat, key, value: relInput.trim(), description: manualDesc
      })
    } else if (isChar(tgt.id)) {
      const cat = src.type === 'item' ? '人物-物品关系' : '人物-组织关系'
      const key = `${tgt.name}→${src.name}@manual`
      await useAppStore.getState().saveWorldSetting({
        projectId: pid, category: cat, key, value: relInput.trim(), description: manualDesc
      })
    }
    if (pid) {
      nodePosMap.forEach((p, id) => { savedPosRef.current[id] = p })
      window.api.saveCharacterPositions({ projectId: pid, positions: Object.fromEntries(nodePosMap) }).catch(() => {})
      await loadCharacterRelations(pid)
      await useAppStore.getState().loadWorldSettings(pid)
    }
    setCreateRel(null)
  }

  const handleEdgeDblClick = (e: React.MouseEvent, edge: MemoryEdge) => {
    e.stopPropagation()
    setEditEdge({ id: edge.id, label: edge.label, category: edge.category, x: e.clientX, y: e.clientY })
    setEditValue(edge.label)
  }

  const handleSaveEdgeEdit = async () => {
    if (!editEdge || !editValue.trim()) return
    const pid = useAppStore.getState().currentProject?.id
    if (!pid) return

    nodePosMap.forEach((p, id) => { savedPosRef.current[id] = p })
    window.api.saveCharacterPositions({ projectId: pid, positions: Object.fromEntries(nodePosMap) }).catch(() => {})

    if (editEdge.id.startsWith('rel:')) {
      const relId = editEdge.id.replace('rel:', '')
      await saveCharacterRelation({ id: relId, projectId: pid, relation: editValue.trim() })
      await loadCharacterRelations(pid)
    } else if (editEdge.id.startsWith('ci:') || editEdge.id.startsWith('co:')) {
      const wsId = editEdge.id.replace(/^(ci:|co:)/, '')
      await useAppStore.getState().saveWorldSetting({ id: wsId, projectId: pid, value: editValue.trim() })
      await useAppStore.getState().loadWorldSettings(pid)
    }
    setEditEdge(null)
  }

  const handleOpenCharDoc = () => {
    if (popupNode) {
      onNodeClick?.('character', popupNode.node.id)
      setPopupNode(null)
    }
  }

  const handleResetView = () => {
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    setScale(1)
    if (graphRef.current) {
      graphRef.current.setAttribute('transform', 'translate(0, 0) scale(1)')
    }
  }

  useEffect(() => {
    if (!popupNode) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.node-popup')) setPopupNode(null)
    }
    setTimeout(() => window.addEventListener('click', close), 0)
    return () => window.removeEventListener('click', close)
  }, [popupNode])

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  useEffect(() => {
    if (!nodeCtxMenu) return
    const close = () => setNodeCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [nodeCtxMenu])

  const validEdges = useMemo(() => {
    const ids = new Set(nodes.map(n => n.id))
    return visibleEdges.filter(e => ids.has(e.sourceId) && ids.has(e.targetId))
  }, [visibleEdges, nodes])

  const edgeCounts = useMemo(() => {
    const counts: Record<EdgeCategory, number> = { '人物关系': 0, '人物-物品': 0, '人物-组织': 0 }
    for (const e of visibleEdges) counts[e.category]++
    return counts
  }, [visibleEdges])

  const sorter = useMemo(() => chIdSort(chapters || []), [chapters])
  const chSort = (a: { description?: string | null }, b: { description?: string | null }) => {
    const ma = a.description?.match(/\[ch:([^\]]+)\]/); const oa = ma ? (chOrderMap.get(ma[1]) ?? 999) : 999
    const mb = b.description?.match(/\[ch:([^\]]+)\]/); const ob = mb ? (chOrderMap.get(mb[1]) ?? 999) : 999
    if (oa !== ob) return oa - ob
    const sa = parseInt(a.description?.match(/\[seq:(\d+)\]/)?.[1] ?? '999', 10)
    const sb = parseInt(b.description?.match(/\[seq:(\d+)\]/)?.[1] ?? '999', 10)
    return sa - sb
  }
  const extractedDialogues = useMemo(() =>
    worldSettings.filter(ws => ws.category === '重要对话').sort(chSort),
    [worldSettings, chOrderMap]
  )
  const extractedLocs = useMemo(() =>
    (locations || []).sort(chSort),
    [locations, chOrderMap]
  )
  const extractedEvents = useMemo(() =>
    (timelines || []).sort(chSort),
    [timelines, chOrderMap]
  )

  const hasGraphContent = nodes.length > 0

  const renderTable = (title: string, icon: React.ReactNode, color: string, columns: { key: string; label: string }[], rows: any[]) => (
    <div style={{ padding: 12, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)' }}>
          暂无数据
        </div>
      ) : (
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '3px 6px', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row[col.key] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface-hover)'
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '7px 14px', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400,
              border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              backgroundColor: activeTab === tab.id ? 'var(--color-surface)' : 'transparent',
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              cursor: 'pointer', transition: 'none'
            }}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {activeTab === 'graph' && hasGraphContent && (
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', paddingRight: 12 }}>
            {nodes.length} 节点 · {visibleEdges.length} 关系
          </span>
        )}
        {selectedChOrder >= 0 && (
          <span style={{ fontSize: 10, color: 'var(--color-accent)', paddingRight: 8 }}>
            第{selectedChOrder + 1}章
          </span>
        )}
        {activeTab === 'dialogues' && (
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', paddingRight: 12 }}>
            {extractedDialogues.length} 条
          </span>
        )}
        {activeTab === 'locations' && (
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', paddingRight: 12 }}>
            {extractedLocs.length} 地点
          </span>
        )}
        {activeTab === 'events' && (
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', paddingRight: 12 }}>
            {extractedEvents.length} 事件
          </span>
        )}
      </div>

      {activeTab === 'graph' && (
        <>
          {/* 时间线滑动条 */}
          {chList.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px',
              borderBottom: '1px solid var(--color-border-light)',
              fontSize: 11, backgroundColor: 'var(--color-sidebar)', flexShrink: 0
            }}>
              <span style={{ color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>时间线：</span>
              <input type="range" min={0} max={Math.max(0, chList.length - 1)} step={1}
                value={Math.max(0, Math.min(selectedChOrder, chList.length - 1))}
                onChange={e => setSelectedChOrder(parseInt(e.target.value, 10))}
                style={{ flex: 1, height: 4, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
              <span style={{ color: 'var(--color-text)', fontWeight: 500, minWidth: 48, textAlign: 'center' }}>
                第{selectedChOrder + 1}章
              </span>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
            borderBottom: '1px solid var(--color-border-light)',
            fontSize: 11, color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-sidebar)'
          }}>
            <span style={{ color: 'var(--color-text-dim)' }}>关系筛选：</span>
            {(Object.keys(showEdges) as EdgeCategory[]).map(cat => (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, backgroundColor: showEdges[cat] ? EDGE_COLORS[cat] + '18' : 'transparent' }}>
                <input type="checkbox" checked={showEdges[cat]} onChange={() => setShowEdges(prev => ({ ...prev, [cat]: !prev[cat] }))} />
                <span style={{
                  display: 'inline-block', width: 20, height: 0,
                  borderTop: cat === '人物关系' ? '2px solid ' + EDGE_COLORS[cat]
                    : cat === '人物-物品' ? '2px dashed ' + EDGE_COLORS[cat]
                    : '2px dotted ' + EDGE_COLORS[cat],
                  verticalAlign: 'middle'
                }} />
                {EDGE_LABELS[cat]}
                <span style={{ color: 'var(--color-text-dim)' }}>{edgeCounts[cat]}</span>
              </label>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>
              内圈·人物 / 外圈·物品·组织
            </span>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            {!hasGraphContent ? (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 12, color: 'var(--color-text-dim)', fontSize: 14
              }}>
                <p>暂无记忆数据</p>
                <p style={{ fontSize: 12, opacity: 0.7 }}>请先用「提炼记忆」功能添加</p>
              </div>
            ) : (
              <>
                <svg
                  ref={svgRef}
                  width="100%" height="100%"
                  viewBox={`0 0 ${width} ${height}`}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={handleCtxMenu}
                  onClick={handleGraphClick}
                  style={{ cursor: connectMode ? 'crosshair' : (panningRef.current ? 'grabbing' : 'default'), userSelect: 'none' }}
                >
                  <g ref={graphRef}>
                    {validEdges.map(edge => {
                      const s = nodePosMap.get(edge.sourceId)
                      const t = nodePosMap.get(edge.targetId)
                      if (!s || !t) return null
                      const dx = t.x - s.x
                      const dy = t.y - s.y
                      const d = Math.sqrt(dx * dx + dy * dy) || 1
                      const r1 = getRadius(nodes.find(n => n.id === edge.sourceId)?.type || 'character')
                      const r2 = getRadius(nodes.find(n => n.id === edge.targetId)?.type || 'character')
                      const sx = s.x + (dx / d) * (r1 + 4)
                      const sy = s.y + (dy / d) * (r1 + 4)
                      const tx = t.x - (dx / d) * (r2 + 4)
                      const ty = t.y - (dy / d) * (r2 + 4)
                      const mx = (sx + tx) / 2
                      const my = (sy + ty) / 2
                      const style = EDGE_STYLES[edge.category]
                      const color = EDGE_COLORS[edge.category]
                      return (
                        <g key={edge.id}>
                          <line x1={sx} y1={sy} x2={tx} y2={ty}
                            stroke={color} strokeWidth="1.5"
                            strokeDasharray={style.strokeDasharray || undefined}
                            strokeOpacity={style.opacity} />
                          <g transform={`translate(${mx}, ${my})`}
                            style={{ cursor: 'pointer' }}
                            onDoubleClick={(e) => handleEdgeDblClick(e, edge)}>
                            <rect x={-edge.label.length * 4 - 8} y={-8}
                              width={edge.label.length * 8 + 16} height="16" rx="5"
                              fill="var(--color-surface)" stroke={color} strokeWidth="1" />
                            <text textAnchor="middle" y="3" fontSize="10"
                              fill="var(--color-text-secondary)" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                              {edge.label}
                            </text>
                          </g>
                        </g>
                      )
                    })}
                    {nodes.map(node => {
                      const pos = nodePosMap.get(node.id)
                      if (!pos) return null
                      const color = node.color
                      const r = getRadius(node.type)
                      const isChar = node.type === 'character'
                      let shape: JSX.Element | null = null
                      if (isChar) {
                        shape = (
                          <>
                            <circle r={r + 2} fill={color} fillOpacity="0.1" stroke={color} strokeWidth="2" />
                            <circle r={r - 2} fill="var(--color-surface)" stroke={color} strokeWidth="1.5" />
                          </>
                        )
                      } else if (node.type === 'item') {
                        const s = r * 0.8
                        shape = (
                          <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={3}
                            fill="var(--color-surface)" stroke={color} strokeWidth="1.5" />
                        )
                      } else if (node.type === 'organization') {
                        const pts = `0,-${r} ${r},0 0,${r} -${r},0`
                        shape = (
                          <>
                            <polygon points={pts} fill={color} fillOpacity="0.1" stroke={color} strokeWidth="2" />
                            <polygon points={pts} fill="var(--color-surface)" stroke={color} strokeWidth="1.5" />
                          </>
                        )
                      } else {
                        shape = (
                          <circle r={r} fill={color} fillOpacity="0.08" stroke={color} strokeWidth="1.5" strokeDasharray="4,2" />
                        )
                      }
                      return (
                        <g key={node.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                          onContextMenu={(e) => handleNodeCtxMenu(e, node)}
                          onClick={(e) => {
                            if (connectMode) {
                              const rect = svgRef.current?.getBoundingClientRect()
                              handleNodeClickConnect(node, e.clientX, e.clientY)
                            } else {
                              handleNodeClick(e, node)
                            }
                          }}
                        >
                          {shape}
                          <text textAnchor="middle" y={isChar ? 4 : 3}
                            fontSize={isChar ? 12 : 10} fontWeight={isChar ? 600 : 400}
                            fill="var(--color-text)" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                            {node.name.length > 6 ? node.name.slice(0, 6) : node.name}
                          </text>
                          {node.subtitle && (
                            <text textAnchor="middle" y={r + 14} fontSize="9" fill="var(--color-text-dim)"
                              style={{ pointerEvents: 'none', userSelect: 'none' }}>
                              {node.subtitle}
                            </text>
                          )}
                          {node.status && (
                            <text textAnchor="middle" y={r + (isChar ? 26 : 16)} fontSize="8" fill={color}
                              style={{ pointerEvents: 'none', userSelect: 'none' }}>
                              [{node.status}]
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                </svg>
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  display: 'flex', gap: 4, alignItems: 'center',
                  padding: '2px 6px', borderRadius: 4,
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  fontSize: 10, color: 'var(--color-text-secondary)', zIndex: 10
                }}>
                  <button onClick={handleResetView}
                    style={{ padding: '2px 6px', borderRadius: 3, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 10 }}>
                    重置视图
                  </button>
                  <span>{Math.round(scale * 100)}%</span>
                </div>

                {/* 连线模式指示 */}
                {connectMode && (
                  <div style={{
                    position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 20, padding: '4px 12px', borderRadius: 6, fontSize: 11,
                    backgroundColor: 'var(--color-accent)', color: '#fff'
                  }}>
                    {connectSource ? '请点击目标节点' : '请点击起始节点'} · 点击空白处取消
                  </div>
                )}

                {/* 右键菜单 */}
                {ctxMenu && (
                  <div ref={ctxMenuRef} style={{
                    position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000,
                    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 6, padding: '4px 0', minWidth: 130, fontSize: 11,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    <button onClick={handleStartConnect}
                      style={{ width: '100%', textAlign: 'left', padding: '5px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <Link2 size={12} /> 创建关系
                    </button>
                  </div>
                )}

                {/* 节点右键菜单 */}
                {nodeCtxMenu && (
                  <div style={{
                    position: 'fixed', left: nodeCtxMenu.x, top: nodeCtxMenu.y, zIndex: 1000,
                    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 6, padding: '4px 0', minWidth: 150, fontSize: 11,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ padding: '5px 12px', color: 'var(--color-text)', fontWeight: 500, borderBottom: '1px solid var(--color-border-light)', marginBottom: 2 }}>
                      {nodeCtxMenu.node.name}
                    </div>
                    {selectedChOrder >= 0 ? (
                      <button onClick={handleDeleteNodeChapter}
                        style={{ width: '100%', textAlign: 'left', padding: '5px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <Trash2 size={12} /> 删除本章关联
                      </button>
                    ) : (
                      <div style={{ padding: '5px 12px', color: 'var(--color-text-dim)', fontSize: 10 }}>
                        请先在时间线中选择章节
                      </div>
                    )}
                  </div>
                )}

                {/* 编辑关系弹窗 */}
                {editEdge && (
                  <div style={{
                    position: 'fixed', left: editEdge.x, top: editEdge.y, zIndex: 1001,
                    transform: 'translate(-50%, -130%)',
                    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: 10, minWidth: 200,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: 11
                  }}>
                    <div style={{ marginBottom: 6, color: 'var(--color-text-secondary)' }}>修改关系</div>
                    <input value={editValue} onChange={e => setEditValue(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', fontSize: 11, marginBottom: 6, outline: 'none' }} autoFocus />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => setEditEdge(null)}
                        style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 10 }}>
                        取消
                      </button>
                      <button onClick={handleSaveEdgeEdit}
                        style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 10 }}>
                        保存
                      </button>
                    </div>
                  </div>
                )}

                {/* 关系创建弹窗 */}
                {createRel && (
                  <div style={{
                    position: 'fixed', left: createRel.x, top: createRel.y, zIndex: 1001,
                    transform: 'translate(-50%, -120%)',
                    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: 10, minWidth: 220,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: 11
                  }}>
                    <div style={{ marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                      {createRel.source.name} → {createRel.target.name}
                    </div>
                    <input value={relInput} onChange={e => setRelInput(e.target.value)}
                      placeholder="关系类型（如：师徒、敌对）"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', fontSize: 11, marginBottom: 4, outline: 'none' }}
                      autoFocus />
                    <input value={relDesc} onChange={e => setRelDesc(e.target.value)}
                      placeholder="关系描述（可选）"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', fontSize: 11, marginBottom: 6, outline: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => setCreateRel(null)}
                        style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <X size={10} /> 取消
                      </button>
                      <button onClick={handleSaveRelation}
                        style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Check size={10} /> 确定
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'dialogues' && (() => {
        const cols = [{ key: 'speaker', label: '说话者' }, { key: 'content', label: '对话内容' }, { key: 'with', label: '对话对象' }, { key: 'context', label: '场景' }]
        const rows = extractedDialogues.map(d => {
          const [speaker, withRaw] = (d.key || '').split('→').map(s => s.trim())
          const with_ = (withRaw || '').replace(/@.*$/, '')
          return { id: d.id, speaker: speaker || '-', content: d.value?.slice(0, 100) + (d.value && d.value.length > 100 ? '...' : '') || '-', with: with_ || '-', context: (d.description || '').replace(/\[ch:.*?\]|（[^）]*）/g, '').trim() || '-' }
        })
        return (
          <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <MessageSquare size={14} style={{ color: '#6b7280' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>对话</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)' }}>暂无数据</div>
            ) : (
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {cols.map(col => (
                      <th key={col.key} style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{col.label}</th>
                    ))}
                    <th style={{ width: 50, padding: '4px 6px', borderBottom: '1px solid var(--color-border)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id || i}>
                      {cols.map(col => (
                        <td key={col.key} style={{ padding: '3px 6px', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[col.key] || '-'}</td>
                      ))}
                      <td style={{ padding: '3px 6px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <button onClick={async () => {
                          if (!confirm(`确定删除这条对话？`)) return
                          await useAppStore.getState().deleteWorldSetting(row.id)
                          const pid = useAppStore.getState().currentProject?.id
                          if (pid) await useAppStore.getState().loadWorldSettings(pid)
                        }}
                          style={{ padding: '2px', borderRadius: 3, border: 'none', backgroundColor: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 10 }}>
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })()}

      {activeTab === 'locations' && renderTable(
        '地点', <MapPin size={14} style={{ color: '#10b981' }} />, '#10b981',
        [{ key: 'name', label: '名称' }, { key: 'type', label: '类型' }, { key: 'description', label: '描述' }],
        extractedLocs.map(l => ({ id: l.id, name: l.name, type: l.type || '-', description: (l.description || '').replace(/\[ch:.*?\]|（[^）]*）/g, '').trim() || '-' }))
      )}

      {activeTab === 'events' && (() => {
        const cols = [{ key: 'title', label: '名称' }, { key: 'time', label: '时间' }, { key: 'description', label: '描述' }]
        const rows = extractedEvents.map(t => ({ id: t.id, title: t.title || '-', time: (t.description || '').match(/出现于:\s*([^\n|]+)/)?.[1]?.trim() || '-', description: (t.description || '').replace(/\[ch:.*?\]|（[^）]*）|\|.*$/g, '').trim() || '-' }))
        return (
          <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <Clock size={14} style={{ color: '#f97316' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>事件</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)' }}>暂无数据</div>
            ) : (
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {cols.map(col => (
                      <th key={col.key} style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{col.label}</th>
                    ))}
                    <th style={{ width: 50, padding: '4px 6px', borderBottom: '1px solid var(--color-border)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id || i}>
                      {cols.map(col => (
                        <td key={col.key} style={{ padding: '3px 6px', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[col.key] || '-'}</td>
                      ))}
                      <td style={{ padding: '3px 6px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <button onClick={async () => {
                          const pid = useAppStore.getState().currentProject?.id
                          if (!pid || !confirm(`确定删除事件「${row.title}」？`)) return
                          await useAppStore.getState().deleteTimeline(row.id)
                          await useAppStore.getState().loadTimelines(pid)
                        }}
                          style={{ padding: '2px', borderRadius: 3, border: 'none', backgroundColor: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 10 }}>
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })()}

      {popupNode && popupNode.node.type === 'character' && (() => {
        const charId = popupNode.node.id.replace('char:', '')
        const char = characters.find(c => c.id === charId)
        if (!char) return null
        const statusLines = (char.importantEvents || '').split('\n').filter(Boolean)
        const currentStatus = (() => {
          if (selectedChOrder < 0) {
            return statusLines.length > 0 ? statusLines[statusLines.length - 1].replace(/\[ch:.*?\]/g, '').trim() : ''
          }
          let last = ''
          for (const line of statusLines) {
            const m = line.match(/\[ch:([^\]]+)\]/)
            if (!m) continue
            if ((chOrderMap.get(m[1]) ?? 999) <= selectedChOrder) {
              last = line.replace(/\[ch:.*?\]/g, '').trim()
            }
          }
          return last
        })()

        const relEdges = allEdges.filter(e =>
          (e.sourceId === popupNode.node.id || e.targetId === popupNode.node.id)
        )
        const charDialogues = worldSettings.filter(ws =>
          ws.category === '重要对话' && ws.key.startsWith(char.name + '→')
        )
        const connectedLabels = relEdges.map(e => {
          const otherId = e.sourceId === popupNode.node.id ? e.targetId : e.sourceId
          const other = nodes.find(n => n.id === otherId)
          return other ? `${e.label} → ${other.name}` : ''
        }).filter(Boolean)

        return (
          <div className="node-popup" style={{
            position: 'fixed', left: popupNode.x, top: popupNode.y,
            transform: 'translate(-50%, -130%)',
            zIndex: 1000, minWidth: 200, maxWidth: 300,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, padding: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            fontSize: 11, color: 'var(--color-text)'
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{char.name}</div>
            {char.role && <div style={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}>{char.role}</div>}
            {char.description && <div style={{ color: 'var(--color-text-dim)', marginBottom: 4, lineHeight: 1.4 }}>{char.description}</div>}
            {currentStatus && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#4f8cff', fontWeight: 500 }}>当前状态：</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{currentStatus}</span>
              </div>
            )}
            {connectedLabels.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>关联：</span>
                {connectedLabels.map((l, i) => (
                  <div key={i} style={{ color: 'var(--color-text-dim)', paddingLeft: 8, lineHeight: 1.5 }}>· {l}</div>
                ))}
              </div>
            )}
            {charDialogues.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>重要对话：</span>
                {charDialogues.slice(0, 3).map((d, i) => (
                  <div key={i} style={{ color: 'var(--color-text-dim)', paddingLeft: 8, lineHeight: 1.5, fontSize: 10 }}>
                    · "{d.value?.slice(0, 50)}{d.value && d.value.length > 50 ? '...' : ''}"
                  </div>
                ))}
                {charDialogues.length > 3 && (
                  <div style={{ paddingLeft: 8, color: 'var(--color-text-muted)', fontSize: 10 }}>还有 {charDialogues.length - 3} 条...</div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
              <button onClick={handleClosePopup}
                style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 10 }}>
                关闭
              </button>
              <button onClick={handleOpenCharDoc}
                style={{ padding: '2px 8px', borderRadius: 4, border: 'none', backgroundColor: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 10 }}>
                查看详情
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
